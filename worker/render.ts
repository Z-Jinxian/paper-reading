import type { ModelProfile } from "./research";
import katex from "katex";
import home from "../content/index-template.html?raw";
import { isComplete } from "./papers";
import { readingSkillBody, readingSkillFilePath, readingSkillPath } from "./reading-skill";
import type { Category, Evidence, Example, Formula, Note, Paper, Section } from "./types";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c]!);
const paperUrl = (id: string) => "/papers/" + id + ".html";
const bookUrl = (filters: Record<string, string> = {}) => {
  const query = new URLSearchParams(filters).toString();
  return "/" + (query ? "?" + query : "") + "#recommendations";
};
const external = (url: string, label: string) => url
  ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>` : "";
const paragraph = (text: string | undefined, className = "reading-text") => text
  ? `<p class="${className}">${escape(text)}</p>` : "";
const items = (lines: string[], tag = "ul") => lines.length
  ? `<${tag}>${lines.map((line) => `<li>${escape(line)}</li>`).join("")}</${tag}>` : "";
const chips = (tags: string[]) => tags.length
  ? `<div class="method-tags" aria-label="方法标签">${tags.map((tag) =>
    `<a class="method-tag" href="${escape(bookUrl({ method: tag }))}">${escape(tag)}</a>`).join("")}</div>` : "";
const categoryLabel = (categories: Category[], id: string) => categories.find((category) => category.id === id)?.label ?? "未分类";
const status = (note: Note) => `<span class="note-status ${isComplete(note) ? "ready" : "draft"}">${isComplete(note) ? "精读齐全" : "待精读"}</span>`;
const dateText = (date: string) => new Intl.DateTimeFormat("zh-CN", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Shanghai",
}).format(new Date(date));

function math(latex: string, displayMode = false) {
  if (!latex) return "";
  try {
    const value = latex.replace(/^\s*\\\[([\s\S]*)\\\]\s*$/, "$1").replace(/^\s*\$\$([\s\S]*)\$\$\s*$/, "$1");
    return katex.renderToString(value, { output: "mathml", displayMode, trust: false, strict: "ignore", maxExpand: 500, maxSize: 30 });
  } catch {
    return `<code class="math-fallback">${escape(latex)}</code>`;
  }
}

function mathLine(latex: string | undefined) {
  return latex ? `<div class="math-line">${math(latex, true)}</div>` : "";
}

function screenshot(item: Evidence, note: Note, label: string) {
  let link = "";
  if (note.source.pdf) {
    const pdf = new URL(note.source.pdf);
    if (item.page) pdf.hash = "page=" + item.page;
    link = external(pdf.href, item.page ? "原文 PDF · 第 " + item.page + " 页" : "原文 PDF");
  } else if (note.source.landing) {
    link = external(note.source.landing, "论文出处");
  }
  if (!item.asset) return link && item.page ? `<p class="micro">${link}</p>` : "";
  const description = escape(item.alt || label + "截图");
  return `<figure class="source-shot original-shot">
    <button type="button" class="zoom-trigger" data-zoom aria-label="放大${description}">
      <img src="${escape(item.asset)}" alt="${description}" loading="lazy" decoding="async">
    </button>
    <figcaption><span>${escape(label)}</span>${link}</figcaption>
  </figure>`;
}

function chapter(item: Section, note: Note) {
  const firstSourcePage = item.passagePages?.match(/\d+/)?.[0];
  const pdf = note.source.pdf;
  const image = screenshot(item, note, "章节原文");
  const intro = `<h3>${escape(item.heading || "阅读章节")}</h3>
    ${item.background ? `<p class="reading-background"><strong>背景</strong> ${escape(item.background)}</p>` : ""}
    ${paragraph(item.why)}`;
  if (item.originalText && item.translation) {
    return `<section class="chapter-card chapter-bilingual">
      <div>${intro}</div>${image}
      <div class="chapter-bilingual-text">
        ${bilingualPair(item.originalText, item.translation)}
        ${item.passagePages ? `<p class="micro">双语段落 · PDF 第 ${escape(item.passagePages)} 页 ${firstSourcePage && pdf ? external(pdf.split("#")[0] + "#page=" + firstSourcePage, "打开原文 ↗") : ""}</p>` : ""}
        ${item.details.length ? "<h4>原理与读法</h4>" + items(item.details) : ""}
      </div>
    </section>`;
  }
  return `<section class="chapter-card">
    <div>${intro}${items(item.details)}</div>${image}
  </section>`;
}

function bilingualPair(original: string, translation: string) {
  const split = (value: string) => value.split(/\n\s*\n/).filter((part) => part.trim());
  const originals = split(original);
  const translations = split(translation);
  const renderPair = (english: string, chinese: string) =>
    `<div class="bilingual-pair"><div lang="en"><h4 lang="zh-CN">英文原文</h4><p class="bilingual-text">${escape(english)}</p></div>
    <div><h4>中文译文</h4><p class="bilingual-text">${escape(chinese)}</p></div></div>`;
  return originals.length === translations.length
    ? originals.map((english, index) => renderPair(english, translations[index])).join("")
    : renderPair(original, translation);
}

function formula(item: Formula, note: Note) {
  const symbols = item.symbols.map(([symbol, meaning]) => `<tr><th scope="row">${math(symbol)}</th><td>${escape(meaning)}</td></tr>`).join("");
  return `<section class="formula-card close-formula">
    <h3>${escape(item.name || "核心公式")}</h3>
    ${screenshot(item, note, item.original || "公式原文")}
    ${item.latex ? "<h4>抽象数学写法</h4>" + mathLine(item.latex) : ""}
    ${symbols ? `<div class="table-box"><table class="symbols">
      <thead><tr><th scope="col">符号</th><th scope="col">含义</th></tr></thead><tbody>${symbols}</tbody>
    </table></div>` : ""}
    ${item.steps.length ? "<h4>怎么读、怎么算</h4>" + items(item.steps, "ol") : ""}
    ${item.principle ? "<h4>数学原理</h4>" + paragraph(item.principle, "bilingual-text") : ""}
    ${item.numericExample ? "<h4>数值算例</h4>" + paragraph(item.numericExample, "bilingual-text") : ""}
    ${paragraph(item.scope, "formula-scope reading-text")}
  </section>`;
}

function example(item: Example) {
  const steps = item.steps.map((step) => `<li>${step.label ? "<h4>" + escape(step.label) + "</h4>" : ""}${paragraph(step.text)}${mathLine(step.latex)}</li>`).join("");
  return item.title || item.setup || steps || item.takeaway ? `<div class="worked-example">
    ${item.title ? "<h3>" + escape(item.title) + "</h3>" : ""}
    ${paragraph(item.setup)}
    ${steps ? '<ol class="calculation">' + steps + "</ol>" : ""}
    ${paragraph(item.takeaway, "example-result reading-text")}
  </div>` : "";
}

function masthead(actions: string) {
  return `<header class="masthead"><div class="shell masthead-inner">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>论文阅读</a>
    <nav class="mast-nav" aria-label="站点导航">${actions}</nav>
  </div></header>`;
}

const modelsLink = '<a class="mast-link" href="/models">模型 API</a>';
const manageLink = '<a class="mast-link" href="/manage">管理论文</a>';
const catalogueLink = '<a class="mast-link" href="/#recommendations">论文库</a>';
const skillLink = `<a class="mast-link" href="${readingSkillPath}">精读 Skill</a>`;

function layout(title: string, header: string, body: string, script?: string, editor = false) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · 论文阅读</title>
  <link rel="stylesheet" href="/notebook.css">
  ${editor ? '<link rel="stylesheet" href="/manage.css">' : ""}
  ${script ? `<script defer src="${script}"></script>` : ""}
</head>
<body>
  <a class="skip-link" href="#paper-content">跳到正文</a>
  ${masthead(header)}
  ${body}
</body></html>`;
}

