(() => {
  const ids = ["daily-recommendations", "latest-technology"];
  if (!document.getElementById(ids[0])) return;
  let last = Date.now();
  let pending = false;
  async function refresh() {
    if (pending || document.hidden || Date.now() - last < 300000) return;
    if (ids.some(id => document.getElementById(id)?.contains(document.activeElement)) || !window.getSelection()?.isCollapsed) return;
    pending = true;
    try {
      const response = await fetch("/frontier-feed" + location.search, {cache:"no-store"});
      if (!response.ok) return;
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      for (const id of ids) {
        const old = document.getElementById(id), next = doc.getElementById(id);
        if (!old || !next) continue;
        const open = new Set(Array.from(old.querySelectorAll("details[open]"), d => d.closest("[data-frontier-id]")?.dataset.frontierId ?? "checks"));
        for (const d of next.querySelectorAll("details")) d.open = open.has(d.closest("[data-frontier-id]")?.dataset.frontierId ?? "checks");
        old.replaceWith(next);
      }
      last = Date.now();
    } catch { /* Keep the last verified feed when the connection is unavailable. */ }
    finally { pending = false; }
  }
  document.addEventListener("visibilitychange", refresh);
  window.setInterval(refresh, 300000);
})();
