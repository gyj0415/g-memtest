import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Script } from "node:vm";

const root = new URL("../", import.meta.url);
const siteRoot = new URL("site/", root);
const mode = process.argv[2];

if (!["typecheck", "lint"].includes(mode)) {
  throw new Error("Usage: node scripts/check-site.mjs <typecheck|lint>");
}

async function readText(relativePath) {
  return readFile(new URL(relativePath, siteRoot), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function listFiles(relativePath) {
  return readdir(new URL(relativePath, siteRoot));
}

function extractScripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((script) => script.trim());
}

async function typecheck() {
  const siteFiles = await listFiles(".");
  const htmlFiles = siteFiles.filter((file) => file.endsWith(".html"));
  const jsonFiles = [
    "template.json",
    "banks/manifest.json",
    ...((await listFiles("banks")).filter((file) => file.endsWith(".json") && file !== "manifest.json").map((file) => join("banks", file).replace(/\\/g, "/")))
  ];

  for (const file of htmlFiles) {
    const html = await readText(file);
    for (const script of extractScripts(html)) {
      new Script(script, { filename: file });
    }
  }

  for (const file of jsonFiles) {
    await readJson(file);
  }
}

function assertQuestionBankShape(bank, file) {
  assert.equal(bank.version, 1, `${file} should use schema version 1`);
  assert.ok(bank.id, `${file} should include a stable bank id`);
  assert.ok(bank.title, `${file} should include a title`);
  assert.ok(Array.isArray(bank.questions), `${file} should include questions[]`);
  assert.ok(bank.questions.length > 0, `${file} should include at least one question`);

  const ids = new Set();
  bank.questions.forEach((question, index) => {
    assert.ok(question.id, `${file} question ${index + 1} should include id`);
    assert.ok(!ids.has(question.id), `${file} duplicate question id: ${question.id}`);
    ids.add(question.id);
    assert.ok(question.title, `${file} question ${question.id} should include title`);
    assert.ok(question.answer, `${file} question ${question.id} should include answer`);
    assert.ok(question.category, `${file} question ${question.id} should include category`);
  });
}

async function lint() {
  const indexHtml = await readText("index.html");
  assert.match(indexHtml, /id="homePanel"/, "index.html should start from a home panel");
  assert.match(indexHtml, /id="bankList"/, "index.html should expose the sidebar bank list");
  assert.match(indexHtml, /loadBuiltInBankCatalog/, "index.html should load the built-in bank catalog");
  assert.doesNotMatch(indexHtml, /const defaultQuestions = \[/, "default question banks should not be embedded in index.html");

  const manifest = await readJson("banks/manifest.json");
  assert.equal(manifest.version, 1, "manifest should use schema version 1");
  assert.ok(Array.isArray(manifest.banks), "manifest should include banks[]");
  assert.ok(manifest.banks.length > 0, "manifest should list at least one built-in bank");

  const seen = new Set();
  for (const entry of manifest.banks) {
    assert.ok(entry.id, "manifest bank entry should include id");
    assert.ok(!seen.has(entry.id), `manifest duplicate bank id: ${entry.id}`);
    seen.add(entry.id);
    assert.ok(entry.title, `manifest entry ${entry.id} should include title`);
    assert.ok(entry.file, `manifest entry ${entry.id} should include file`);

    const bank = await readJson(`banks/${entry.file}`);
    assert.equal(bank.id, entry.id, `bank file ${entry.file} id should match manifest`);
    assert.equal(bank.title, entry.title, `bank file ${entry.file} title should match manifest`);
    assertQuestionBankShape(bank, `banks/${entry.file}`);
  }
}

if (mode === "typecheck") {
  await typecheck();
} else {
  await lint();
}