export function readingSkillPage() {
  const sections = readingSkillBody.split(/\n(?=## )/u).slice(1).map((section) => {
    const [heading, ...lines] = section.trim().split(/\r?\n/u);
    return `<section><h2>${escape(heading.slice(3))}</h2>
      ${items(lines.filter((line) => line.startsWith("- ")).map((line) => line.slice(2)))}</section>`;
  }).join("");
  return layout("精读 Skill", catalogueLink + manageLink, `<main class="shell skill-page" id="paper-content">
    <article class="paper close-reading">
      <header class="paper-header">
        <h1>精读 Skill</h1>
        <p class="reading-text">每次生成草稿都会使用这套精读标准。英文从已定位的 PDF 行提取，生成后会标出需要复核的内容。</p>
        <div class="paper-actions">
          <a class="secondary-action" href="${readingSkillFilePath}" download="SKILL.md">下载 SKILL.md</a>
          <a class="hero-cta" href="/manage/new">生成论文精读</a>
        </div>
      </header>
      <div class="paper-content">${sections}</div>
    </article>
  </main>`);
}

const dialog = `<dialog id="source-dialog" aria-labelledby="source-dialog-title">
  <div class="dialog-inner">
    <div class="dialog-head"><h2 id="source-dialog-title">论文原文截图</h2><button id="close-source" type="button" autofocus>关闭</button></div>
    <div class="dialog-image"><img id="large-source" alt=""></div>
    <a id="large-source-link" target="_blank" rel="noopener noreferrer">打开原文 PDF</a>
  </div>
</dialog>`;

