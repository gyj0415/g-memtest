import { expect, test } from "@playwright/test";

async function startEnterpriseBank(page) {
  await page.goto("/");
  const home = page.locator("#homeBankGrid");
  const bank = home.getByRole("button", { name: /企业管理与技术经济学/ });
  if (!(await bank.isVisible())) {
    await home.getByRole("button", { name: /^企业管理 1 套/ }).click();
  }
  await bank.click();
}

async function importQuestionBank(page, payload) {
  await page.goto("/");
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#importBank").setInputFiles({
    name: "test-bank.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload))
  });
}

test("imported question text stays text instead of running HTML", async ({ page }) => {
  await page.goto("/");
  page.on("dialog", (dialog) => dialog.accept());
  const markup = '<img src=x onerror="document.documentElement.dataset.importedMarkup=1">';
  const payload = {
    title: "安全测试",
    questions: [{ id: "q-1", title: markup, prompt: markup, answer: "A" }]
  };

  await page.locator("#importBank").setInputFiles({
    name: "test-bank.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload))
  });
  await expect(page.locator(".question-card h2")).toHaveText(markup);
  await expect(page.locator(".question-card .prompt")).toHaveText(markup);
  await expect(page.locator("html")).not.toHaveAttribute("data-imported-markup", "1");
  await expect(page.locator(".question-card img")).toHaveCount(0);
});

test("imported question ids and options cannot create HTML elements", async ({ page }) => {
  await page.goto("/");
  page.on("dialog", (dialog) => dialog.accept());
  const injectedId = 'q-1"><img src=x onerror="document.documentElement.dataset.idMarkup=1">';
  const injectedLabel = 'A"><img src=x onerror="document.documentElement.dataset.optionMarkup=1">';
  const payload = {
    title: "属性安全测试",
    questions: [{
      id: injectedId,
      title: "普通题目",
      category: "singleChoice",
      options: [{ label: injectedLabel, text: "选项一" }, { label: "B", text: "选项二" }],
      answer: "B"
    }]
  };

  await page.locator("#importBank").setInputFiles({
    name: "test-bank.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(payload))
  });
  await expect(page.locator(".question-card h2")).toHaveText("普通题目");
  await expect(page.locator("html")).not.toHaveAttribute("data-id-markup", "1");
  await expect(page.locator("html")).not.toHaveAttribute("data-option-markup", "1");
  await expect(page.locator(".question-card img")).toHaveCount(0);
});

test("editing a checked written answer clears its score until checked again", async ({ page }) => {
  await startEnterpriseBank(page);
  const answer = page.getByRole("textbox", { name: "在这里默写答案，写完点判分。" });
  await answer.fill("企业重心两极化是指企业的重点部门由生产部门转向研究开发和市场销售部门，企业结构由中间大的橄榄型转变为两头大的哑铃型。");
  await page.getByRole("button", { name: "判分", exact: true }).click();
  await expect(page.locator(".question-card .status-pill")).toHaveText("掌握");

  await answer.fill("");
  await expect(page.locator(".question-card .status-pill")).toHaveText("未判");
  await expect(page.locator("#checkedCount")).toHaveText("0/26");
  await expect(page.locator("#totalScore")).toHaveText("0%");
  await page.reload();
  await startEnterpriseBank(page);
  await expect(page.locator(".question-card .status-pill")).toHaveText("未判");
});

test("reversed formula inequalities cannot receive full credit", async ({ page }) => {
  await importQuestionBank(page, {
    title: "公式比较测试",
    questions: [{
      id: "formula-compare",
      title: "净现值判断",
      category: "formula",
      prompt: "填写公式及判断条件。",
      answer: "NPV > 0 可行；NPV < 0 不可行。",
      keywords: ["NPV>0", "NPV<0"]
    }]
  });
  const answer = page.getByRole("textbox", { name: "在这里默写答案，写完点判分。" });

  for (const reversed of ["NPV < 0 可行；NPV > 0 不可行。", "NPV ＜ 0 可行；NPV ＞ 0 不可行。"]) {
    await answer.fill(reversed);
    await page.getByRole("button", { name: "判分", exact: true }).click();
    await expect(page.locator("#totalScore")).not.toHaveText("100%");
    await expect(page.locator(".question-card .status-pill")).not.toHaveText("掌握");
  }

  await answer.fill("NPV ＞ 0 可行；NPV ＜ 0 不可行。");
  await page.getByRole("button", { name: "判分", exact: true }).click();
  await expect(page.locator("#totalScore")).toHaveText("100%");
  await expect(page.locator(".question-card .status-pill")).toHaveText("掌握");
});

