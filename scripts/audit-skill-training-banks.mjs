import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const banksDir = new URL("../site/banks/", import.meta.url);
const files = (await readdir(banksDir)).filter((name) => name.startsWith("hcia-") || name.startsWith("hcip-"));
const problems = [];
let judgeCount = 0;

for (const file of files) {
  const bank = JSON.parse(await readFile(new URL(file, banksDir), "utf8"));
  for (const question of bank.questions) {
    const optionTexts = (question.options || []).map((item) => item.text);
    if (optionTexts.some((text) => /^- \*\*|\*\*true\*\*|\*\*false\*\*/i.test(text))) {
      problems.push(`${file} ${question.id} 选项含 markdown：${optionTexts.join(" | ")}`);
    }
    if (question.category === "quick") {
      judgeCount += 1;
      const labels = (question.options || []).map((item) => `${item.label}:${item.text}`).join(",");
      if (labels !== "A:正确,B:错误") {
        problems.push(`${file} ${question.id} 判断题选项异常：${labels}`);
      }
      if (!["A", "B"].includes(question.answer)) {
        problems.push(`${file} ${question.id} 判断题答案异常：${question.answer}`);
      }
    }
    if (question.category === "singleChoice" || question.category === "multipleChoice") {
      if (!question.options || question.options.length < 2) {
        problems.push(`${file} ${question.id} 选择题选项不足`);
      }
      const expected = question.answer.split(",").filter(Boolean);
      const labels = new Set((question.options || []).map((item) => item.label));
      if (expected.some((item) => !labels.has(item))) {
        problems.push(`${file} ${question.id} 答案 ${question.answer} 不在选项 ${[...labels].join("")} 中`);
      }
    }
    if (!question.title || !question.answer) {
      problems.push(`${file} ${question.id} 缺题干或答案`);
    }
  }
}

if (problems.length) {
  console.error(JSON.stringify({ judgeCount, problemCount: problems.length, problems }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, files: files.length, judgeCount, problemCount: 0 }, null, 2));