const removeDialog = `<dialog id="remove-dialog" aria-labelledby="remove-title">
  <div class="dialog-inner"><h2 id="remove-title">移入回收站</h2><p id="remove-description"></p>
    <div class="confirm-actions"><button id="cancel-remove" class="secondary-action" type="button" autofocus>取消</button>
    <button id="confirm-remove" class="hero-cta" type="button">移入回收站</button></div>
  </div>
</dialog>`;

const topicDialog = `<dialog id="topic-dialog" aria-labelledby="topic-title">
  <form class="dialog-inner" id="topic-form">
    <h2 id="topic-title">新建专题</h2>
    <label for="topic-name">专题名称</label>
    <input type="text" id="topic-name" name="name" maxlength="40" placeholder="例如 多任务学习" required autofocus>
    <p id="topic-status" class="action-feedback" role="status" hidden></p>
    <div class="confirm-actions"><button id="cancel-topic" class="secondary-action" type="button">取消</button>
    <button class="hero-cta" type="submit">创建专题</button></div>
  </form>
</dialog>`;

export function readingPage(paper: Paper, categories: Category[], saved = false) {
  const { id, data: note } = paper;
  const label = categoryLabel(categories, note.category);
  const sections = [
    { id: "chapters", label: "值得读的章节", body: note.sections.map((item) => chapter(item, note)).join("") },
    { id: "formulas", label: "核心公式", body: note.formulas.map((item) => formula(item, note)).join("") },
    { id: "example", label: "详细数值例子", body: example(note.example) },
    { id: "limits", label: "适用范围与证据", body: items(note.limits) },
  ];
  const nav = sections.map(({ id, label }) => `<a href="#${id}">${label}</a>`).join("");
  const editLink = `<a class="mast-link" href="/manage/${id}">编辑论文</a>`;
  return layout(note.title, catalogueLink + manageLink + editLink, `
  <div class="shell notebook-layout reading-layout">
    <aside class="rail reading-rail"><nav aria-label="精读目录"><p class="rail-title">本篇目录</p>${nav}</nav></aside>
    <main id="paper-content">
      <article class="paper close-reading">
        <header class="paper-header">
          ${saved ? '<p class="saved-notice" role="status">已保存到论文库</p>' : ""}
          <div class="reading-meta">
            <a href="${escape(bookUrl({ topic: note.category }))}">${escape(label)}</a>
            ${note.venue ? "<span>" + escape(note.venue) + "</span>" : ""}
            ${note.age ? "<span>" + escape(note.age) + "</span>" : status(note)}
          </div>
          <h1>${escape(note.title)}</h1>
          ${paragraph(note.thesis, "paper-intro reading-text")}
          ${note.reason ? '<p class="reading-reason reading-text"><strong>推荐理由</strong> ' + escape(note.reason) + "</p>" : ""}
          ${chips(note.tags)}
          <div class="paper-actions">
            ${external(note.source.landing, "论文出处 ↗")}
            ${external(note.source.pdf, "本页截图所用 PDF ↗")}
          </div>
          ${paragraph(note.source.version, "edition-note")}${paragraph(note.source.note, "edition-note")}
        </header>
        <nav class="article-jump" aria-label="精读目录">${nav}</nav>
        <div class="paper-content">
          ${sections.map(({ id, label, body }) => `<section id="${id}"><h2>${label}</h2>
            ${body ? `<div class="${id === "chapters" ? "chapter-list" : ""}">${body}</div>` : `<p class="micro">待补充。<a href="/manage/${paper.id}#edit-${id}">编辑本节</a></p>`}
          </section>`).join("")}
        </div>
      </article>
    </main>
  </div>${dialog}`, "/notebook.js");
}

