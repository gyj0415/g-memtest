const categoryAliases = {
  term: "term",
  名词解释: "term",
  short: "short",
  简答题: "short",
  填空题: "short",
  问答题: "short",
  choice: "choice",
  选择题: "choice",
  singleChoice: "singleChoice",
  单选题: "singleChoice",
  multipleChoice: "multipleChoice",
  多选题: "multipleChoice",
  quick: "quick",
  选择判断: "quick",
  判断题: "quick",
  "选择/判断": "quick",
  formula: "formula",
  计算公式: "formula",
  计算题: "formula",
  公式题: "formula",
  case: "case",
  案例题: "case",
  custom: "custom",
  自定义: "custom",
  auto: "auto",
  自动识别: "auto"
};

function splitBlocks(text) {
  return String(text || "")
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

function normalizeCategory(value, fallback = "custom") {
  const key = String(value || "").trim();
  return categoryAliases[key] || fallback;
}

function parseBankMeta(block) {
  const title = block.match(/(?:^|\n)(?:题库名称|卷子名称|BankTitle)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "";
  const group = block.match(/(?:^|\n)(?:题库分类|科目|课程|套装|BankGroup|Subject|Course)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "";
  return { title, group };
}

function isBankMetaLine(line) {
  return /^(?:题库名称|卷子名称|BankTitle|题库分类|科目|课程|套装|BankGroup|Subject|Course)[:：]\s*/i.test(line);
}

function parseQuestionMedia(block) {
  const imageMatch = block.match(/(?:图片|图像|Image)[:：]\s*([^\n]+)/i);
  const caption = block.match(/(?:图片说明|图注|Alt|Caption)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "";
  if (!imageMatch) return [];
  const src = imageMatch[1].trim();
  if (!src) return [];
  return [{
    type: "image",
    src,
    alt: caption || "题目图片",
    caption
  }];
}

function parseCaptionMaterial(block) {
  const caption = block.match(/(?:图片说明|图注)[:：]\s*([^\n]+)/i)?.[1]?.trim();
  const image = block.match(/(?:图片|图像|Image)[:：]\s*([^\n]+)/i)?.[1]?.trim();
  if (!caption || image) return null;
  return { title: "图片说明", content: caption };
}

function parseQuestionMaterial(block) {
  const materialMatch = block.match(/(?:资料|材料|案例资料|Material|Passage)[:：]\s*([\s\S]*?)(?=\n(?:题目|问题|Q|Question|选项|答案|参考答案|A[\.\、．:：\s]|Answer)[:：]?|$)/i);
  const content = materialMatch?.[1]?.trim() || "";
  if (!content) return parseCaptionMaterial(block);
  const title = block.match(/(?:资料标题|材料标题|案例标题|MaterialTitle|PassageTitle)[:：]\s*([^\n]+)/i)?.[1]?.trim() || "题目资料";
  return { title, content };
}

function parseQuestionGroupId(block) {
  return block.match(/(?:资料组|材料组|案例组|Group|GroupId|CaseId)[:：]\s*([^\n]+)/i)?.[1]?.trim() || undefined;
}

function parseBlock(block, index, defaults = {}) {
  const options = parseOptions(block);
  const chapterMatch = block.match(/(?:^|\n)(?:章节|章|Chapter|Section)[:：]\s*([^\n]+)/i);
  const categoryMatch = block.match(/(?:^|\n)(?:分类|题型|类别|Category)[:：]\s*([^\n]+)/i);
  const titleMatch = block.match(/(?:题目|问题|Q|Question)[:：]\s*([\s\S]*?)(?=\n(?:图片|图像|Image|图片说明|图注|Alt|Caption|资料|材料|案例资料|Material|Passage|资料标题|材料标题|案例标题|MaterialTitle|PassageTitle|资料组|材料组|案例组|Group|GroupId|CaseId|选项|答案|参考答案|A[\.\、．:：\s]|Answer)[:：]?|$)/i);
  const answerMatch = block.match(/(?:答案|参考答案|Answer)[:：]\s*([\s\S]*)/i);
  let title = titleMatch?.[1]?.replace(/^选项[:：]?[\s\S]*$/i, "").trim() || "";
  let answer = answerMatch?.[1]?.trim() || "";

  if (!title || !answer) {
    const lines = block.split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^(?:章节|章|Chapter|Section)[:：]\s*/i.test(line))
      .filter((line) => !/^(?:分类|题型|类别|Category)[:：]\s*/i.test(line))
      .filter((line) => !isBankMetaLine(line))
      .filter((line) => !/^(?:图片|图像|Image|图片说明|图注|Alt|Caption)[:：]\s*/i.test(line))
      .filter((line) => !/^(?:资料|材料|案例资料|Material|Passage|资料标题|材料标题|案例标题|MaterialTitle|PassageTitle|资料组|材料组|案例组|Group|GroupId|CaseId)[:：]\s*/i.test(line))
      .filter((line) => !/^选项[:：]?$/i.test(line))
      .filter((line) => !/^([A-Z])[\.\、．:：\s]+([\s\S]+)$/i.test(line));
    title = title || lines[0] || "";
    answer = answer || lines.slice(1).join("\n");
  }

  if (!title || !answer) return null;

  const minRequired = Number(title.match(/至少写出\s*(\d+)|写出\s*(\d+)\s*条|(\d+)\s*个关键词/)?.slice(1).find(Boolean));
  const isChoice = options.length >= 2;
  const choiceAnswer = normalizeChoiceAnswer(answer);
  const choiceCount = choiceAnswer.split(",").filter(Boolean).length;
  const selectedDefaultCategory = normalizeCategory(defaults.defaultCategory, "auto");
  const fallbackCategory = selectedDefaultCategory === "auto"
    ? (isChoice ? (choiceCount > 1 ? "multipleChoice" : "singleChoice") : "custom")
    : selectedDefaultCategory;
  const resolvedCategory = normalizeCategory(categoryMatch?.[1], fallbackCategory);
  const normalizedCategory = resolvedCategory === "choice" && isChoice
    ? (choiceCount > 1 ? "multipleChoice" : "singleChoice")
    : resolvedCategory;
  const chapter = (chapterMatch?.[1] || defaults.defaultChapter || "未分章").trim() || "未分章";
  const media = parseQuestionMedia(block);
  const material = parseQuestionMaterial(block);
  const question = {
    id: `q-${String(index + 1).padStart(3, "0")}`,
    chapter,
    category: normalizedCategory,
    title,
    prompt: isChoice
      ? choiceCount > 1 ? "请选择所有正确答案。" : "请选择正确答案。"
      : minRequired ? `请至少写出 ${minRequired} 个要点。` : "请作答。",
    keywords: [],
    options,
    multiple: isChoice ? choiceCount > 1 || normalizedCategory === "multipleChoice" : undefined,
    answer: isChoice ? choiceAnswer : answer
  };
  if (Number.isFinite(minRequired)) question.minRequired = minRequired;
  if (media.length) question.media = media;
  if (material) question.material = material;
  const groupId = parseQuestionGroupId(block);
  if (groupId) question.groupId = groupId;
  return question;
}

export function parseConverterMarkdown(text, defaults = {}) {
  const defaultTitle = defaults.defaultTitle || "自定义自测题库";
  const defaultGroup = defaults.defaultGroup || "未分类";
  const banks = [];
  let current = { title: defaultTitle, group: defaultGroup, questions: [] };

  function flushBank() {
    if (!current.questions.length) return;
    banks.push(current);
    current = { title: current.title, group: current.group, questions: [] };
  }

  splitBlocks(text).forEach((block, index) => {
    const meta = parseBankMeta(block);
    if (meta.title && meta.title !== current.title && current.questions.length) {
      flushBank();
      current.title = meta.title;
    } else if (meta.title) {
      current.title = meta.title;
    }
    if (meta.group) current.group = meta.group;
    const question = parseBlock(block, current.questions.length, defaults);
    if (question) current.questions.push(question);
    void index;
  });
  flushBank();
  return banks;
}

export function buildBankJson(title, group, questions, extra = {}) {
  return {
    version: 1,
    id: extra.id,
    title,
    description: extra.description || `${title}。`,
    group,
    schema: {
      required: ["title", "answer"],
      optional: ["id", "chapter", "category", "prompt", "keywords", "minRequired", "options", "multiple", "media", "material", "groupId"]
    },
    chapters: [...new Set(questions.map((item) => item.chapter || "未分章"))],
    categories: [...new Set(questions.map((item) => item.category || "custom"))],
    questions
  };
}
