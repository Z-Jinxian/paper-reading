(() => {
  "use strict";

  const get = (id) => document.getElementById(id);

  const dialog = get("source-dialog");
  const largeImage = get("large-source");
  const largeLink = get("large-source-link");
  document.querySelectorAll("[data-zoom]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const thumbnail = trigger.querySelector("img");
      const source = trigger.closest("figure").querySelector("figcaption a");
      largeImage.src = thumbnail.src;
      largeImage.alt = thumbnail.alt;
      largeLink.hidden = !source;
      if (source) {
        largeLink.href = source.href;
        largeLink.textContent = source.textContent;
      }
      dialog.showModal();
    });
  });
  get("close-source").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  const railLinks = Array.from(document.querySelectorAll(".rail nav a"));
  function markCurrentSection() {
    const current = window.location.hash || "#chapters";
    railLinks.forEach((link) => {
      if (link.hash === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", markCurrentSection);

  markCurrentSection();
})();