function catalogueCard({ id, data: note, revision }: Paper) {
  return `<article class="recommendation paper-record" id="${escape(note.anchor || "ref-" + id)}" data-paper data-tags="${escape(JSON.stringify(note.tags))}">
    <div class="paper-meta">
      ${note.angle ? '<span class="paper-angle">' + escape(note.angle) + "</span>" : ""}
      ${note.venue ? "<span>" + escape(note.venue) + "</span>" : ""}
      ${note.age ? '<span class="age-tag">' + escape(note.age) + "</span>" : status(note)}
    </div>
    <h4><a class="paper-card-title" href="${paperUrl(id)}">${escape(note.title)}</a></h4>
    ${note.reason ? '<p class="reading-text"><strong>推荐理由</strong> ' + escape(note.reason) + "</p>" : ""}
    ${paragraph(note.read, "paper-reading")}${chips(note.tags)}
    <div class="recommendation-links">
      <a class="deep-link" href="${paperUrl(id)}">打开精读 →</a>${external(note.source.landing, "论文出处 ↗")}
      <button type="button" class="paper-trash" data-paper-action="remove" data-id="${id}" data-revision="${revision}"
        data-title="${escape(note.title)}" aria-label="将《${escape(note.title)}》移入回收站" title="移入回收站">
        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 5.5h14M7.5 5.5V3.2h5v2.3M5 5.5l.7 10.4a1.4 1.4 0 0 0 1.4 1.3h5.8a1.4 1.4 0 0 0 1.4-1.3L15 5.5M8.4 8.6v5.1m3.2-5.1v5.1"/>
        </svg>
      </button>
    </div>
  </article>`;
}

