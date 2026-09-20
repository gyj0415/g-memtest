import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { parseConverterMarkdown } from "./lib/parse-converter-md.mjs";
import { deleteBuiltInBank, listBuiltInBanks, packSiteZip, saveBuiltInBank } from "./lib/bank-io.mjs";

const siteRoot = fileURLToPath(new URL("../site/", import.meta.url));
const port = Number(process.env.PORT) || 4173;
const host = "127.0.0.1";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".zip": "application/zip"
};

function sendJson(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

async function readBody(req, limit = 45 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("请求太大");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function safeSiteFile(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const root = resolve(siteRoot);
  const full = resolve(root, relativePath);
  const rel = relative(root, full);
  if (!rel || rel.startsWith("..") || rel.startsWith(`..${sep}`)) return null;
  return full;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, studio: true });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/banks") {
    sendJson(res, 200, { banks: await listBuiltInBanks() });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/preview-md") {
    const body = JSON.parse(await readBody(req));
    const banks = parseConverterMarkdown(body.markdown || "", {
      defaultTitle: body.defaultTitle || "",
      defaultGroup: body.defaultGroup || "",
      defaultChapter: body.defaultChapter || "未分章",
      defaultCategory: body.defaultCategory || "auto"
    });
    sendJson(res, 200, { banks });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/banks") {
    const body = JSON.parse(await readBody(req));
    const entry = await saveBuiltInBank(body);
    sendJson(res, 200, { ok: true, bank: entry });
    return;
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/banks/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/banks/".length));
    const result = await deleteBuiltInBank(id);
    sendJson(res, 200, { ok: true, ...result });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/pack-site") {
    const zip = await packSiteZip();
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=\"g-memtest-site.zip\"",
      "Cache-Control": "no-store"
    });
    res.end(Buffer.from(zip));
    return;
  }
  sendJson(res, 404, { error: "没有这个接口" });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    let filePath = safeSiteFile(url.pathname);
    if (!filePath) {
      res.writeHead(400);
      res.end("bad path");
      return;
    }
    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, "index.html");
    } catch {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const headers = { "Content-Type": mime[ext] || "application/octet-stream" };
    if (ext === ".json" || ext === ".html") headers["Cache-Control"] = "no-store";
    res.writeHead(200, headers);
    res.end(data);
  } catch (error) {
    if (!res.headersSent) sendJson(res, 400, { error: error.message || String(error) });
  }
});

server.listen(port, host, () => {
  const home = `http://${host}:${port}/`;
  const studio = `http://${host}:${port}/studio.html`;
  console.log(`本地自测站：${home}`);
  console.log(`内置题库操作页：${studio}`);
  if (process.platform === "win32") exec(`start ${studio}`);
});
