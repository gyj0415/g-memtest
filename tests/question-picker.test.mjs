import assert from "node:assert/strict";
import test from "node:test";
import {
  flattenBankQuestions,
  questionImageState,
  pickDefaultFilter,
  pickDefaultKey,
  filterItems,
  matchImageFiles
} from "../site/question-picker.mjs";

const banks = [{
  title: "练习",
  group: "测试",
  questions: [
    { id: "q-001", title: "无图题", category: "short", answer: "答" },
    { id: "q-002", title: "待配图", category: "singleChoice", answer: "A", media: [{ type: "image", src: "图1.png", caption: "流程图" }] },
    { id: "q-003", title: "已有图", category: "singleChoice", answer: "B", media: [{ type: "image", src: "data:image/png;base64,xx" }] }
  ]
}];

test("question picker marks pending vs ready vs empty", () => {
  const items = flattenBankQuestions(banks);
  const chosen = new Map();
  assert.equal(questionImageState(items[0].question, chosen.get(items[0].key)), "empty");
  assert.equal(questionImageState(items[1].question, chosen.get(items[1].key)), "pending");
  assert.equal(questionImageState(items[2].question, chosen.get(items[2].key)), "ready");
});

test("default filter and key prefer pending then ready", () => {
  const items = flattenBankQuestions(banks);
  const getChosen = () => undefined;
  assert.equal(pickDefaultFilter(items, getChosen), "pending");
  assert.equal(pickDefaultKey(items, "pending", getChosen), "0:q-002");
  assert.equal(filterItems(items, "pending", getChosen).length, 1);
  assert.equal(filterItems(items, "ready", getChosen).length, 1);
  assert.equal(filterItems(items, "all", getChosen).length, 3);
});

test("matchImageFiles attaches by markdown image filename", () => {
  const file = { name: "图1.png" };
  const updates = matchImageFiles(banks, [file]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].key, "0:q-002");
  assert.equal(updates[0].caption, "流程图");
});