export function homepage(papers: Paper[], categories: Category[], notice: string | null) {
  const active = papers.filter((paper) => !paper.deletedAt);
  const tags = [...new Set(active.flatMap((paper) => paper.data.tags))].sort();
  const options = categories.map(({ id, label }) => `<option value="${escape(id)}">${escape(label)}</option>`).join("");
  const methods = tags.map((tag) => `<option value="${escape(tag)}">${escape(tag)}</option>`).join("");
  const feedback = notice === "removed" ? '论文已移入回收站。<a href="/manage?view=trash">查看回收站</a>' : "";
  const tools = `<p id="catalogue-status" class="action-feedback" role="status" ${feedback ? "" : "hidden"}>${feedback}</p>
  <form id="paper-search" class="paper-search paper-filters" role="search" aria-label="检索论文" hidden>
    <div class="filter-grid">
      <label>搜索论文<input type="search" id="paper-query" placeholder="标题、关键词、方法" autocomplete="off"></label>
      <label>专题<select id="paper-topic"><option value="">全部专题</option>${options}</select></label>
      <label>方法标签<select id="paper-method"><option value="">全部方法</option>${methods}</select></label>
    </div>
    <div class="filter-status"><output id="paper-count" for="paper-query paper-topic paper-method" aria-live="polite"></output>
      <button id="clear-filters" type="button">清除筛选</button></div>
  </form><p id="paper-empty" class="empty-search" hidden>没有匹配的论文。可以换一个关键词或清除筛选。</p>`;
  const groups = categories.map((category) => {
    const group = active.filter((paper) => paper.data.category === category.id);
    return `<section class="research-topic" id="${escape(category.id)}" data-topic>
      <header class="topic-header topic-heading">
        <h3>${escape(category.label)}</h3>${paragraph(category.question, "topic-question")}
        ${paragraph(category.description, "topic-description")}
      </header>
      ${group.length ? '<div class="recommendation-list">' + group.map(catalogueCard).join("") + "</div>"
        : `<p class="empty-topic">这个专题还没有论文。<a href="/manage/new?topic=${encodeURIComponent(category.id)}">新增论文</a></p>`}
    </section>`;
  }).join("");
  const topicLinks = categories.map(({ id, label }) =>
    `<a href="#${escape(id)}"><span>${escape(label)}</span><span class="toc-arrow" aria-hidden="true">↘</span></a>`).join("");
  const railTopics = categories.map(({ id, label }) =>
    `<a href="#${escape(id)}">${escape(label)}</a>`).join("");
  return home.replaceAll("@@PAPER_COUNT@@", String(active.length))
    .replaceAll("@@TOPIC_COUNT@@", String(categories.length))
    .replace("<!-- PAPER_TOOLS -->", () => tools)
    .replace("<!-- PAPER_GROUPS -->", () => groups)
    .replace("<!-- TOPIC_LINKS -->", () => topicLinks)
    .replace("<!-- RAIL_TOPICS -->", () => railTopics)
    .replace("<!-- LIBRARY_DIALOGS -->", () => topicDialog + removeDialog);
}

export function messagePage(title: string, message: string, href = "/manage", label = "返回论文管理") {
  return layout(title, catalogueLink + manageLink, `<main class="shell message-page" id="paper-content">
    <h1>${escape(title)}</h1><p>${escape(message)}</p><a class="hero-cta" href="${escape(href)}">${escape(label)}</a>
  </main>`);
}

