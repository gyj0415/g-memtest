import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseConverterMarkdown, buildBankJson } from "../scripts/lib/parse-converter-md.mjs";
import { zipStoreFiles, unzipStoreFiles } from "../scripts/lib/zip-store.mjs";
import { parseBankPackage } from "../site/bank-import.mjs";
import { listBuiltInBanks } from "../scripts/lib/bank-io.mjs";

const siteRoot = new URL("../site/", import.meta.url);

test("parseConverterMarkdown reads prompt-format markdown and media lines", () => {
  const banks = parseConverterMarkdown(`题库分类：公务员考试
题库名称：第三节课
章节：第一节
分类：单选题
题目：根据图示选择答案
图片：图1.png
图片说明：流程图
选项：
A. 计划
B. 随机
答案：A
`, { defaultTitle: "自定义", defaultGroup: "未分类" });

  assert.equal(banks.length, 1);
  assert.equal(banks[0].title, "第三节课");
  assert.equal(banks[0].group, "公务员考试");
  assert.equal(banks[0].questions.length, 1);
  assert.equal(banks[0].questions[0].category, "singleChoice");
  assert.equal(banks[0].questions[0].media[0].src, "图1.png");
  assert.equal(banks[0].questions[0].media[0].caption, "流程图");
});

test("zip store round-trips json and image files", async () => {
  const json = new TextEncoder().encode(JSON.stringify({ ok: true }));
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const zip = zipStoreFiles([
    { name: "demo.json", data: json },
    { name: "images/q-001.png", data: png }
  ]);
  const files = await unzipStoreFiles(zip);
  assert.equal(files.length, 2);
  assert.deepEqual([...files.find((file) => file.name === "demo.json").data], [...json]);
  assert.deepEqual([...files.find((file) => file.name === "images/q-001.png").data], [...png]);
});

test("imported zip maps image files onto question media data urls", async () => {
  const payload = buildBankJson("带图练习", "测试分类", [{
    id: "q-001",
    chapter: "第一章",
    category: "singleChoice",
    title: "看图作答",
    prompt: "请选择正确答案。",
    keywords: [],
    options: [{ label: "A", text: "计划" }, { label: "B", text: "随机" }],
    multiple: false,
    answer: "A",
    media: [{ type: "image", src: "images/q-001.png", alt: "题目图片", caption: "流程图" }]
  }]);
  const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const zip = zipStoreFiles([
    { name: "带图练习.json", data: new TextEncoder().encode(JSON.stringify(payload)) },
    { name: "images/q-001.png", data: png }
  ]);
  const imported = await parseBankPackage(zip, "带图练习.zip");
  assert.equal(imported.title, "带图练习");
  assert.match(imported.questions[0].media[0].src, /^data:image\/png;base64,/);
});

test("plain json import still works without zip wrapping", async () => {
  const payload = { title: "纯文本", group: "测试", questions: [{ id: "q-001", title: "题", answer: "答" }] };
  const imported = await parseBankPackage(new TextEncoder().encode(JSON.stringify(payload)), "bank.json");
  assert.equal(imported.title, "纯文本");
  assert.equal(imported.questions[0].answer, "答");
});

test("studio page can list and delete built-in banks", async () => {
  const studioHtml = await readFile(new URL("studio.html", siteRoot), "utf8");
  assert.match(studioHtml, /内置题库操作/);
  assert.match(studioHtml, /data-delete=/);
  assert.match(studioHtml, /\/api\/banks\//);
  assert.match(studioHtml, /method: "DELETE"/);
  assert.match(studioHtml, /写入内置题库/);
  assert.match(studioHtml, /npm start/);
  assert.match(studioHtml, /id="saveStatus"/);
  assert.match(studioHtml, /window\.alert\(message\)/);
  assert.match(studioHtml, /question-pick-item/);
  assert.match(studioHtml, /data-pick-filter/);
  assert.match(studioHtml, /id="mdFile"/);
  assert.match(studioHtml, /id="imageFiles"/);
});

test("local start script and bank catalog stay available", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts.start, "node scripts/dev-server.mjs");
  const banks = await listBuiltInBanks();
  assert.ok(banks.length > 0);
  assert.ok(banks.every((bank) => bank.id && bank.file && bank.group));
});
