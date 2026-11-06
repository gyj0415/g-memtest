import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import * as picker from "../site/question-picker.mjs";

const studioUrl = new URL("../site/studio.html", import.meta.url);
const projectRoot = new URL("../", import.meta.url);

function createElement(value = "") {
  const listeners = new Map();
  return {
    value,
    files: [],
    textContent: "",
    className: "",
    innerHTML: "",
    disabled: false,
    dataset: {},
    scrollIntoView() {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type) {
      return listeners.get(type)?.({ target: this, currentTarget: this });
    }
  };
}

async function saveStudioPreview(banks, enteredTitle, listedBanks = []) {
  const elements = new Map([
    "#status", "#bankList", "#previewList", "#saveStatus", "#groupInput",
    "#titleInput", "#mdFile", "#mdText", "#imageFiles", "#previewBtn",
    "#saveBtn", "#packBtn"
  ].map((selector) => [selector, createElement()]));
  elements.get("#titleInput").value = enteredTitle;
  elements.get("#mdText").value = "题目：示例\n答案：示例";

  const saved = [];
  const fetch = async (url, options = {}) => {
    if (url === "/api/health") return { ok: true };
    if (url === "/api/banks" && options.method === "POST") {
      saved.push(JSON.parse(options.body));
      return { ok: true };
    }
    if (url === "/api/banks") return { ok: true, json: async () => ({ banks: listedBanks }) };
    if (url === "/api/preview-md") return { ok: true, json: async () => ({ banks }) };
    throw new Error(`Unexpected request: ${url}`);
  };

  const html = await readFile(studioUrl, "utf8");
  const moduleScript = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(moduleScript, "studio module script should exist");
  const script = moduleScript.replace(
    /import\s*\{[\s\S]*?\}\s*from "\.\/question-picker\.mjs";/,
    ""
  );
  runInNewContext(script, {
    ...picker,
    document: {
      body: { classList: { add() {} } },
      querySelector: (selector) => elements.get(selector)
    },
    fetch,
    window: { alert() {} },
    URL,
    btoa
  }, { filename: "studio.html" });

  await elements.get("#previewBtn").dispatch("click");
  await elements.get("#saveBtn").dispatch("click");
  return { saved, elements };
}

test("studio saves each named bank from a multi-bank preview separately", async () => {
  const banks = [
    { title: "第一套", group: "测试", questions: [{ id: "q-001", title: "甲", answer: "甲" }] },
    { title: "第二套", group: "测试", questions: [{ id: "q-001", title: "乙", answer: "乙" }] }
  ];
  const { saved } = await saveStudioPreview(banks, "统一名称");
  assert.deepEqual(saved.map((bank) => bank.title), ["第一套", "第二套"]);
});

test("studio still allows renaming one bank before saving", async () => {
  const banks = [{ title: "原名称", group: "测试", questions: [{ id: "q-001", title: "甲", answer: "甲" }] }];
  const { saved } = await saveStudioPreview(banks, "新名称");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].title, "新名称");
});

test("studio bank list treats bank metadata as text rather than markup", async () => {
  const banks = [{ title: "原名称", group: "测试", questions: [{ id: "q-001", title: "甲", answer: "甲" }] }];
  const listed = [{
    group: "<img src=x onerror=1>",
    title: "合法题库<img src=x onerror=1>",
    id: 'bank" onmouseover="1',
    file: "bank<file>.json"
  }];
  const { elements } = await saveStudioPreview(banks, "", listed);
  const html = elements.get("#bankList").innerHTML;
  assert.match(html, /&lt;img src=x onerror=1&gt;/);
  assert.match(html, /合法题库&lt;img src=x onerror=1&gt;/);
  assert.match(html, /data-delete="bank&quot; onmouseover=&quot;1"/);
  assert.match(html, /bank&lt;file&gt;\.json/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /data-delete="bank" onmouseover/);
});

test("studio image preview keeps media URLs inside the src attribute", async () => {
  const banks = [{
    title: "图题",
    group: "测试",
    questions: [{
      id: "q-001",
      title: "看图",
      answer: "A",
      media: [{ src: 'https://example.invalid/scan.png" onerror="1' }]
    }]
  }];
  const { elements } = await saveStudioPreview(banks, "");
  const html = elements.get("#previewList").innerHTML;
  assert.match(html, /src="https:\/\/example\.invalid\/scan\.png&quot; onerror=&quot;1"/);
  assert.doesNotMatch(html, /src="https:\/\/example\.invalid\/scan\.png" onerror=/);
});

async function createBankIoFixture(t) {
  const fixture = await mkdtemp(join(tmpdir(), "gmem-studio-"));
  t.after(async () => {
    const actualParent = await realpath(dirname(fixture));
    const expectedParent = await realpath(tmpdir());
    if (actualParent !== expectedParent) throw new Error("Unexpected fixture directory");
    await rm(fixture, { recursive: true, force: true });
  });
  await mkdir(join(fixture, "scripts", "lib"), { recursive: true });
  await mkdir(join(fixture, "site", "banks"), { recursive: true });
  await mkdir(join(fixture, "site", "images"), { recursive: true });
  for (const filename of ["bank-io.mjs", "zip-store.mjs", "parse-converter-md.mjs"]) {
    await copyFile(new URL(`scripts/lib/${filename}`, projectRoot), join(fixture, "scripts", "lib", filename));
  }
  await copyFile(new URL("site/zip-store.mjs", projectRoot), join(fixture, "site", "zip-store.mjs"));
  await writeFile(join(fixture, "site", "banks", "manifest.json"), '{"version":1,"banks":[]}');

  const { saveBuiltInBank } = await import(pathToFileURL(join(fixture, "scripts", "lib", "bank-io.mjs")).href);
  return { fixture, saveBuiltInBank };
}