export function managementPage(papers: Paper[], categories: Category[], trash: boolean, notice: string | null) {
  const count = papers.filter((paper) => !paper.deletedAt).length;
  const rows = papers.filter((paper) => Boolean(paper.deletedAt) === trash).sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const tableRows = rows.map((paper) => {
    const { id, revision, data: note, deletedAt, updatedAt } = paper;
    return `<tr data-manage-row>
      <th scope="row"><span class="manage-title">${escape(note.title)}</span>${note.venue ? '<small>' + escape(note.venue) + "</small>" : ""}</th>
      <td>${escape(categoryLabel(categories, note.category))}</td>
      <td>${trash ? escape(dateText(deletedAt!)) : status(note)}</td>
      <td class="manage-row-actions">
        ${trash ? "" : `<a href="${paperUrl(id)}">查看</a><a href="/manage/${id}">编辑</a>`}
        <button type="button" class="text-button ${trash ? "" : "remove-button"}" data-paper-action="${trash ? "restore" : "remove"}"
          data-id="${id}" data-revision="${revision}" data-title="${escape(note.title)}">${trash ? "恢复" : "移入回收站"}</button>
      </td>
    </tr>`;
  }).join("");
  const alert = notice === "removed" ? "已移入回收站，可以随时恢复。" : notice === "restored" ? "论文已恢复到论文库。" : "";
  return layout(trash ? "回收站" : "管理论文", catalogueLink + modelsLink, `<main class="shell manager" id="paper-content">
    <header class="manager-head">
      <div><h1>论文管理</h1><p>新增和编辑精读笔记，或从回收站恢复论文。</p></div>
      <a class="hero-cta" href="/manage/new">新增论文</a>
    </header>
    <nav class="manager-tabs" aria-label="管理视图">
      <a href="/manage" ${trash ? "" : 'aria-current="page"'}>论文库 <span>${count}</span></a>
      <a href="/manage?view=trash" ${trash ? 'aria-current="page"' : ""}>回收站 <span>${papers.length - count}</span></a>
    </nav>
    <p id="management-status" class="action-feedback" role="status" ${alert ? "" : "hidden"}>${escape(alert)}</p>
    ${rows.length ? `<label class="management-search">查找论文<input id="management-query" type="search" placeholder="输入标题、专题或会议"></label>
      <p id="management-empty" class="micro" hidden>没有匹配的论文。</p>
      <div class="table-box manage-table"><table>
        <thead><tr><th scope="col">论文</th><th scope="col">专题</th><th scope="col">${trash ? "移入时间" : "精读状态"}</th><th scope="col">操作</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>` : `<p class="empty-search">${trash ? "回收站为空。" : "论文库为空。可以从新增论文开始。"} </p>`}
    ${removeDialog}
  </main>`, "/manage.js", true);
}

export function editorPage(paper: Paper, profiles: ModelProfile[], categories: Category[]) {
  const title = paper.revision || paper.data.title ? "编辑论文" : "新增论文";
  const data = JSON.stringify({ paper, categories }).replaceAll("<", "\\u003c");
  const sections = [
    ["basics", "基本信息"], ["chapters", "重点章节"], ["formulas", "核心公式"],
    ["example", "详细算例"], ["limits", "适用范围"],
  ];
  const currentLink = paper.data.title ? `<a class="mast-link" href="${paperUrl(paper.id)}">查看精读</a>` : "";
  return layout(title, manageLink + modelsLink + skillLink + currentLink, `<div class="shell editor-layout">
    <aside class="rail"><nav aria-label="编辑目录"><p class="rail-title">精读内容</p>${sections.map(([id, name]) =>
      `<a href="#edit-${id}">${name}</a>`).join("")}</nav></aside>
    <main class="editor" id="paper-content">
      <header class="manager-head"><div><h1>${title}</h1>
        <p>从 PDF 生成原文截图和精读草稿，或先保存待阅读的论文。</p>
      </div></header>
      <noscript><p>启用 JavaScript 后可以编辑论文。</p></noscript>
      <section class="edit-panel auto-panel" aria-labelledby="auto-title">
        <div class="auto-heading"><h2 id="auto-title">从论文生成精读</h2><a href="/models">配置模型 API ↗</a></div>
        ${profiles.length ? `<form id="generate-paper">
          <div class="editor-grid">
            <label class="editor-field"><span>本地 PDF（选填）</span><input id="research-file" type="file" accept="application/pdf,.pdf"></label>
            <label class="editor-field"><span>论文或 PDF 链接</span><input id="research-url" type="url" placeholder="https://arxiv.org/abs/…" value="${escape(paper.data.source.pdf || paper.data.source.landing)}"></label>
            <label class="editor-field"><span>使用模型 API</span><select id="research-model" required>${profiles.map((profile) =>
              `<option value="${escape(profile.id)}">${escape(profile.name)} · ${escape(profile.model)}</option>`).join("")}</select></label>
            <label class="editor-field"><span>重点章节（选填）</span><input id="research-focus" maxlength="400" placeholder="例如 §3.2、§3.3"></label>
            <label class="editor-field"><span>PDF 页码范围（选填）</span><input id="research-pages" maxlength="100" placeholder="例如 3-5,8，按 PDF 阅读器页码"></label>
          </div>
          <div class="auto-actions"><button class="hero-cta" id="generate-button" type="submit">生成精读草稿</button>
            <p>生成时将 PDF 页面的文字发送给所选模型。草稿含背景、对照译文、公式原理和算例。选取本地 PDF 可生成完整段落对照，保存时保留笔记和截图。</p>
          </div>
          <p id="generate-status" class="action-feedback" role="status" hidden></p>
          <details id="generate-quality" class="action-feedback has-error" hidden>
            <summary>草稿待复核项</summary>
            <ul></ul>
          </details>
        </form>` : '<p>配置一个模型 API 后，可以从论文链接自动生成章节、公式截图和详细算例。</p>'}
      </section>
      <form id="paper-editor">
        ${sections.map(([id, name]) => `<section class="edit-panel" id="edit-${id}"><h2>${name}</h2><div data-fields="${id}"></div></section>`).join("")}
        <div class="editor-actions">
          <p id="editor-status" class="action-feedback" role="status" hidden></p>
          <a class="secondary-action" href="/manage">返回管理</a><button class="hero-cta" id="save-paper" type="submit">保存论文</button>
        </div>
      </form>
      <script id="editor-data" type="application/json">${data}</script>
    </main>
  </div>${topicDialog}`, "/manage.js", true);
}

