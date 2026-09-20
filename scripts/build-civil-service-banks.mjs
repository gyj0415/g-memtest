import { readFile, writeFile } from "node:fs/promises";

const sourcePath = "E:\\Cherry Studio\\agent13\\公务员考试第二节课练习题.md";
const banksDir = new URL("../site/banks/", import.meta.url);
const manifestPath = new URL("../site/banks/manifest.json", import.meta.url);

const bankMeta = {
  id: "bank-gwy-lesson-2",
  file: "gwy-lesson-2.json"
};

const categoryAliases = {
  singleChoice: "singleChoice",
  单选题: "singleChoice",
  multipleChoice: "multipleChoice",
  多选题: "multipleChoice",
  quick: "quick",
  判断题: "quick",
  选择判断: "quick",
  short: "short",
  简答题: "short",
  填空题: "short"
};

function splitBlocks(text) {
  return text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptions(block) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^([A-Z])[\.\、．:：\s]+([\s\S]+)$/i);
      if (!match) return null;
      return { label: match[1].toUpperCase(), text: match[2].trim() };
    })
    .filter(Boolean);
}

function normalizeChoiceAnswer(answer) {
  return [...new Set(String(answer || "").toUpperCase().match(/[A-Z]/g) || [])].sort().join(",");
}

function parseCaptionMaterial(block) {
  const caption = block.match(/(?:图片说明|图注)[:：]\s*([^\n]+)/i)?.[1]?.trim();
  const image = block.match(/(?:图片|图像)[:：]\s*([^\n]+)/i)?.[1]?.trim();
  if (!caption || image) return null;
  return { title: "图片说明", content: caption };
}

function parseBankMeta(block) {
  const title = block.match(/(?:^|\n)(?:题库名称|卷子名称)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "";
  const group = block.match(/(?:^|\n)(?:题库分类|科目|课程)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "";
  return { title, group };
}

function parseBlock(block, index) {
  const options = parseOptions(block);
  const chapter = block.match(/(?:^|\n)(?:章节|章)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "未分章";
  const categoryLabel = block.match(/(?:^|\n)(?:分类|题型)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "";
  const title = block.match(/(?:题目|问题)[:：]\s*([\s\S]*?)(?=\n(?:图片|图片说明|图注|选项|答案)[:：]?|$)/i)?.[1]?.trim() || "";
  const answerRaw = block.match(/(?:答案|参考答案)[:：]\s*([\s\S]*)/i)?.[1]?.trim() || "";
  if (!title || !answerRaw) return null;

  const isChoice = options.length >= 2;
  const choiceAnswer = normalizeChoiceAnswer(answerRaw);
  const choiceCount = choiceAnswer.split(",").filter(Boolean).length;
  const category = categoryAliases[categoryLabel] || (isChoice
    ? choiceCount > 1 ? "multipleChoice" : "singleChoice"
    : "custom");
  const material = parseCaptionMaterial(block);
  const question = {
    id: `q-${String(index + 1).padStart(3, "0")}`,
    chapter,
    category,
    title,
    prompt: isChoice
      ? choiceCount > 1 ? "请选择所有正确答案。" : "请选择正确答案。"
      : "请作答。",
    keywords: [],
    options,
    multiple: isChoice ? choiceCount > 1 || category === "multipleChoice" : undefined,
    answer: isChoice ? choiceAnswer : answerRaw
  };
  if (material) question.material = material;
  return question;
}

const markdown = await readFile(sourcePath, "utf8");
let title = "公务员考试第二节课练习题";
let group = "公务员考试";
const questions = [];

splitBlocks(markdown).forEach((block) => {
  const meta = parseBankMeta(block);
  if (meta.title) title = meta.title;
  if (meta.group) group = meta.group;
  const question = parseBlock(block, questions.length);
  if (question) questions.push(question);
});

if (!questions.length) throw new Error("没有识别到题目");

const incomplete = questions.filter((question) => {
  if (question.category === "short") return !question.answer;
  return !question.options?.length || !question.answer;
});
if (incomplete.length) {
  throw new Error(`有 ${incomplete.length} 道题不完整，第一道是 ${incomplete[0].id}`);
}

const bank = {
  version: 1,
  id: bankMeta.id,
  title,
  description: `${title}，公务员考试第二节课老师提供的练习题。`,
  group,
  schema: {
    required: ["title", "answer"],
    optional: ["id", "chapter", "category", "prompt", "keywords", "minRequired", "options", "multiple", "media", "material", "groupId"]
  },
  chapters: [...new Set(questions.map((item) => item.chapter))],
  categories: [...new Set(questions.map((item) => item.category))],
  questions
};

await writeFile(new URL(bankMeta.file, banksDir), `${JSON.stringify(bank, null, 2)}\n`, "utf8");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.banks = manifest.banks.filter((entry) => entry.id !== bankMeta.id);
manifest.banks.push({
  id: bankMeta.id,
  title,
  description: bank.description,
  group,
  file: bankMeta.file
});
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const sourceCount = [...markdown.matchAll(/^题目[:：]/gm)].length;
if (sourceCount !== questions.length) {
  throw new Error(`源文件 ${sourceCount} 题，转换后 ${questions.length} 题`);
}

console.log(JSON.stringify({
  id: bank.id,
  title,
  group,
  count: questions.length,
  chapters: bank.chapters,
  categories: Object.fromEntries(
    bank.categories.map((category) => [
      category,
      questions.filter((item) => item.category === category).length
    ])
  ),
  captionQuestions: questions.filter((item) => item.material).map((item) => item.id)
}, null, 2));
