import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { zipStoreFiles } from "./zip-store.mjs";
import { buildBankJson } from "./parse-converter-md.mjs";

const banksDir = new URL("../../site/banks/", import.meta.url);
const imagesDir = new URL("../../site/images/", import.meta.url);
const siteDir = new URL("../../site/", import.meta.url);
const manifestPath = new URL("../../site/banks/manifest.json", import.meta.url);

function safeId(value) {
  const text = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return text.slice(0, 80) || `bank-${Date.now().toString(36)}`;
}

function safeFileName(value, fallback = "image.png") {
  const name = basename(String(value || fallback)).replace(/[\\/:*?"<>|]/g, "-");
  return name || fallback;
}

export async function readManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

export async function listBuiltInBanks() {
  const manifest = await readManifest();
  return manifest.banks.map((entry) => ({
    id: entry.id,
    title: entry.title,
    group: entry.group || "未分类",
    description: entry.description || "",
    file: entry.file
  }));
}

function decodeBase64(data) {
  const raw = String(data || "").replace(/^data:[^;]+;base64,/, "");
  return Uint8Array.from(Buffer.from(raw, "base64"));
}

function isKeptMediaSrc(src, bankId) {
  const value = String(src || "").trim();
  if (!value) return false;
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return true;
  return value.startsWith(`images/${bankId}/`);
}

function sanitizeQuestionMedia(questions, bankId) {
  return questions.map((question) => {
    const next = { ...question };
    const media = Array.isArray(next.media) ? next.media : [];
    const kept = [];
    for (const item of media) {
      if (isKeptMediaSrc(item?.src, bankId)) {
        kept.push({
          ...item,
          alt: "题目图片"
        });
        continue;
      }
      const caption = String(item?.caption || "").trim();
      if (caption && !next.material?.content) {
        next.material = { title: "图片说明", content: caption };
      }
    }
    if (kept.length) next.media = kept;
    else delete next.media;
    return next;
  });
}

export async function saveBuiltInBank({
  id,
  title,
  group,
  description,
  questions,
  images = []
}) {
  const manifest = await readManifest();
  const cleanTitle = String(title || "").trim() || "自定义自测题库";
  const cleanGroup = String(group || "").trim() || "未分类";
  const existing = manifest.banks.find((entry) => entry.id === id || entry.title === cleanTitle);
  const bankId = existing?.id || (String(id || "").trim() ? safeId(id) : `bank-${safeId(cleanTitle)}`);
  const jsonFile = existing?.file || `${bankId}.json`;
  const nextQuestions = (questions || []).map((question) => ({ ...question }));

  await mkdir(imagesDir, { recursive: true });
  const imageFolderSafe = new URL(`./${bankId}/`, imagesDir);
  if (images.length) await mkdir(imageFolderSafe, { recursive: true });

  for (const image of images) {
    const question = nextQuestions.find((item) => item.id === image.questionId);
    if (!question) continue;
    const filename = safeFileName(image.filename || `${image.questionId}${extname(image.filename || ".png") || ".png"}`);
    const bytes = image.bytes instanceof Uint8Array ? image.bytes : decodeBase64(image.data || image.base64 || "");
    if (!bytes.length) continue;
    await writeFile(new URL(filename, imageFolderSafe), Buffer.from(bytes));
    const src = `images/${bankId}/${filename}`;
    const caption = String(image.caption || question.media?.[0]?.caption || "").trim();
    question.media = [{
      type: "image",
      src,
      alt: "题目图片",
      caption
    }];
  }

  const bank = buildBankJson(cleanTitle, cleanGroup, sanitizeQuestionMedia(nextQuestions, bankId), {
    id: bankId,
    description: description || `${cleanTitle}。`
  });
  await writeFile(new URL(jsonFile, banksDir), `${JSON.stringify(bank, null, 2)}\n`, "utf8");

  const entry = {
    id: bankId,
    title: cleanTitle,
    description: bank.description,
    group: cleanGroup,
    file: jsonFile
  };
  const index = manifest.banks.findIndex((item) => item.id === bankId);
  if (index >= 0) manifest.banks[index] = entry;
  else manifest.banks.push(entry);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return entry;
}

export async function deleteBuiltInBank(id) {
  const manifest = await readManifest();
  const entry = manifest.banks.find((item) => item.id === id);
  if (!entry) throw new Error("没有找到这套内置题库");
  await rm(new URL(entry.file, banksDir), { force: true });
  await rm(new URL(`./${entry.id}/`, imagesDir), { recursive: true, force: true });
  manifest.banks = manifest.banks.filter((item) => item.id !== id);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { id, title: entry.title };
}

async function collectFiles(dirUrl, prefix = "") {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collectFiles(new URL(`${entry.name}/`, dirUrl), rel));
    } else {
      files.push({
        name: rel.replace(/\\/g, "/"),
        data: new Uint8Array(await readFile(new URL(entry.name, dirUrl)))
      });
    }
  }
  return files;
}

export async function packSiteZip() {
  const files = await collectFiles(siteDir);
  return zipStoreFiles(files);
}
