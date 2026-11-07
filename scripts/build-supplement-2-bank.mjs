import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBankJson } from "./lib/parse-converter-md.mjs";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("用法：node scripts/build-supplement-2-bank.mjs <补充2题目整理.md>");
}

const bankId = "bank-公务员考试·补充题目2";
const bankFile = `${bankId}.json`;
const banksDir = fileURLToPath(new URL("../site/banks/", import.meta.url));
const imagesDir = fileURLToPath(new URL(`../site/images/${bankId}/`, import.meta.url));
const source = (await readFile(sourcePath, "utf8")).replace(/\r/g, "");
const sections = [...source.matchAll(/^## 第(\d+)题[^\n]*\n([\s\S]*?)(?=^## 第\d+题|^## 附：|(?![\s\S]))/gm)];

const chapters = {
  1: "政治理论", 2: "政治理论", 3: "言语理解与表达", 4: "数量关系",
  5: "图形推理", 6: "政治理论", 7: "法律常识", 8: "法律常识",
  9: "法律常识", 10: "经济常识", 11: "定义判断", 12: "定义判断",
  13: "定义判断", 14: "图形推理", 15: "图形推理", 16: "图形推理",
  17: "逻辑推理", 18: "类比推理", 19: "数量关系", 20: "数量关系",
  21: "数量关系", 22: "数量关系", 23: "数量关系", 24: "数量关系",
  25: "数量关系", 26: "数量关系", 27: "数量关系", 28: "数量关系",
  29: "常识判断", 30: "言语理解与表达", 31: "逻辑推理",
  32: "定义判断", 33: "政治理论", 34: "政治理论",
  35: "政治理论", 36: "政治理论", 37: "政治理论",
  38: "政治理论", 39: "法律常识", 40: "法律常识"
};

// The source's marked answers for 10, 11, and 21 conflict with their options.
const correctedAnswers = new Map([[10, "A"], [11, "B"], [21, "A"]]);
const images = new Set();

function makeQuestion(number, title, options, answer, imageName) {
  assert.ok(title && /^[A-D]$/.test(answer), `第${number}题题干或答案缺失`);
  assert.deepEqual(options.map(({ label }) => label), ["A", "B", "C", "D"], `第${number}题选项不完整`);
  const question = {
    id: `q-${String(number).padStart(3, "0")}`,
    chapter: chapters[number],
    category: "singleChoice",
    title,
    prompt: "请选择正确答案。",
    keywords: [],
    options,
    multiple: false,
    answer
  };
  if (imageName) {
    images.add(imageName);
    question.media = [{
      type: "image",
      src: `images/${bankId}/${imageName}`,
      alt: "题目图片"
    }];
  }
  return question;
}

function parseOptions(text) {
  return [...text.matchAll(/^([A-D])\.\s*(.+)$/gm)]
    .map((match) => ({ label: match[1], text: match[2].trim() }));
}

function cleanTitle(text) {
  return text
    .trim()
    .replace(/^【13】83\.\s*/, "")
    .replace(/^（(?:图形题|题干配图|本题另有)[^\n]*）\s*$/gm, "")
    .replace(/^!\[[^\]]*\]\([^)]+\)\s*$/gm, "")
    .trim();
}

function parseAnalogy(number, body) {
  const examples = [...body.matchAll(/^\*\*例([1-3])\.\s*([^*]+)\*\*\s*\n([\s\S]*?)(?=^\*\*例[1-3]\.|^\*\*答案：)/gm)];
  assert.equal(examples.length, 3, "第18题应包含三个类比小题");
  const parts = examples.map((entry, index) => {
    const options = parseOptions(entry[3]);
    assert.deepEqual(options.map(({ label }) => label), ["A", "B", "C", "D"]);
    if (index === 1) {
      // The source has four valid pairs of equivalent names; repair distractors.
      options[0].text = "西红柿：辣椒";
      options[1].text = "土豆：红薯";
      options[3].text = "医生：护士";
    }
    return `例${index + 1}. ${entry[2].trim()}\n${options.map(({ label, text }) => `${label}. ${text}`).join("\n")}`;
  });
  return {
    id: `q-${String(number).padStart(3, "0")}`,
    chapter: chapters[number],
    category: "custom",
    title: `同一/全同关系：选择与每组题干关系相同的一项。\n\n${parts.join("\n\n")}`,
    prompt: "按例1、例2、例3的顺序输入三个选项字母（如 ABC）。",
    keywords: [],
    answer: "C C D"
  };
}

const questions = [];
for (const section of sections) {
  const number = Number(section[1]);
  const body = section[2];
  if (number === 18) {
    questions.push(parseAnalogy(number, body));
    continue;
  }
  const answer = correctedAnswers.get(number) || body.match(/^\*\*答案：([A-D])(?:[（*]|$)/m)?.[1];
  const imageName = body.match(/^!\[[^\]]*\]\(images\/([^)]+)\)/m)?.[1];
  const optionStart = body.search(/^A\.\s/m);
  const imageOnlyOptions = number === 14 || number === 16;
  assert.ok(optionStart >= 0 || imageOnlyOptions, `第${number}题缺少选项`);
  const title = cleanTitle(body.slice(0, optionStart >= 0 ? optionStart : body.search(/^\*\*答案：/m)));
  const options = optionStart >= 0 ? parseOptions(body.slice(optionStart)) : [];

  if (number === 6) {
    // "持续性" in the DOCX makes every option false; the intended pair is 普遍性/特殊性.
    options[2].text = options[2].text.replace("矛盾的持续性", "矛盾的特殊性");
  }
  if (imageOnlyOptions) {
    for (const label of ["A", "B", "C", "D"]) options.push({ label, text: `图中 ${label} 项` });
  }
  questions.push(makeQuestion(number, title, options, answer, imageName));
}

assert.equal(sections.length, 40, "预计40个原文题号");
assert.equal(questions.length, 40, "预计按原文题号共40题");
assert.equal(images.size, 6, "预计6张题图");
const bank = buildBankJson("补充题目（二）", "公务员考试", questions, {
  id: bankId,
  description: "公务员素养课上题目补充练习，共40题。"
});
const manifestPath = join(banksDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entry = {
  id: bankId,
  title: bank.title,
  description: bank.description,
  group: bank.group,
  file: bankFile
};

await mkdir(imagesDir, { recursive: true });
for (const image of images) {
  await copyFile(join(dirname(sourcePath), "images", image), join(imagesDir, image));
}
await writeFile(join(banksDir, bankFile), `${JSON.stringify(bank, null, 2)}\n`, "utf8");
const existing = manifest.banks.findIndex((item) => item.id === bankId);
if (existing < 0) manifest.banks.push(entry);
else manifest.banks[existing] = entry;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`已生成${bank.title}：${questions.length}题，${images.size}张图片。`);
