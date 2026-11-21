(() => {
  "use strict";

  const form = document.getElementById("paper-search");
  const fields = {
    q: document.getElementById("paper-query"),
    topic: document.getElementById("paper-topic"),
    method: document.getElementById("paper-method"),
  };
  const count = document.getElementById("paper-count");
  const empty = document.getElementById("paper-empty");
  const clear = document.getElementById("clear-filters");
  const normalize = (text) => text.normalize("NFKC").toLowerCase().trim();
  const groups = Array.from(document.querySelectorAll("[data-topic]"), (node) => ({
    node,
    papers: Array.from(node.querySelectorAll("[data-paper]"), (paper) => ({
      paper,
      text: normalize(node.querySelector("h3").textContent + " " + paper.textContent),
      tags: JSON.parse(paper.dataset.tags),
      categories: JSON.parse(paper.dataset.categories || JSON.stringify([node.id])),
    })),
  }));
  const total = new Set(groups.flatMap(group => group.papers.map(({ paper }) => paper.dataset.paperId))).size;

  function applyFilters() {
    const words = normalize(fields.q.value).split(/\s+/).filter(Boolean);
    const visibleIds = new Set();
    let visibleEmptyTopic = false;

    for (const { node, papers } of groups) {
      const memberIds = JSON.parse(node.dataset.memberIds || JSON.stringify([node.id]));
      const matchesTopic = !fields.topic.value || memberIds.includes(fields.topic.value);
      let matches = 0;
      for (const { paper, text, tags, categories } of papers) {
        const found = matchesTopic
          && (!fields.topic.value || categories.includes(fields.topic.value))
          && (!fields.method.value || tags.includes(fields.method.value))
          && words.every((word) => text.includes(word));
        paper.hidden = !found;
        if (found) { matches += 1; visibleIds.add(paper.dataset.paperId); }
      }
      const showEmpty = matchesTopic && papers.length === 0 && !fields.method.value && words.length === 0;
      node.hidden = matches === 0 && !showEmpty;
      visibleEmptyTopic ||= showEmpty;
    }

    count.value = visibleIds.size + " / " + total + " 篇";
    empty.hidden = visibleIds.size !== 0 || visibleEmptyTopic;
    clear.disabled = !Object.values(fields).some((field) => field.value);
  }

  function readFilters() {
    const query = new URLSearchParams(window.location.search);
    for (const [name, field] of Object.entries(fields)) {
      field.value = query.get(name) || "";
    }
    applyFilters();
  }

  function updateFilters() {
    applyFilters();
    const url = new URL(window.location.href);
    for (const [name, field] of Object.entries(fields)) {
      if (field.value) url.searchParams.set(name, field.value);
      else url.searchParams.delete(name);
    }
    window.history.replaceState(null, "", url);
  }

  function resetFilters() {
    form.reset();
    updateFilters();
  }

  const rail = Array.from(document.querySelectorAll(".rail nav a[href^='#']"));
  function markCurrentSection() {
    const current = window.location.hash || "#contents";
    for (const link of rail) {
      if (link.hash === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }

  function showHash() {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target?.closest("[data-topic]") && target.closest("[hidden]")) {
      resetFilters();
      target.scrollIntoView();
    }
    markCurrentSection();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateFilters();
  });
  fields.q.addEventListener("input", updateFilters);
  fields.topic.addEventListener("change", updateFilters);
  fields.method.addEventListener("change", updateFilters);
  clear.addEventListener("click", () => {
    resetFilters();
    fields.q.focus();
  });
  window.addEventListener("popstate", readFilters);
  window.addEventListener("hashchange", showHash);
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    const target = link && document.getElementById(link.hash.slice(1));
    if (target?.closest("[data-topic]") && target.closest("[hidden]")) {
      resetFilters();
    }
  });

  form.hidden = false;
  readFilters();
  showHash();
})();

