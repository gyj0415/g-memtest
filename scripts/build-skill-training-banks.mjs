import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sourceRoot = "E:\\Cherry Studio\\agent12\\RainClassroom-Exam-Downloader\\downloads\\技能训练（职业技能鉴定）";
const banksDir = new URL("../site/banks/", import.meta.url);
const manifestPath = new URL("../site/banks/manifest.json", import.meta.url);
const group = "技能训练";

const bankMeta = [
  { dir: "01_HCIA-大数据发展趋势与鲲鹏大数据", file: "hcia-bigdata-trend.json", id: "bank-hcia-bigdata-trend" },
  { dir: "02_HCIA-HDFS&Zookeeper", file: "hcia-hdfs-zookeeper.json", id: "bank-hcia-hdfs-zookeeper" },
  { dir: "03_HCIA-HBase&Hive", file: "hcia-hbase-hive.json", id: "bank-hcia-hbase-hive" },
  { dir: "04_HCIA-ClickHouse", file: "hcia-clickhouse.json", id: "bank-hcia-clickhouse" },
  { dir: "05_HCIA-MapReduce&Yarn", file: "hcia-mapreduce-yarn.json", id: "bank-hcia-mapreduce-yarn" },
  { dir: "06_HCIA-Spark&Flink", file: "hcia-spark-flink.json", id: "bank-hcia-spark-flink" },
  { dir: "07_HCIA-Kafka&Flume", file: "hcia-kafka-flume.json", id: "bank-hcia-kafka-flume" },
  { dir: "08_HCIA-ElasticSearch", file: "hcia-elasticsearch.json", id: "bank-hcia-elasticsearch" },
  { dir: "09_HCIA-MRS", file: "hcia-mrs.json", id: "bank-hcia-mrs" },
  { dir: "10_HCIA-DataArts Studio", file: "hcia-dataarts-studio.json", id: "bank-hcia-dataarts-studio" },
  { dir: "11_HCIP-大数据应用开发总指导", file: "hcip-bigdata-app-dev.json", id: "bank-hcip-bigdata-app-dev" },
  { dir: "12_HCIP-大数据离线批处理场景化解决方案", file: "hcip-offline-batch.json", id: "bank-hcip-offline-batch" }
];

function compactText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFillAnswers(raw) {
  const text = String(raw || "").trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.keys(parsed)
        .sort((left, right) => Number(left) - Number(right))
        .map((key) => {
          const value = parsed[key];
          if (Array.isArray(value)) return compactText(value.filter(Boolean).join("、"));
          return compactText(value);
        })
        .filter(Boolean);
    }
  } catch {
    // Keep the raw text when it is not JSON.
  }
  return [compactText(text)].filter(Boolean);
}

function parseChoiceAnswer(raw) {
  const labels = [...new Set(String(raw || "").toUpperCase().match(/[A-Z]/g) || [])].sort();
  return labels.join(",");
}

function parseTrueFalseAnswer(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (["true", "正确", "对"].includes(value)) return "A";
  if (["false", "错误", "错"].includes(value)) return "B";
  throw new Error(`无法识别判断题答案：${raw}`);
}

