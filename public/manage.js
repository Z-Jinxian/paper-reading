(() => {
  "use strict";

  const get = (id) => document.getElementById(id);
  const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const display = (node, text, problem = false) => {
    node.textContent = text;
    node.hidden = !text;
    node.classList.toggle("has-error", problem);
  };

  async function api(path, method, data) {
    const multipart = data instanceof FormData;
    const headers = { "X-Notebook-Request": "1" };
    if (data && !multipart) headers["Content-Type"] = "application/json";
    const response = await fetch(path, {
      method, headers, body: data ? multipart ? data : JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      throw new Error(details?.error || "操作暂时失败，请稍后重试。");
    }
    return response;
  }

  const management = get("management-status");
  const paperFeedback = management || get("catalogue-status");
  if (paperFeedback) {
    const query = get("management-query");
    if (query) {
      const rows = Array.from(document.querySelectorAll("[data-manage-row]"));
      query.addEventListener("input", () => {
        const search = query.value.toLocaleLowerCase().trim();
        for (const row of rows) row.hidden = !row.textContent.toLocaleLowerCase().includes(search);
        get("management-empty").hidden = rows.some((row) => !row.hidden);
      });
    }

    const dialog = get("remove-dialog");
    const confirmation = get("confirm-remove");
    let selected = null;

    async function change(button, remove) {
      const { id, revision } = button.dataset;
      button.disabled = true;
      confirmation.disabled = true;
      try {
        await api("/api/papers/" + id + (remove ? "" : "/restore"), remove ? "DELETE" : "POST", { revision: Number(revision) });
        if (management) {
          window.location.assign("/manage?notice=" + (remove ? "removed" : "restored"));
        } else {
          const library = new URL(window.location.href);
          library.searchParams.set("notice", "removed");
          library.hash = "recommendations";
          window.location.assign(library);
        }
      } catch (error) {
        dialog.close();
        display(paperFeedback, error.message, true);
        paperFeedback.scrollIntoView({ block: "nearest" });
      } finally {
        button.disabled = false;
        confirmation.disabled = false;
      }
    }

    get("cancel-remove").addEventListener("click", () => dialog.close());
    confirmation.addEventListener("click", () => { if (selected) change(selected, true); });
    for (const button of document.querySelectorAll("[data-paper-action]")) {
      button.addEventListener("click", () => {
        if (button.dataset.paperAction === "restore") {
          change(button, false);
          return;
        }
        selected = button;
        get("remove-description").textContent = "将《" + button.dataset.title + "》移入回收站？原文截图和笔记会一起保留。";
        dialog.showModal();
      });
    }
  }

  const topicForm = get("topic-form");
  if (topicForm) {
    const dialog = get("topic-dialog");
    const name = get("topic-name");
    const feedback = get("topic-status");
    const cancel = get("cancel-topic");
    const submit = topicForm.querySelector('[type="submit"]');

    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-create-topic]")) return;
      topicForm.reset();
      display(feedback, "");
      dialog.showModal();
    });
    cancel.addEventListener("click", () => dialog.close());
    dialog.addEventListener("cancel", (event) => {
      if (submit.disabled) event.preventDefault();
    });
    topicForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = cancel.disabled = true;
      display(feedback, "");
      try {
        const response = await api("/api/topics", "POST", { name: name.value });
        const topic = await response.json();
        dialog.close();
        if (get("paper-editor")) {
          document.dispatchEvent(new CustomEvent("paper-topic-created", { detail: topic }));
        } else {
          window.location.assign("/?topic=" + encodeURIComponent(topic.id) + "#recommendations");
        }
      } catch (error) {
        display(feedback, error.message, true);
      } finally {
        submit.disabled = cancel.disabled = false;
      }
    });
  }

  const modelForm = get("model-form");
  if (modelForm) {
    const profiles = JSON.parse(get("model-data").textContent);
    const status = get("model-status");
    const cancel = get("cancel-model");
    const field = (name) => modelForm.elements.namedItem(name);
    let editing = null;

    function select(profile) {
      editing = profile?.id ?? null;
      modelForm.reset();
      get("model-heading").textContent = profile ? "编辑模型配置" : "新增模型配置";
      field("name").value = profile?.name ?? "";
      field("baseUrl").value = profile?.baseUrl ?? "";
      field("model").value = profile?.model ?? "";
      field("key").placeholder = profile?.hasKey ? "留空会继续使用已保存的 Key" : "按服务商要求填写";
      get("clear-key-field").hidden = !profile?.hasKey;
      cancel.hidden = !profile;
      display(status, "");
      if (profile) field("name").focus();
    }

    cancel.addEventListener("click", () => select(null));
    for (const button of document.querySelectorAll("[data-model-edit]")) {
      button.addEventListener("click", () => select(profiles.find((profile) => profile.id === button.dataset.modelEdit)));
    }
    for (const button of document.querySelectorAll("[data-model-delete]")) {
      button.addEventListener("click", async () => {
        const profile = profiles.find((item) => item.id === button.dataset.modelDelete);
        if (!profile || !window.confirm("删除模型配置「" + profile.name + "」？")) return;
        button.disabled = true;
        try {
          await api("/api/models/" + profile.id, "DELETE");
          window.location.reload();
        } catch (error) {
          display(status, error.message, true);
          button.disabled = false;
        }
      });
    }

    modelForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = modelForm.querySelector('[type="submit"]');
      submit.disabled = true;
      display(status, "正在保存配置…");
      try {
        await api("/api/models", "POST", {
          id: editing, name: field("name").value, baseUrl: field("baseUrl").value,
          model: field("model").value, key: field("key").value, clearKey: field("clearKey").checked,
        });
        field("key").value = "";
        window.location.reload();
      } catch (error) {
        display(status, error.message, true);
        submit.disabled = false;
      }
    });
  }

  const form = get("paper-editor");
  if (!form) return;
  const { paper, categories } = JSON.parse(get("editor-data").textContent);
  const saved = get("save-paper");
  const notice = get("editor-status");
  const generate = get("generate-paper");
  const generateButton = get("generate-button");
  const blocks = {
    basics: form.querySelector('[data-fields="basics"]'),
    chapters: form.querySelector('[data-fields="chapters"]'),
    formulas: form.querySelector('[data-fields="formulas"]'),
    example: form.querySelector('[data-fields="example"]'),
    limits: form.querySelector('[data-fields="limits"]'),
  };
  const staged = new Map();
  let dirty = false;

  function input(label, name, value, opts = {}) {
    const { placeholder = "", type = "text", maxlength = 350, required = false, wide = false } = opts;
    const extra = type === "number" ? 'min="1" step="1"' : 'maxlength="' + maxlength + '"';
    return `<label class="editor-field ${wide ? "wide" : ""}"><span>${label}</span>
      <input name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra} ${required ? "required" : ""}></label>`;
  }
  function textarea(label, name, value, placeholder = "", rows = 3) {
    return `<label class="editor-field wide"><span>${label}</span>
      <textarea name="${name}" rows="${rows}" maxlength="12000" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  }
  const joined = (value) => Array.isArray(value) ? value.join("\n") : "";
  const splitLines = (value) => value.split("\n").map((line) => line.trim()).filter(Boolean);
  const value = (node, name) => node.querySelector('[name="' + name + '"]')?.value.trim() || "";

  function imageMarkup(item, temporary) {
    const preview = temporary || item.asset;
    return `<div class="auto-evidence wide" data-asset="${esc(item.asset)}">
      <div><strong>原文截图</strong><span>${preview ? "来自所用 PDF" : "生成精读后显示原文裁片"}</span></div>
      ${preview ? `<img src="${esc(preview)}" alt="${esc(item.alt || "原文截图")}" loading="lazy">` : ""}
      <input type="hidden" name="alt" value="${esc(item.alt)}">
    </div>`;
  }

  function addBlock(parent, kind, item = {}, image) {
    const root = document.createElement("fieldset");
    root.className = "edit-block";
    root.dataset.kind = kind;
    const title = { section: "重点章节", formula: "核心公式", step: "算例步骤" }[kind];
    const heading = kind === "section" ? input("节号和标题", "heading", item.heading, { placeholder: "例如 `3.2 在线更新", wide: true }) : "";
    const pages = input("原文 PDF 页码", "page", item.page, { type: "number" });
    let fields;
    if (kind === "section") {
      fields = heading + pages + textarea("为什么值得读", "why", item.why)
        + textarea("要看哪些细节", "details", joined(item.details), "每行写一条关键细节");
    } else if (kind === "formula") {
      const symbols = Array.isArray(item.symbols) ? item.symbols.map((pair) => pair.join("｜")).join("\n") : "";
      fields = input("公式名称", "name", item.name, { wide: true })
        + input("原文式号或算法编号", "original", item.original) + pages
        + textarea("抽象数学公式（LaTeX）", "latex", item.latex, "例如 w_i = \\exp(-\\ell_i/\\tau)", 2)
        + textarea("符号与含义", "symbols", symbols, "每行一条，格式：LaTeX 符号｜中文含义")
        + textarea("原文公式怎么理解", "steps", joined(item.steps), "每行写一步，说明输入、作用和计算过程")
        + textarea("使用条件", "scope", item.scope, "", 2);
    } else {
      fields = input("这一步做什么", "label", item.label, { wide: true })
        + textarea("数字、运算和结果", "text", item.text)
        + textarea("计算式（可选 LaTeX）", "latex", item.latex, "", 2);
    }
    const temporary = image ? URL.createObjectURL(image) : "";
    if (image) staged.set(root, { image, temporary });
    root.innerHTML = `<legend>${title}</legend><div class="editor-grid">${fields}
      ${kind === "step" ? "" : imageMarkup(item, temporary)}</div>
      <button type="button" class="text-button remove-button block-remove" data-drop-block>移除这一项</button>`;
    parent.append(root);
    return root;
  }

  const repeat = (kind, label) => `<div data-blocks="${kind}"></div><button type="button" class="secondary-action add-block" data-add-block="${kind}">＋ ${label}</button>`;
  function paint(note, images = {}) {
    for (const { temporary } of staged.values()) URL.revokeObjectURL(temporary);
    staged.clear();
    const source = note.source || {};
    blocks.basics.innerHTML = `<div class="editor-grid">
      ${input("论文标题", "title", note.title, { maxlength: 600, required: true, wide: true })}
      <div class="editor-topic-field">
        <label class="editor-field"><span>专题</span><select name="category">
          ${categories.map((category) => `<option value="${esc(category.id)}" ${category.id === note.category ? "selected" : ""}>${esc(category.label)}</option>`).join("")}
        </select></label>
        <button type="button" class="text-button" data-create-topic>新建专题</button>
      </div>
      ${input("会议、期刊或年份", "venue", note.venue)}
      ${input("论文出处链接", "landing", source.landing, { type: "url", maxlength: 2048 })}
      ${input("原文 PDF 链接", "pdf", source.pdf, { type: "url", maxlength: 2048 })}
      ${input("原文版本", "version", source.version)}
      ${input("方法标签", "tags", Array.isArray(note.tags) ? note.tags.join("，") : "", { placeholder: "用逗号分隔，例如 数据回放，防遗忘" })}
      ${textarea("一句话概括", "thesis", note.thesis, "", 2)}
      ${textarea("推荐理由", "reason", note.reason, "", 2)}
      ${textarea("来源与页码说明", "source-note", source.note, "", 2)}
    </div>`;
    blocks.chapters.innerHTML = repeat("section", "添加重点章节");
    blocks.formulas.innerHTML = repeat("formula", "添加核心公式");
    const example = note.example || {};
    blocks.example.innerHTML = `<div class="editor-grid">
      ${input("例子标题", "example-title", example.title, { wide: true })}
      ${textarea("设定和已知数字", "setup", example.setup, "", 2)}
    </div>${repeat("step", "添加计算步骤")}
      ${textarea("计算结论", "takeaway", example.takeaway, "", 2)}`;
    blocks.limits.innerHTML = textarea("实验适用范围与证据", "limits", joined(note.limits), "每行写一条限制或适用条件");
    for (const [kind, rows] of [["section", note.sections], ["formula", note.formulas], ["step", example.steps]]) {
      const parent = form.querySelector('[data-blocks="' + kind + '"]');
      const initial = Array.isArray(rows) && rows.length ? rows : [{}];
      initial.forEach((item, index) => addBlock(parent, kind, item, images[kind]?.[index]));
    }
  }

  function gather() {
    const data = new FormData();
    const evidence = (block, kind, index) => {
      const image = staged.get(block)?.image;
      if (image) data.append(kind + "-" + index, image, "original.png");
      return { page: value(block, "page") || null, asset: block.querySelector("[data-asset]").dataset.asset, alt: value(block, "alt") };
    };
    const readBlocks = (kind, read) => Array.from(form.querySelectorAll('[data-kind="' + kind + '"]'), read);
    const chapters = readBlocks("section", (block, index) => ({
      heading: value(block, "heading"), why: value(block, "why"), details: splitLines(value(block, "details")),
      ...evidence(block, "section", index),
    }));
    const formulas = readBlocks("formula", (block, index) => ({
      name: value(block, "name"), original: value(block, "original"), latex: value(block, "latex"),
      symbols: splitLines(value(block, "symbols")).map((row) => {
        const separator = row.indexOf("｜");
        return separator < 0 ? [row, ""] : [row.slice(0, separator), row.slice(separator + 1)];
      }),
      steps: splitLines(value(block, "steps")), scope: value(block, "scope"),
      ...evidence(block, "formula", index),
    }));
    const steps = readBlocks("step", (block) => ({
      label: value(block, "label"), text: value(block, "text"), latex: value(block, "latex"),
    }));
    const basics = blocks.basics;
    const note = {
      title: value(basics, "title"), category: value(basics, "category"), venue: value(basics, "venue"),
      reason: value(basics, "reason"), thesis: value(basics, "thesis"),
      tags: value(basics, "tags").split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean),
      source: { landing: value(basics, "landing"), pdf: value(basics, "pdf"), version: value(basics, "version"), note: value(basics, "source-note") },
      sections: chapters, formulas,
      example: { title: value(blocks.example, "example-title"), setup: value(blocks.example, "setup"), steps, takeaway: value(blocks.example, "takeaway") },
      limits: splitLines(value(blocks.limits, "limits")),
    };
    data.append("revision", String(paper.revision));
    data.append("note", JSON.stringify(note));
    return data;
  }

  paint(paper.data);
  document.addEventListener("paper-topic-created", (event) => {
    const topic = event.detail;
    categories.push(topic);
    const choice = blocks.basics.querySelector('select[name="category"]');
    choice.add(new Option(topic.label, topic.id));
    choice.value = topic.id;
    dirty = true;
  });
  form.addEventListener("input", () => { dirty = true; });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  form.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add-block]");
    const drop = event.target.closest("[data-drop-block]");
    if (add) {
      const kind = add.dataset.addBlock;
      const list = form.querySelector('[data-blocks="' + kind + '"]');
      if (list.children.length >= (kind === "step" ? 24 : 12)) {
        display(notice, "这一组的条目已达到上限。", true);
        return;
      }
      addBlock(list, kind).querySelector("input")?.focus();
      dirty = true;
    }
    if (drop) {
      const block = drop.closest("[data-kind]");
      const image = staged.get(block);
      if (image) URL.revokeObjectURL(image.temporary);
      staged.delete(block);
      block.remove();
      dirty = true;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saved.disabled) return;
    saved.disabled = true;
    if (generateButton) generateButton.disabled = true;
    display(notice, "正在保存论文…");
    try {
      const response = await api("/api/papers/" + paper.id, "PUT", gather());
      const result = await response.json();
      dirty = false;
      window.location.assign(result.url);
    } catch (error) {
      display(notice, error.message, true);
    } finally {
      saved.disabled = false;
      if (generateButton) generateButton.disabled = false;
    }
  });

  if (!generate) return;
  generate.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = get("research-url").value.trim();
    const modelId = get("research-model").value;
    const status = get("generate-status");
    let opened;
    generateButton.disabled = true;
    saved.disabled = true;
    display(status, "正在读取论文 PDF…");
    try {
      const response = await api("/api/research/pdf", "POST", { url });
      const pdf = response.headers.get("x-source-pdf");
      if (!pdf) throw new Error("论文来源信息缺失，请重试。");
      const { openPaper, originalClip } = await import("/paper-pdf.js");
      opened = await openPaper(new Uint8Array(await response.arrayBuffer()), (number, total) => {
        display(status, "正在定位原文，第 " + number + " / " + total + " 页…");
      });
      display(status, "模型正在整理章节、公式和数值例子…");
      const analysis = await api("/api/research/analyze", "POST", { modelId, pages: opened.pages });
      const draft = await analysis.json();
      const images = { section: [], formula: [] };
      let missed = 0;
      display(status, "正在从原文 PDF 裁出章节和公式截图…");
      for (const [kind, list] of [["section", draft.sections], ["formula", draft.formulas]]) {
        for (const entry of list) {
          entry.page = entry.evidence.page;
          entry.alt = (entry.heading || entry.original || entry.name || "原文") + "截图";
          entry.asset = "";
          try {
            images[kind].push(await originalClip(opened, entry.evidence, kind));
          } catch {
            missed++;
            images[kind].push(null);
          }
        }
      }
      const scope = opened.pages.length === opened.pageCount ? "" :
        "本次模型阅读了 " + opened.pages.length + " / " + opened.pageCount + " 页。截图页码按 PDF 从 1 开始。";
      paint({
        ...draft, category: value(blocks.basics, "category"),
        source: { landing: url, pdf, version: "原文 PDF · " + opened.pageCount + " 页", note: scope },
      }, images);
      dirty = true;
      display(status, missed ? "精读草稿已填入。有 " + missed + " 处裁图无法可靠定位，页码已保留。可以换一个模型重试。" :
        "精读草稿和原文截图已填入下方。核对后点击保存论文。", Boolean(missed));
    } catch (error) {
      display(status, error.message || "生成精读失败，请稍后重试。", true);
    } finally {
      if (opened) await opened.job.destroy().catch(() => {});
      generateButton.disabled = false;
      saved.disabled = false;
    }
  });
})();
