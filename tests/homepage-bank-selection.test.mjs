import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../site/", import.meta.url);

test("site starts on a home page and exposes question banks through the sidebar", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /id="homePanel"/);
  assert.match(indexHtml, /id="bankList"/);
  assert.match(indexHtml, /loadBuiltInBankCatalog/);
  assert.doesNotMatch(indexHtml, /const defaultQuestions = \[/);
});

test("built-in enterprise management question bank is an external loadable JSON bank", async () => {
  const manifest = JSON.parse(await readFile(new URL("banks/manifest.json", siteRoot), "utf8"));
  const entry = manifest.banks.find((bank) => bank.id === "bank-enterprise-management");

  assert.ok(entry, "manifest should list the enterprise management bank");
  assert.equal(entry.file, "enterprise-management.json");

  const bank = JSON.parse(await readFile(new URL(`banks/${entry.file}`, siteRoot), "utf8"));

  assert.equal(bank.version, 1);
  assert.equal(bank.id, entry.id);
  assert.equal(bank.title, "企业管理与技术经济学");
  assert.ok(Array.isArray(bank.questions));
  assert.ok(bank.questions.length > 0);
  assert.ok(bank.questions.every((question) => question.title && question.answer));
});

test("question-bank navigation is left-first and can return to the home page", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");
  const layout = indexHtml.match(/<section class="layout">([\s\S]*?)<\/section>/)?.[1] || "";

  assert.ok(layout.indexOf('id="bankPanel"') >= 0, "layout should include a bank panel");
  assert.ok(layout.indexOf('id="bankPanel"') < layout.indexOf('id="questionList"'), "bank panel should be before the practice area");
  assert.match(indexHtml, /id="homeBankGrid"/, "home page should show question banks below the intro");
  assert.match(indexHtml, /id="backHome"/, "practice view should expose a way back to the home page");
  assert.match(indexHtml, /id="totalScore"/, "submit results should expose an overall score");
  assert.ok(layout.indexOf("本次概览") < layout.indexOf(">题库<"), "bank picker should come after the session overview");
  assert.ok(layout.indexOf('id="totalScore"') < layout.indexOf('id="bankList"'), "session overview should be above the bank list");
});

test("perfect copied answers can be scored as full marks", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /function exactAnswerMatch/);
  assert.match(indexHtml, /ratio:\s*1/);
  assert.match(indexHtml, /mastered:\s*true/);
});

test("choice questions are separated into single and multiple choice filters", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /singleChoice:\s*"单选题"/);
  assert.match(indexHtml, /multipleChoice:\s*"多选题"/);
  assert.match(indexHtml, /function getQuestionType/);
  assert.match(indexHtml, /question-type-badge/);
});

test("question bank catalog separates built-in local and shared banks", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /data-bank-source-filter="built-in"/);
  assert.match(indexHtml, /data-bank-source-filter="local"/);
  assert.match(indexHtml, /data-bank-source-filter="shared"/);
  assert.match(indexHtml, /function renderBankSection/);
  assert.match(indexHtml, /云端候选/);
  assert.match(indexHtml, /bank-section-grid/);
});

test("single question actions avoid forced page scrolling", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.doesNotMatch(indexHtml, /scrollIntoView\(\{\s*behavior:\s*"smooth"/);
  assert.match(indexHtml, /function preserveScroll/);
  assert.match(indexHtml, /checkOneAndNext\(id,\s*\{\s*advance:\s*false\s*\}\)/);
});

test("import flow lets users choose local or shared bank visibility", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /id="importBankMode"/);
  assert.match(indexHtml, /<select id="importBankMode"/);
  assert.match(indexHtml, /<option value="local"/);
  assert.match(indexHtml, /<option value="shared"/);
  assert.match(indexHtml, /function parseImportedBankPayloads/);
  assert.match(indexHtml, /addQuestionBank\(item\.questions,\s*item\.title,\s*\{/);
  assert.match(indexHtml, /纯静态网页不能直接上传云端/);
  assert.match(indexHtml, /accept="[^"]*\.zip/);
  assert.match(indexHtml, /parseBankPackage/);
  assert.match(indexHtml, /id="studioLink"/);
  assert.doesNotMatch(indexHtml, /class="option-toggle"/);
});