test("updated built-in banks discard deleted and rescored questions", async ({ page }) => {
  let questions = [
    { id: "first", title: "第一题", chapter: "第一章", answer: "原答案" },
    { id: "removed", title: "第二题", chapter: "第二章", answer: "第二答案" }
  ];
  await page.route("**/banks/manifest.json", (route) => route.fulfill({
    json: { banks: [{ id: "bank-update-test", file: "update-test.json", title: "更新测试题库", group: "更新测试" }] }
  }));
  await page.route("**/banks/update-test.json", (route) => route.fulfill({
    json: { id: "bank-update-test", title: "更新测试题库", group: "更新测试", questions }
  }));
  const openBank = async () => {
    await page.goto("/");
    await page.locator("#homeBankGrid").getByRole("button", { name: /更新测试题库/ }).click();
  };
  await openBank();
  await page.getByRole("textbox", { name: "在这里默写答案，写完点判分。" }).fill("原答案");
  await page.getByRole("button", { name: "判分", exact: true }).click();
  await page.getByRole("button", { name: "下一题", exact: true }).click();
  await page.getByRole("button", { name: "判分", exact: true }).click();
  await expect(page.locator("#checkedCount")).toHaveText("2/2");

  questions = questions.slice(0, 1);
  await openBank();
  await expect(page.locator("#checkedCount")).toHaveText("1/1");
  await expect(page.locator("#heroDone")).toHaveText("1");
  await expect(page.locator(".question-card .status-pill")).toHaveText("掌握");
  await expect(page.locator("#progressFill")).toHaveAttribute("style", "width: 100%;");

  questions = [{ ...questions[0], answer: "新答案" }];
  await openBank();
  await expect(page.locator("#checkedCount")).toHaveText("0/1");
  await expect(page.locator("#totalScore")).toHaveText("0%");
  await expect(page.locator(".question-card .status-pill")).toHaveText("未判");
});

test("review titles jump to missed questions across chapter filters", async ({ page }) => {
  await importQuestionBank(page, {
    title: "错题跳转测试",
    questions: [
      { id: "chapter-one", title: "第一章题", chapter: "第一章", answer: "第一答案" },
      { id: "chapter-two", title: "第二章题", chapter: "第二章", answer: "第二答案" }
    ]
  });
  await page.getByRole("button", { name: "交卷判分" }).click();
  await page.locator("#chapterFilterRow").getByRole("button", { name: "第一章" }).click();
  await expect(page.locator(".question-card h2")).toHaveText("第一章题");
  await page.locator("#reviewList .review-item strong").filter({ hasText: "第二章题" }).click();
  await expect(page.locator(".question-card h2")).toHaveText("第二章题");
  await expect(page.locator("#chapterFilterRow").getByRole("button", { name: "全部" })).toHaveClass(/active/);
});

test("the new twenty-question bank opens without horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const home = page.locator("#homeBankGrid");
  const group = home.locator('.bank-group[data-bank-group="公务员考试"]');
  const bank = group.getByRole("button", { name: /补充题目 20 题/ });
  if (!(await bank.isVisible())) await group.locator(".bank-group-toggle").click();
  await bank.click();
  await expect(page.locator("#heroTotal")).toHaveText("20");
  await expect(page.locator(".question-card h2")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator(".question-card h2")).toBeVisible();
});

test("failed multi-bank import leaves no partial banks after reload", async ({ page }) => {
  const alerts = [];
  await page.goto("/");
  page.on("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.accept();
  });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "enterprise-management-bank-library-v1" && value.includes("批量卷乙")) {
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.locator("#importBank").setInputFiles({
    name: "multi-bank.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({
      banks: [
        { title: "批量卷甲", questions: [{ title: "甲题", answer: "甲答案" }] },
        { title: "批量卷乙", questions: [{ title: "乙题", answer: "乙答案" }] }
      ]
    }))
  });
  await expect.poll(() => alerts.some((message) => message.includes("导入失败"))).toBeTruthy();
  await page.reload();
  await expect(page.locator("#homeBankGrid .bank-card").filter({ hasText: /批量卷甲|批量卷乙/ })).toHaveCount(0);
});
