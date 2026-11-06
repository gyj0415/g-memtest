import assert from "node:assert/strict";
import test from "node:test";
import { parseConverterMarkdown } from "../scripts/lib/parse-converter-md.mjs";

test("a single-choice answer stays single-choice when an image follows it", () => {
  const banks = parseConverterMarkdown(`题库名称：带图单选
分类：单选题
题目：图中是什么？
选项：
A. 计划
B. 组织
C. 领导
D. 控制
答案：A
图片：abc.png
图片说明：流程图`);
  const question = banks[0].questions[0];

  assert.equal(question.answer, "A");
  assert.equal(question.multiple, false);
  assert.equal(question.prompt, "请选择正确答案。");
  assert.equal(question.media[0].src, "abc.png");
});

test("a multiple-choice answer keeps only its selected options when an image follows it", () => {
  const banks = parseConverterMarkdown(`分类：多选题
题目：哪些属于管理职能？
A. 计划
B. 赌博
C. 组织
D. 凑数
答案：A、C
图片：图1.png`);
  const question = banks[0].questions[0];

  assert.equal(question.answer, "A,C");
  assert.equal(question.multiple, true);
  assert.equal(question.prompt, "请选择所有正确答案。");
});

test("a written answer may span lines before image metadata", () => {
  const banks = parseConverterMarkdown(`分类：简答题
题目：请概括管理过程。
答案：先制定计划。
再组织实施并检查结果。
图片：流程.png
图片说明：管理流程`);
  const question = banks[0].questions[0];

  assert.equal(question.answer, "先制定计划。\n再组织实施并检查结果。");
  assert.equal(question.media[0].src, "流程.png");
});

test("studio preview accepts a short A: answer before image metadata", () => {
  const banks = parseConverterMarkdown(`题目：管理是什么？
A：协调组织资源。
图片：流程.png`);

  assert.equal(banks.length, 1);
  assert.equal(banks[0].questions[0].answer, "协调组织资源。");
  assert.equal(banks[0].questions[0].media[0].src, "流程.png");
});
