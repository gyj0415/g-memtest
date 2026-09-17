import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const sourceRoot = "E:\\Cherry Studio\\agent12\\RainClassroom-Exam-Downloader\\downloads\\技能训练（职业技能鉴定）";
const banksDir = new URL("../site/banks/", import.meta.url);

const bankMeta = [
  { dir: "01_HCIA-大数据发展趋势与鲲鹏大数据", file: "hcia-bigdata-trend.json" },
  { dir: "02_HCIA-HDFS&Zookeeper", file: "hcia-hdfs-zookeeper.json" },
  { dir: "03_HCIA-HBase&Hive", file: "hcia-hbase-hive.json" },
  { dir: "04_HCIA-ClickHouse", file: "hcia-clickhouse.json" },
  { dir: "05_HCIA-MapReduce&Yarn", file: "hcia-mapreduce-yarn.json" },
  { dir: "06_HCIA-Spark&Flink", file: "hcia-spark-flink.json" },
  { dir: "07_HCIA-Kafka&Flume", file: "hcia-kafka-flume.json" },
  { dir: "08_HCIA-ElasticSearch", file: "hcia-elasticsearch.json" },
  { dir: "09_HCIA-MRS", file: "hcia-mrs.json" },
  { dir: "10_HCIA-DataArts Studio", file: "hcia-dataarts-studio.json" },
  { dir: "11_HCIP-大数据应用开发总指导", file: "hcip-bigdata-app-dev.json" },
  { dir: "12_HCIP-大数据离线批处理场景化解决方案", file: "hcip-offline-batch.json" }
];

function compactText(value) {
  return String(value || "").replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

function parseFillAnswers(raw) {
  const text = String(raw || "").trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.keys(parsed)
        .sort((left, right) => Number(left) - Number(right))
        .flatMap((key) => (Array.isArray(parsed[key]) ? parsed[key] : [parsed[key]]))
        .map(compactText)
        .filter(Boolean);
    }
  } catch {
    // Keep raw text.
  }
  return [compactText(text)].filter(Boolean);
}

function parseSourceQuestions(markdown) {
  return markdown.split(/^### 题\s+/m).slice(1).map((block, index) => {
    const headerMatch = block.match(/^(\d+)\s*\(([^)-]+)/);
    const number = Number(headerMatch?.[1] || index + 1);
    const type = compactText(headerMatch?.[2] || "");
    const titleMatch = block.match(/分\)\s*\n+([\s\S]*?)(?=\n(?:\*\*选项\*\*|- \*\*正确答案\*\*))/);
    const title = compactText(titleMatch?.[1] || "");
    const answerRaw = block.match(/- \*\*正确答案\*\*:[ \t]*(.+)/)?.[1]?.trim() || "";
    const options = [...block.matchAll(/^- \*\*([A-Za-z]+)\*\*:[ \t]*(.*)$/gm)]
      .map((match) => ({
        label: match[1].trim(),
        text: compactText(match[2])
      }))
      .filter((item) => !["正确答案", "我的作答", "是否正确", "得分", "解析"].includes(item.label));
    return { number, type, title, answerRaw, options };
  });
}

function expectedChoiceAnswer(raw) {
  return [...new Set(String(raw || "").toUpperCase().match(/[A-Z]/g) || [])].sort().join(",");
}

function expectedJudgeAnswer(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (["true", "正确", "对"].includes(value)) return "A";
  if (["false", "错误", "错"].includes(value)) return "B";
  return `UNMAPPED:${raw}`;
}

const diffs = [];
let compared = 0;

for (const item of bankMeta) {
  const folder = join(sourceRoot, item.dir);
  const mdName = (await readdir(folder)).find((name) => name.endsWith(".md"));
  const markdown = await readFile(join(folder, mdName), "utf8");
  const expectedCount = Number(markdown.match(/- \*\*题目数量\*\*:\s*(\d+)/)?.[1] || 0);
  const sourceQuestions = parseSourceQuestions(markdown);
  const bank = JSON.parse(await readFile(new URL(item.file, banksDir), "utf8"));

  if (sourceQuestions.length !== expectedCount) {
    diffs.push(`${item.file} 源文件解析题数 ${sourceQuestions.length} != 标注 ${expectedCount}`);
  }
  if (bank.questions.length !== sourceQuestions.length) {
    diffs.push(`${item.file} 题库题数 ${bank.questions.length} != 源文件 ${sourceQuestions.length}`);
  }

  const byId = new Map(bank.questions.map((question) => [question.id, question]));
  for (const source of sourceQuestions) {
    compared += 1;
    const id = `q-${String(source.number).padStart(3, "0")}`;
    const actual = byId.get(id);
    if (!actual) {
      diffs.push(`${item.file} ${id} 题库缺失`);
      continue;
    }

    const sourceTitle = source.title.replace(/\[填空\d+\]/g, "______");
    if (sourceTitle !== compactText(actual.title)) {
      diffs.push(`${item.file} ${id} 题干不一致\n  源: ${sourceTitle}\n  库: ${compactText(actual.title)}`);
    }

    if (source.type === "填空题") {
      const expected = parseFillAnswers(source.answerRaw).join("、");
      if (expected !== actual.answer) {
        diffs.push(`${item.file} ${id} 填空答案不一致 源=${expected} 库=${actual.answer}`);
      }
      continue;
    }

    if (source.type === "判断题") {
      const expectedAnswer = expectedJudgeAnswer(source.answerRaw);
      if (actual.answer !== expectedAnswer) {
        diffs.push(`${item.file} ${id} 判断答案不一致 源=${source.answerRaw}=>${expectedAnswer} 库=${actual.answer}`);
      }
      const optionMap = Object.fromEntries(actual.options.map((option) => [option.label, option.text]));
      if (optionMap.A !== "正确" || optionMap.B !== "错误") {
        diffs.push(`${item.file} ${id} 判断选项不是正确/错误`);
      }
      continue;
    }

    const sourceOptions = Object.fromEntries(
      source.options
        .filter((option) => /^[A-Za-z]$/.test(option.label))
        .map((option) => [option.label.toUpperCase(), option.text])
    );
    const actualOptions = Object.fromEntries(actual.options.map((option) => [option.label, option.text]));
    const labels = [...new Set([...Object.keys(sourceOptions), ...Object.keys(actualOptions)])].sort();
    for (const label of labels) {
      if (sourceOptions[label] !== actualOptions[label]) {
        diffs.push(`${item.file} ${id} 选项${label}不一致\n  源: ${sourceOptions[label]}\n  库: ${actualOptions[label]}`);
      }
    }
    const expectedAnswer = expectedChoiceAnswer(source.answerRaw);
    if (expectedAnswer !== actual.answer) {
      diffs.push(`${item.file} ${id} 选择题答案不一致 源=${source.answerRaw}=>${expectedAnswer} 库=${actual.answer}`);
    }
  }
}

console.log(JSON.stringify({
  compared,
  diffCount: diffs.length,
  diffs: diffs.slice(0, 80)
}, null, 2));
if (diffs.length) process.exit(1);