export function modelsPage(profiles: ModelProfile[]) {
  const data = JSON.stringify(profiles).replaceAll("<", "\\u003c");
  const rows = profiles.map((profile) => `<tr>
    <th scope="row">${escape(profile.name)}</th>
    <td><code>${escape(profile.baseUrl)}</code><small>${escape(profile.model)}</small></td>
    <td>${profile.hasKey ? "已保存" : "未设置"}</td>
    <td class="manage-row-actions"><button type="button" class="text-button" data-model-edit="${profile.id}">编辑</button>
    <button type="button" class="text-button remove-button" data-model-delete="${profile.id}">删除</button></td>
  </tr>`).join("");
  return layout("模型 API", manageLink + catalogueLink, `<main class="shell manager" id="paper-content">
    <header class="manager-head"><div><h1>模型 API</h1>
      <p>可以保存多个 OpenAI 兼容接口。每次生成精读时选择其中一个。</p></div>
      <a class="hero-cta" href="/manage/new">新增论文</a></header>
    ${rows ? `<div class="table-box manage-table">
      <table><thead><tr><th scope="col">配置</th><th scope="col">接口和模型</th><th scope="col">API Key</th><th scope="col">操作</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : '<p class="empty-search">还没有模型 API 配置。</p>'}
    <section class="edit-panel model-panel" aria-labelledby="model-heading">
      <h2 id="model-heading">新增模型配置</h2>
      <form id="model-form">
        <div class="editor-grid">
          <label class="editor-field"><span>配置名称</span><input name="name" maxlength="120" placeholder="例如 日常精读" required></label>
          <label class="editor-field"><span>模型名</span><input name="model" maxlength="200" placeholder="填服务商的模型 ID" required></label>
          <label class="editor-field"><span>Base URL</span><input name="baseUrl" type="url" maxlength="2048" placeholder="https://api.example.com/v1" required></label>
          <label class="editor-field"><span>API Key</span><input name="key" type="password" autocomplete="new-password" maxlength="4096" placeholder="按服务商要求填写"></label>
        </div>
        <label id="clear-key-field" class="clear-key" hidden><input type="checkbox" name="clearKey">清除已保存的 API Key</label>
        <p class="micro">可填 Base URL 或完整的 /chat/completions 地址。已保存的 API Key 加密存储。</p>
        <p id="model-status" class="action-feedback" role="status" hidden></p>
        <div class="confirm-actions"><button class="secondary-action" type="button" id="cancel-model" hidden>取消编辑</button>
          <button class="hero-cta" type="submit">保存配置</button></div>
      </form>
    </section>
    <script id="model-data" type="application/json">${data}</script>
  </main>`, "/manage.js", true);
}
