import { expect, test } from "@playwright/test";

test("converter preview keeps an image question single-choice", async ({ page }) => {
  await page.goto("/converter.html");
  await page.locator("#source").fill(`题库名称：带图单选
分类：单选题
题目：图中是什么？
A. 计划
B. 组织
C. 领导
D. 控制
答案：A
图片：abc.png`);
  await page.getByRole("button", { name: "预览题目" }).click();

  const payload = JSON.parse(await page.locator("#output").inputValue());
  expect(payload.questions[0]).toMatchObject({
    category: "singleChoice",
    answer: "A",
    multiple: false,
    prompt: "请选择正确答案。"
  });
});

test("converter preview keeps a short A: answer before image metadata", async ({ page }) => {
  await page.goto("/converter.html");
  await page.locator("#source").fill(`题目：管理是什么？
A：协调组织资源。
图片：流程.png`);
  await page.getByRole("button", { name: "预览题目" }).click();

  const payload = JSON.parse(await page.locator("#output").inputValue());
  expect(payload.questions[0]).toMatchObject({
    title: "管理是什么？",
    answer: "协调组织资源。"
  });
});

test("converter image preview treats the image address as one attribute", async ({ page }) => {
  await page.goto("/converter.html");
  await page.locator("#source").fill(`题目：看图作答
答案：计划
图片：https://example.invalid/image.png" data-audit-probe="seen`);
  await page.getByRole("button", { name: "预览题目" }).click();

  const preview = page.locator("#mediaList img.preview");
  await expect(preview).toHaveCount(1);
  await expect(preview).not.toHaveAttribute("data-audit-probe");
});