test("built-in bank keeps distinct image content for questions using the same filename", async (t) => {
  const { fixture, saveBuiltInBank } = await createBankIoFixture(t);
  const first = Uint8Array.of(1, 2, 3);
  const second = Uint8Array.of(4, 5, 6);
  const entry = await saveBuiltInBank({
    title: "同名图片测试",
    group: "测试",
    questions: [
      { id: "q-001", title: "第一题", answer: "A" },
      { id: "q-002", title: "第二题", answer: "B" }
    ],
    images: [
      { questionId: "q-001", filename: "scan.png", bytes: first },
      { questionId: "q-002", filename: "scan.png", bytes: second }
    ]
  });
  const bank = JSON.parse(await readFile(join(fixture, "site", "banks", entry.file), "utf8"));
  const [firstSrc, secondSrc] = bank.questions.map((question) => question.media[0].src);
  assert.notEqual(firstSrc, secondSrc);
  assert.deepEqual(new Uint8Array(await readFile(join(fixture, "site", firstSrc))), first);
  assert.deepEqual(new Uint8Array(await readFile(join(fixture, "site", secondSrc))), second);
});

test("replacing one question image preserves another question image with the same filename", async (t) => {
  const { fixture, saveBuiltInBank } = await createBankIoFixture(t);
  const questions = [
    { id: "q-001", title: "第一题", answer: "A" },
    { id: "q-002", title: "第二题", answer: "B" }
  ];
  const original = Uint8Array.of(1, 2, 3);
  const entry = await saveBuiltInBank({
    title: "局部换图",
    questions,
    images: [{ questionId: "q-001", filename: "scan.png", bytes: original }]
  });
  const priorBank = JSON.parse(await readFile(join(fixture, "site", "banks", entry.file), "utf8"));
  const preservedSrc = priorBank.questions[0].media[0].src;
  const replacement = Uint8Array.of(4, 5, 6);
  await saveBuiltInBank({
    id: entry.id,
    title: "局部换图",
    questions: priorBank.questions,
    images: [{ questionId: "q-002", filename: "scan.png", bytes: replacement }]
  });
  const updated = JSON.parse(await readFile(join(fixture, "site", "banks", entry.file), "utf8"));
  assert.equal(updated.questions[0].media[0].src, preservedSrc);
  assert.deepEqual(new Uint8Array(await readFile(join(fixture, "site", preservedSrc))), original);
  assert.deepEqual(new Uint8Array(await readFile(join(fixture, "site", updated.questions[1].media[0].src))), replacement);
});

test("built-in bank saves an image whose filename contains a percent sign", async (t) => {
  const { fixture, saveBuiltInBank } = await createBankIoFixture(t);
  const bytes = Uint8Array.of(10, 20, 30);
  const entry = await saveBuiltInBank({
    title: "百分号图片",
    questions: [{ id: "q-001", title: "看图", answer: "A" }],
    images: [{ questionId: "q-001", filename: "100%.png", bytes }]
  });
  const bank = JSON.parse(await readFile(join(fixture, "site", "banks", entry.file), "utf8"));
  const src = bank.questions[0].media[0].src;
  assert.deepEqual(new Uint8Array(await readFile(join(fixture, "site", src))), bytes);
});

test("built-in bank image URL resolves to the saved file when filename contains a hash", async (t) => {
  const { fixture, saveBuiltInBank } = await createBankIoFixture(t);
  const bytes = Uint8Array.of(40, 50, 60);
  const entry = await saveBuiltInBank({
    title: "井号图片",
    questions: [{ id: "q-001", title: "看图", answer: "A" }],
    images: [{ questionId: "q-001", filename: "scan#2.png", bytes }]
  });
  const bank = JSON.parse(await readFile(join(fixture, "site", "banks", entry.file), "utf8"));
  const src = bank.questions[0].media[0].src;
  assert.deepEqual(new Uint8Array(await readFile(join(fixture, "site", src))), bytes);
});

test("built-in banks with the same title in different groups retain separate JSON and manifest entries", async (t) => {
  const { fixture, saveBuiltInBank } = await createBankIoFixture(t);
  const first = await saveBuiltInBank({
    title: "期末自测",
    group: "第一章",
    questions: [{ id: "q-001", title: "第一章的题", answer: "A" }]
  });
  const second = await saveBuiltInBank({
    title: "期末自测",
    group: "第二章",
    questions: [{ id: "q-002", title: "第二章的题", answer: "B" }]
  });
  const manifest = JSON.parse(await readFile(join(fixture, "site", "banks", "manifest.json"), "utf8"));
  assert.notEqual(first.id, second.id);
  assert.equal(manifest.banks.length, 2);
  assert.deepEqual(manifest.banks.map((bank) => bank.group), ["第一章", "第二章"]);
  const firstBank = JSON.parse(await readFile(join(fixture, "site", "banks", first.file), "utf8"));
  const secondBank = JSON.parse(await readFile(join(fixture, "site", "banks", second.file), "utf8"));
  assert.equal(firstBank.questions[0].title, "第一章的题");
  assert.equal(secondBank.questions[0].title, "第二章的题");
});
