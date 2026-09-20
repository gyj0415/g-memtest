import { unzipStoreFiles } from "./zip-store.mjs";

function normalizeZipPath(name) {
  return String(name || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function mimeFromName(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "image/png";
}

function bytesToBase64(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== "undefined") return Buffer.from(data).toString("base64");
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function bytesToDataUrl(name, bytes) {
  return `data:${mimeFromName(name)};base64,${bytesToBase64(bytes)}`;
}

function isZipBytes(bytes, filename = "") {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".zip")) return true;
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function looksLikeBankPayload(payload) {
  if (Array.isArray(payload)) return true;
  if (!payload || typeof payload !== "object") return false;
  return Array.isArray(payload.questions) || Array.isArray(payload.banks);
}

function rewriteMediaSrc(src, imageMap) {
  const path = normalizeZipPath(src);
  if (!path) return src;
  return imageMap.get(path)
    || imageMap.get(path.split("/").pop())
    || imageMap.get(path.replace(/^images\//, ""))
    || src;
}

function rewriteQuestions(questions, imageMap) {
  return (questions || []).map((question) => {
    if (!question?.media?.length) return question;
    return {
      ...question,
      media: question.media.map((item) => (
        item?.src ? { ...item, src: rewriteMediaSrc(item.src, imageMap) } : item
      ))
    };
  });
}

export function applyZipImagesToPayload(payload, files) {
  const imageMap = new Map();
  for (const file of files) {
    const path = normalizeZipPath(file.name);
    if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(path)) continue;
    const url = bytesToDataUrl(path, file.data);
    imageMap.set(path, url);
    imageMap.set(path.split("/").pop(), url);
    if (path.startsWith("images/")) imageMap.set(path.slice("images/".length), url);
  }
  if (!imageMap.size) return payload;
  if (Array.isArray(payload)) {
    if (payload.some((item) => item && typeof item === "object" && Array.isArray(item.questions))) {
      return payload.map((item) => (
        item?.questions ? { ...item, questions: rewriteQuestions(item.questions, imageMap) } : item
      ));
    }
    return rewriteQuestions(payload, imageMap);
  }
  if (payload?.banks) {
    return {
      ...payload,
      banks: payload.banks.map((bank) => ({
        ...bank,
        questions: rewriteQuestions(bank.questions || [], imageMap)
      }))
    };
  }
  if (payload?.questions) {
    return { ...payload, questions: rewriteQuestions(payload.questions, imageMap) };
  }
  return payload;
}

function parseJsonBytes(bytes) {
  return JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ""));
}

async function parseZipBankPackage(bytes) {
  const files = await unzipStoreFiles(bytes);
  const jsonFiles = files.filter((file) => /\.json$/i.test(normalizeZipPath(file.name)));
  const parsed = [];
  for (const file of jsonFiles) {
    try {
      const payload = parseJsonBytes(file.data);
      parsed.push({
        payload,
        depth: normalizeZipPath(file.name).split("/").filter(Boolean).length
      });
    } catch {
      // skip non-bank json
    }
  }
  parsed.sort((a, b) => a.depth - b.depth);
  const chosen = parsed.find((item) => looksLikeBankPayload(item.payload)) || parsed[0];
  if (!chosen) throw new Error("压缩包里没有有效的题库 JSON。");
  return applyZipImagesToPayload(chosen.payload, files);
}

export async function parseBankPackage(buffer, filename = "") {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (isZipBytes(bytes, filename)) return parseZipBankPackage(bytes);
  return parseJsonBytes(bytes);
}
