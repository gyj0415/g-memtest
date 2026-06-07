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
});

test("perfect copied answers can be scored as full marks", async () => {
  const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");

  assert.match(indexHtml, /function exactAnswerMatch/);
  assert.match(indexHtml, /ratio:\s*1/);
  assert.match(indexHtml, /mastered:\s*true/);
});
