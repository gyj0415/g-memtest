export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

export function itemKey(bankIndex, questionId) {
  return `${bankIndex}:${questionId}`;
}

export function flattenBankQuestions(banks) {
  const items = [];
  (banks || []).forEach((bank, bankIndex) => {
    (bank.questions || []).forEach((question, index) => {
      items.push({
        key: itemKey(bankIndex, question.id),
        bankIndex,
        bankTitle: bank.title || "",
        bankGroup: bank.group || "",
        question,
        number: index + 1
      });
    });
  });
  return items;
}

export function questionImageState(question, chosen) {
  const src = String(question?.media?.[0]?.src || "").trim();
  const attached = Boolean(chosen?.file || (chosen?.url && /^(blob:|data:)/i.test(String(chosen.url))));
  if (attached) return "ready";
  if (/^(data:|blob:|https?:\/\/)/i.test(src)) return "ready";
  if (src) return "pending";
  if (question?.material?.title === "图片说明") return "pending";
  return "empty";
}

export function previewSrc(question, chosen) {
  if (chosen?.url) return chosen.url;
  const src = String(question?.media?.[0]?.src || "").trim();
  if (/^(data:|blob:|https?:\/\/)/i.test(src)) return src;
  return "";
}

export function matchImageFiles(banks, files) {
  const updates = [];
  const items = flattenBankQuestions(banks);
  for (const file of files || []) {
    items.forEach((item) => {
      const src = String(item.question.media?.[0]?.src || "");
      if (!src) return;
      if (src === file.name || src.endsWith(`/${file.name}`) || src.endsWith(`\\${file.name}`)) {
        updates.push({
          key: item.key,
          file,
          caption: item.question.media?.[0]?.caption || ""
        });
      }
    });
  }
  return updates;
}

export function countStates(items, getChosen) {
  const counts = { all: items.length, ready: 0, pending: 0, empty: 0 };
  items.forEach((item) => {
    counts[questionImageState(item.question, getChosen(item.key))] += 1;
  });
  return counts;
}

export function pickDefaultFilter(items, getChosen) {
  const counts = countStates(items, getChosen);
  if (counts.pending) return "pending";
  if (counts.ready) return "ready";
  return "all";
}

export function filterItems(items, filter, getChosen) {
  if (!filter || filter === "all") return items;
  return items.filter((item) => questionImageState(item.question, getChosen(item.key)) === filter);
}

export function pickDefaultKey(items, filter, getChosen) {
  const visible = filterItems(items, filter, getChosen);
  return visible[0]?.key || items[0]?.key || "";
}

export function renderFilterBar(filter, counts) {
  const chips = [
    ["all", "全部", counts.all],
    ["ready", "有图", counts.ready],
    ["pending", "待配", counts.pending]
  ];
  return `<div class="pick-filters">${chips.map(([id, label, count]) => (
    `<button class="secondary${filter === id ? " active" : ""}" type="button" data-pick-filter="${id}">${label} ${count}</button>`
  )).join("")}</div>`;
}

export function renderCircles(items, selectedKey, getChosen) {
  if (!items.length) return `<p class="status">当前筛选下没有题目。可点「全部」给其他题配图。</p>`;
  const groups = [];
  const indexByName = new Map();
  items.forEach((item) => {
    const name = item.bankTitle || "题库";
    if (!indexByName.has(name)) {
      indexByName.set(name, groups.length);
      groups.push({ name, items: [] });
    }
    groups[indexByName.get(name)].items.push(item);
  });
  return groups.map((group) => `
    ${groups.length > 1 ? `<h3>${escapeHtml(group.name)}</h3>` : ""}
    <div class="question-pick-list">
      ${group.items.map((item) => {
        const state = questionImageState(item.question, getChosen(item.key));
        const active = item.key === selectedKey ? " active" : "";
        return `<button class="question-pick-item ${state}${active}" type="button" data-pick-key="${escapeHtml(item.key)}" title="${escapeHtml(`${item.number}. ${item.question.title}`)}" aria-label="第 ${item.number} 题">${item.number}</button>`;
      }).join("")}
    </div>
  `).join("");
}

export function findItem(items, key) {
  return items.find((item) => item.key === key) || null;
}