function parseOptions(block, type) {
  if (type === "判断题") {
    return [
      { label: "A", text: "正确" },
      { label: "B", text: "错误" }
    ];
  }

  return [...block.matchAll(/^- \*\*([A-Za-z])\*\*:[ \t]*(.*)$/gm)]
    .map((match) => ({
      label: match[1].toUpperCase(),
      text: compactText(match[2])
    }))
    .filter((item) => item.text && !item.text.startsWith("- **"))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function parseQuestions(markdown, chapter) {
  const blocks = markdown.split(/^### 题\s+/m).slice(1);
  return blocks.map((block, index) => {
    const headerMatch = block.match(/^(\d+)\s*\(([^)-]+)/);
    const number = Number(headerMatch?.[1] || index + 1);
    const type = compactText(headerMatch?.[2] || "");
    const titleMatch = block.match(/分\)\s*\n+([\s\S]*?)(?=\n(?:\*\*选项\*\*|- \*\*正确答案\*\*))/);
    const rawTitle = compactText(titleMatch?.[1] || "").replace(/\[填空\d+\]/g, "______");
    const answerRaw = block.match(/- \*\*正确答案\*\*:\s*(.+)/)?.[1]?.trim() || "";

    if (type === "填空题") {
      const blanks = parseFillAnswers(answerRaw);
      return {
        id: `q-${String(number).padStart(3, "0")}`,
        chapter,
        category: "short",
        title: rawTitle,
        prompt: blanks.length > 1 ? `请按顺序填写 ${blanks.length} 个空。` : "请填写正确答案。",
        keywords: blanks,
        minRequired: blanks.length > 1 ? blanks.length : undefined,
        answer: blanks.join("、")
      };
    }

    const options = parseOptions(block, type);
    const isMultiple = type === "多选题";
    const isJudge = type === "判断题";
    const answer = isJudge ? parseTrueFalseAnswer(answerRaw) : parseChoiceAnswer(answerRaw);
    const question = {
      id: `q-${String(number).padStart(3, "0")}`,
      chapter,
      category: isJudge ? "quick" : isMultiple ? "multipleChoice" : "singleChoice",
      title: rawTitle,
      prompt: isJudge ? "请判断对错。" : isMultiple ? "请选择所有正确答案。" : "请选择正确答案。",
      keywords: [],
      options,
      multiple: isMultiple,
      answer
    };
    assertQuestion(question, type);
    return question;
  }).filter((question) => question.title && question.answer);
}

function assertQuestion(question, type) {
  if (!question.title) throw new Error(`${question.id} 缺少题干`);
  if (!question.answer) throw new Error(`${question.id} 缺少答案`);
  if (question.category === "short") return;
  if (!Array.isArray(question.options) || question.options.length < 2) {
    throw new Error(`${question.id} 选项不足`);
  }
  if (question.options.some((option) => /^- \*\*|^\*\*/.test(option.text) || !option.text)) {
    throw new Error(`${question.id} 选项文本异常：${question.options.map((item) => item.text).join(" | ")}`);
  }
  if (type === "判断题") {
    if (question.options[0].text !== "正确" || question.options[1].text !== "错误") {
      throw new Error(`${question.id} 判断题选项必须是正确/错误`);
    }
    if (!["A", "B"].includes(question.answer)) {
      throw new Error(`${question.id} 判断题答案必须是 A 或 B，实际为 ${question.answer}`);
    }
  }
}

function buildBank(id, title, questions) {
  const categories = [...new Set(questions.map((item) => item.category))];
  return {
    version: 1,
    id,
    title,
    description: `${title}，技能训练（职业技能鉴定）自测题库。`,
    group,
    schema: {
      required: ["title", "answer"],
      optional: ["id", "chapter", "category", "prompt", "keywords", "minRequired", "options", "multiple", "media", "material", "groupId"]
    },
    chapters: [...new Set(questions.map((item) => item.chapter))],
    categories,
    questions
  };
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.banks = manifest.banks.filter((entry) => entry.group !== group);

const summaries = [];
for (const item of bankMeta) {
  const folder = join(sourceRoot, item.dir);
  const files = (await readdir(folder)).filter((name) => name.endsWith(".md"));
  if (files.length !== 1) {
    throw new Error(`${item.dir} should contain exactly one markdown file`);
  }
  const markdown = await readFile(join(folder, files[0]), "utf8");
  const title = compactText(markdown.match(/^# 考试详情:\s*(.+)$/m)?.[1] || item.dir.replace(/^\d+_/, ""));
  const questions = parseQuestions(markdown, title);
  if (!questions.length) {
    throw new Error(`${title} produced no questions`);
  }
  const missing = questions.filter((question) => {
    if (question.category === "short") return !question.answer;
    return !question.options?.length || !question.answer;
  });
  if (missing.length) {
    throw new Error(`${title} has ${missing.length} incomplete questions, first ${missing[0].id}`);
  }
  const bank = buildBank(item.id, title, questions);
  await writeFile(new URL(item.file, banksDir), `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  manifest.banks.push({
    id: item.id,
    title,
    description: bank.description,
    group,
    file: item.file
  });
  summaries.push({
    title,
    count: questions.length,
    categories: Object.fromEntries(
      [...new Set(questions.map((question) => question.category))].map((category) => [
        category,
        questions.filter((question) => question.category === category).length
      ])
    )
  });
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  group,
  bankCount: summaries.length,
  questionCount: summaries.reduce((sum, item) => sum + item.count, 0),
  banks: summaries
}, null, 2));
