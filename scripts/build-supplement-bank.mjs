import { readFile, writeFile } from "node:fs/promises";
import { buildBankJson } from "./lib/parse-converter-md.mjs";

const sourcePath = "E:\\Cherry Studio\\agent13\\补充题目\\补充题目整理.md";
const bankId = "bank-公务员考试·补充题目";
const bankFile = `${bankId}.json`;
const source = (await readFile(sourcePath, "utf8")).replace(/\r/g, "");
const sections = [...source.matchAll(/^### 第(\d+)(题|组)[^\n]*\n([\s\S]*?)(?=^### 第|^## |(?![\s\S]))/gm)];

function parseChoice(text, index, chapter, material, groupId) {
  const optionStart = text.search(/^A\.\s/m);
  const answer = text.match(/^\*\*答案：([A-D])\*\*$/m)?.[1];
  if (optionStart < 0 || !answer) throw new Error(`第${index}题缺少选项或答案`);

  const title = text.slice(0, optionStart).trim();
  const options = [...text.slice(optionStart).matchAll(/^([A-D])\.\s*(.+)$/gm)]
    .map((match) => ({ label: match[1], text: match[2].trim() }));
  if (options.length !== 4 || !options.some((option) => option.label === answer)) {
    throw new Error(`第${index}题的选项或答案不完整`);
  }

  return {
    id: `q-${String(index).padStart(3, "0")}`,
    chapter,
    category: "singleChoice",
    title,
    prompt: "请选择正确答案。",
    keywords: [],
    options,
    multiple: false,
    answer,
    ...(material ? { material, groupId } : {})
  };
}

const questions = [];
let chapter = "";
for (const section of sections) {
  const index = Number(section[1]);
  chapter = index <= 7 ? "逻辑推理" : "言语理解与表达";
  const body = section[3].split(/\n---\n/)[0].trim();
  if (index < 16) {
    questions.push(parseChoice(body, index, chapter));
    continue;
  }

  const passage = body.match(/\*\*共用阅读材料[^]*?\*\*\s*\n([\s\S]*?)\n材料来源：/)?.[1]?.trim();
  if (!passage || !/[①-⑨]/u.test(passage)) throw new Error("第16组缺少完整阅读材料");
  const material = { title: "香料与大航海（第51–55题共用材料）", content: passage };
  const groupId = "2019-国考副省-香料";
  const cases = [...body.matchAll(/^\*\*(5[1-5])\.\*\*\s*([\s\S]*?)(?=^\*\*5[1-5]\.\*\*|^\*\*答案：|(?![\s\S]))/gm)];
  const answers = body.match(/^\*\*答案：51-([A-D])、52-([A-D])、53-([A-D])、54-([A-D])、55-([A-D])\*\*$/m);
  if (cases.length !== 5 || !answers) throw new Error("第16组的五题或答案不完整");
  cases.forEach((entry, offset) => {
    const text = `${entry[2].trim()}\n\n**答案：${answers[offset + 1]}**`;
    questions.push(parseChoice(text, 16 + offset, chapter, material, groupId));
  });
}

if (sections.length !== 16 || questions.length !== 20) {
  throw new Error(`预计16组20题，实际${sections.length}组${questions.length}题`);
}

const bank = buildBankJson("补充题目", "公务员考试", questions, {
  id: bankId,
  description: "公务员考试补充题目：逻辑推理与言语理解，共20题。"
});
const bankPath = new URL(`../site/banks/${bankFile}`, import.meta.url);
const manifestPath = new URL("../site/banks/manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entry = {
  id: bankId,
  title: bank.title,
  description: bank.description,
  group: bank.group,
  file: bankFile
};
const existing = manifest.banks.findIndex((item) => item.id === bankId);
if (existing < 0) manifest.banks.push(entry);
else manifest.banks[existing] = entry;

await writeFile(bankPath, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`已生成${bank.title}：${questions.length}题，包含${questions.filter((q) => q.groupId).length}道共用材料题。`);
