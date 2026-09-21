const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../viewer_theme.js"), "utf8");

function openTheme({ saved = null, dark = false, blocked = false } = {}) {
  const events = {};
  const attributes = {};
  const button = { setAttribute: (name, value) => { attributes[name] = value; }, addEventListener: (name, fn) => { events[name] = fn; } };
  const label = {};
  const root = { dataset: {} };
  const media = { matches: dark, addEventListener: (name, fn) => { events.system = fn; } };
  let stored = saved;
  let changes = 0;
  vm.runInNewContext(source, {
    document: {
      documentElement: root,
      getElementById: (id) => id === "theme-toggle" ? button : label,
      addEventListener: (name, fn) => { events[name] = fn; },
    },
    matchMedia: () => media,
    localStorage: {
      getItem() { if (blocked) throw new Error("Storage disabled"); return stored; },
      setItem(key, value) { if (blocked) throw new Error("Storage disabled"); assert.equal(key, "gds-viewer-theme"); stored = value; },
    },
    Event: class { constructor(type) { this.type = type; } },
    window: { dispatchEvent(event) { assert.equal(event.type, "viewer-theme-change"); changes += 1; } },
  });
  return { root, attributes, label, events, media, stored: () => stored, changes: () => changes };
}

test("theme is set before DOM ready and follows system changes until manually selected", () => {
  const page = openTheme({ dark: true });
  assert.equal(page.root.dataset.theme, "night");
  page.events.DOMContentLoaded();
  page.media.matches = false;
  page.events.system();
  assert.equal(page.root.dataset.theme, "day");
  page.events.click();
  assert.equal(page.root.dataset.theme, "night");
  assert.equal(page.label.textContent, "Day");
  assert.equal(page.attributes["aria-label"], "Switch to day mode");
  assert.equal(page.attributes["aria-pressed"], "true");
  assert.equal(page.stored(), "night");
  page.events.system();
  assert.equal(page.root.dataset.theme, "night");
  assert.equal(page.changes(), 4);
});

test("saved day and night choices survive reopening and override the OS", () => {
  for (const saved of ["day", "night"]) {
    const page = openTheme({ saved, dark: saved === "day" });
    assert.equal(page.root.dataset.theme, saved);
    page.events.DOMContentLoaded();
    page.events.click();
    const next = saved === "day" ? "night" : "day";
    assert.equal(openTheme({ saved: page.stored() }).root.dataset.theme, next);
  }
});

test("blocked storage and invalid preferences leave day/night controls usable", () => {
  for (const options of [{ blocked: true }, { saved: "invalid" }]) {
    const page = openTheme(options);
    assert.equal(page.root.dataset.theme, "day");
    page.events.DOMContentLoaded();
    page.events.click();
    assert.equal(page.root.dataset.theme, "night");
    page.events.click();
    assert.equal(page.root.dataset.theme, "day");
    assert.equal(page.attributes["aria-pressed"], "false");
  }
});