test("converter emits explicit single and multiple choice categories", async () => {
  const converterHtml = await readFile(new URL("converter.html", siteRoot), "utf8");

  assert.match(converterHtml, /value="singleChoice"/);
  assert.match(converterHtml, /value="multipleChoice"/);
  assert.match(converterHtml, /normalizedCategory === "multipleChoice"/);
  assert.match(converterHtml, /分类：单选题/);
  assert.match(converterHtml, /分类：多选题/);
});

test("home sidebar hides practice-only sections until a bank is active", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /id="bankPanel"[^>]*data-mode="home"/);
  assert.match(indexHtml, /practice-side-block/);
  assert.match(indexHtml, /dataset\.mode = "practice"/);
  assert.match(indexHtml, /dataset\.mode = "home"/);
});

test("question cards can display image media from imported banks", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");
  const template = JSON.parse(await readFile(new URL("template.json", siteRoot), "utf8"));

  assert.match(indexHtml, /function normalizeQuestionMedia/);
  assert.match(indexHtml, /function isDisplayableMediaSrc/);
  assert.match(indexHtml, /function renderQuestionMedia/);
  assert.match(indexHtml, /onerror=/);
  assert.match(indexHtml, /cache:\s*"no-store"/);
  assert.match(indexHtml, /normalizeBankSource\(bank\.source\) !== "built-in"/);
  assert.match(indexHtml, /rawMedia = normalizeQuestionMedia\(raw\)/);
  assert.match(indexHtml, /question-media/);
  assert.match(indexHtml, /--question-media-max:\s*150px/);
  assert.match(indexHtml, /data-media-size-slider/);
  assert.match(indexHtml, /function applyMediaSize/);
  assert.match(indexHtml, /enterprise-management-media-size-v1/);
  assert.match(indexHtml, /\.media-size-slider\s*{[\s\S]*margin:\s*0 0 0 auto/);
  assert.match(indexHtml, /\.media-size-slider\s*{[\s\S]*height:\s*168px/);
  assert.match(indexHtml, /id="practiceFilterBar"/);
  assert.match(indexHtml, /\.filter-sticky\s*{[\s\S]*position:\s*sticky/);
  assert.match(indexHtml, /\.toolbar\s*{[\s\S]*position:\s*relative/);
  assert.doesNotMatch(indexHtml, /data-media-size="/);
  assert.doesNotMatch(indexHtml, /id="mediaSizeRow"/);
  assert.ok(template.schema.optional.includes("media"));
  assert.ok(
    template.questions.some((question) => Array.isArray(question.media) && question.media.some((item) => item.type === "image" && item.src)),
    "template should document image-based questions"
  );
});

test("converter accepts image lines and exports question media", async () => {
  const converterHtml = await readFile(new URL("converter.html", siteRoot), "utf8");

  assert.match(converterHtml, /图片[:：]images\/chart\.png/);
  assert.match(converterHtml, /图片说明[:：]管理流程图/);
  assert.match(converterHtml, /function parseQuestionMedia/);
  assert.match(converterHtml, /media:\s*parseQuestionMedia\(block\)/);
  assert.match(converterHtml, /"multiple", "media", "material", "groupId"/);
  assert.match(converterHtml, /下载 ZIP/);
  assert.match(converterHtml, /async function downloadZip/);
  assert.match(converterHtml, /zip-store\.mjs/);
  assert.match(converterHtml, /id="saveBuiltIn"/);
  assert.match(converterHtml, /id="studioLink"/);
  assert.match(converterHtml, /id="saveStatus"/);
  assert.match(converterHtml, /window\.alert\(text\)/);
  assert.match(converterHtml, /id="mdFile"/);
  assert.match(converterHtml, /id="imageFiles"/);
  assert.match(converterHtml, /预览题目/);
  assert.match(converterHtml, /question-pick-item/);
  assert.match(converterHtml, /data-pick-filter/);
});

test("question cards can display shared material passages for case groups", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");
  const template = JSON.parse(await readFile(new URL("template.json", siteRoot), "utf8"));

  assert.match(indexHtml, /function normalizeQuestionMaterial/);
  assert.match(indexHtml, /function renderQuestionMaterial/);
  assert.match(indexHtml, /let material = normalizeQuestionMaterial\(raw\)/);
  assert.match(indexHtml, /groupId:\s*String\(raw\.groupId/);
  assert.match(indexHtml, /question-material/);
  assert.ok(template.schema.optional.includes("material"));
  assert.ok(template.schema.optional.includes("groupId"));
  const materialQuestions = template.questions.filter((question) => question.groupId === "case-001");
  assert.ok(materialQuestions.length >= 2, "template should include multiple questions sharing one material group");
  assert.ok(materialQuestions.every((question) => question.material?.content));
});

test("converter accepts material passages and group ids for case questions", async () => {
  const converterHtml = await readFile(new URL("converter.html", siteRoot), "utf8");

  assert.match(converterHtml, /资料组[:：]case-001/);
  assert.match(converterHtml, /资料标题[:：]案例资料：制造企业转型/);
  assert.match(converterHtml, /资料[:：]某制造企业近三年订单波动明显/);
  assert.match(converterHtml, /function parseQuestionMaterial/);
  assert.match(converterHtml, /material:\s*parseQuestionMaterial\(block\)/);
  assert.match(converterHtml, /groupId:\s*parseQuestionGroupId\(block\)/);
  assert.match(converterHtml, /optional:\s*\["id", "chapter", "category", "prompt", "keywords", "minRequired", "options", "multiple", "media", "material", "groupId"\]/);
});

test("home bank cards keep equal box sizes in each source section", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /\.bank-section-grid\s*{[\s\S]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(220px,\s*1fr\)\)/);
  assert.match(indexHtml, /\.bank-section-grid\s*{[\s\S]*grid-auto-rows:\s*1fr/);
  assert.match(indexHtml, /\.bank-card\s*{[\s\S]*height:\s*100%/);
  assert.match(indexHtml, /\.bank-card\.large\s*{[\s\S]*min-height:\s*150px/);
  assert.match(indexHtml, /\.bank-card-description\s*{/);
});

test("sidebar navigation scrolls independently without changing item layout", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /\.side-panel\s*{[\s\S]*max-height:\s*calc\(100vh - 120px\)/);
  assert.match(indexHtml, /\.side-panel\s*{[\s\S]*overflow:\s*hidden/);
  assert.match(indexHtml, /\.side-panel-scroll\s*{[\s\S]*overflow:\s*auto/);
  assert.match(indexHtml, /\.question-mini-list\s*{[\s\S]*flex-wrap:\s*wrap/);
  assert.match(indexHtml, /id="questionMiniList"/);
  assert.match(indexHtml, /id="bankList"/);
});

test("mobile practice places the question above the built-in bank list", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /id="appShell"[^>]*data-view="home"/);
  assert.match(indexHtml, /function setAppView/);
  assert.match(indexHtml, /class="practice-side-stack"/);
  assert.match(indexHtml, /class="bank-picker"/);
  assert.match(indexHtml, /\.app-shell\[data-view="practice"\] \.question-list\s*{[\s\S]*order:\s*4/);
  assert.match(indexHtml, /\.app-shell\[data-view="practice"\] \.bank-picker\s*{[\s\S]*order:\s*5/);
  assert.doesNotMatch(indexHtml, /id="mobilePracticeDock"/);
  assert.doesNotMatch(indexHtml, /id="mobileJumpSheet"/);
});

test("built-in banks are grouped into expandable collections", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");
  const manifest = JSON.parse(await readFile(new URL("banks/manifest.json", siteRoot), "utf8"));

  assert.match(indexHtml, /data-bank-group-toggle/);
  assert.match(indexHtml, /function groupBanks/);
  assert.match(indexHtml, /function isBankGroupExpanded/);
  assert.match(indexHtml, /function toggleBankGroup/);
  assert.match(indexHtml, /bankGroupFromPayload/);
  assert.ok(manifest.banks.every((bank) => bank.group), "every built-in bank should declare a group");
  assert.ok(new Set(manifest.banks.map((bank) => bank.group)).size >= 2, "built-in banks should use more than one group");
});

test("import flow accepts a catalog of multiple grouped banks", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /payload\.banks/);
  assert.match(indexHtml, /importedBanks\.length > 1/);
  assert.match(indexHtml, /activate:\s*importedBanks\.length === 1/);
});

test("converter emits bank groups and multi-bank catalogs", async () => {
  const converterHtml = await readFile(new URL("converter.html", siteRoot), "utf8");

  assert.match(converterHtml, /id="bankGroup"/);
  assert.match(converterHtml, /题库分类[:：]/);
  assert.match(converterHtml, /题库名称[:：]/);
  assert.match(converterHtml, /function parseBankMeta/);
  assert.match(converterHtml, /function buildBankJson/);
  assert.match(converterHtml, /banks:\s*banks\.map/);
  assert.match(converterHtml, /group,/);
});
