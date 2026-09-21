// Run before styles paint; only the appearance preference is stored, never layouts.
(() => {
  "use strict";
  const root = document.documentElement;
  const systemTheme = matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "gds-viewer-theme";
  let preference = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "day" || saved === "night") preference = saved;
  } catch {
    // Storage may be unavailable for direct-file or privacy-restricted browsing.
  }

  function applyTheme() {
    const theme = preference || (systemTheme.matches ? "night" : "day");
    root.dataset.theme = theme;
    const button = document.getElementById("theme-toggle");
    if (button) {
      const next = theme === "night" ? "day" : "night";
      button.setAttribute("aria-label", `Switch to ${next} mode`);
      button.setAttribute("aria-pressed", String(theme === "night"));
      button.title = `Switch to ${next} mode`;
      document.getElementById("theme-label").textContent = next === "night" ? "Night" : "Day";
    }
    window.dispatchEvent(new Event("viewer-theme-change"));
  }

  applyTheme();
  systemTheme.addEventListener("change", () => {
    if (!preference) applyTheme();
  });
  document.addEventListener("DOMContentLoaded", () => {
    applyTheme();
    document.getElementById("theme-toggle").addEventListener("click", () => {
      preference = root.dataset.theme === "night" ? "day" : "night";
      try { localStorage.setItem(storageKey, preference); } catch { /* Session-only choice. */ }
      applyTheme();
    });
  }, { once: true });
})();
