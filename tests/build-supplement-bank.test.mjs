import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const projectRoot = new URL("../", import.meta.url);

function sampleSource() {
  const standalones = Array.from({ length: 15 }, (_, index) => `### 第${index + 1}题
第${index + 1}题的题干
A. 选项甲
B. 选项乙
C. 选项丙
D. 选项丁
**答案：A**`).join("\n\n");
  const cases = Array.from({ length: 5 }, (_, index) => `**${51 + index}.** 第${51 + index}题的题干
A. 选项甲
B. 选项乙
C. 选项丙
D. 选项丁`).join("\n");
  return `${standalones}

### 第16组
**共用阅读材料**
①这是一段共用材料。
材料来源：测试
${cases}
**答案：51-A、52-B、53-C、54-D、55-A**
`;
}

test("supplement bank builder reads a supplied source and writes to a supplied bank directory", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "g-memtest-supplement-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scriptDir = join(root, "scripts");
  const bankDir = join(root, "site", "banks");
  await mkdir(join(scriptDir, "lib"), { recursive: true });
  await mkdir(bankDir, { recursive: true });
  await copyFile(new URL("scripts/build-supplement-bank.mjs", projectRoot), join(scriptDir, "build-supplement-bank.mjs"));
  await copyFile(new URL("scripts/lib/parse-converter-md.mjs", projectRoot), join(scriptDir, "lib", "parse-converter-md.mjs"));
  await writeFile(join(bankDir, "manifest.json"), JSON.stringify({ version: 1, banks: [] }));
  const sourcePath = join(root, "questions.md");
  await writeFile(sourcePath, sampleSource());

  await execFileAsync(process.execPath, [join(scriptDir, "build-supplement-bank.mjs"), sourcePath, bankDir]);

  const bank = JSON.parse(await readFile(join(bankDir, "bank-公务员考试·补充题目.json"), "utf8"));
  const manifest = JSON.parse(await readFile(join(bankDir, "manifest.json"), "utf8"));
  assert.equal(bank.questions.length, 20);
  assert.equal(bank.questions[0].title, "第1题的题干");
  assert.equal(bank.questions[15].material.content, "①这是一段共用材料。");
  assert.equal(manifest.banks[0].id, bank.id);
});
