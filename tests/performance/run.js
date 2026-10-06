const frame = document.getElementById("viewer");
const results = document.getElementById("results");
const run = document.getElementById("run");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const raf = (win) => new Promise((resolve) => win.requestAnimationFrame(resolve));
async function until(test) {
  const deadline = performance.now() + 120000;
  while (!test()) {
    if (performance.now() > deadline) throw new Error("Load exceeded 120 seconds");
    await pause(4);
  }
}
run.addEventListener("click", async () => {
  run.disabled = true;
  const measureMemory = document.getElementById("memory").checked;
  const report = { userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], target: document.getElementById("target").value, samples: [], memory: [] };
  const show = () => { results.textContent = JSON.stringify(report, null, 2); };
  try {
    for (const scenario of BenchmarkFixtures.cases) {
      if (document.getElementById("case").value && document.getElementById("case").value !== scenario.name) continue;
      const bytes = BenchmarkFixtures.makeLayout(scenario);
      const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
      frame.src = report.target;
      await loaded;
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      const get = (id) => doc.getElementById(id);
      let parseMs = 0;
      let modelMs = 0;
      let groupCount = 0;
      let templateCount = 0;
      for (const [name, reportTime] of [
        ["parseGds", (time) => { parseMs = time; }],
        ["buildGdsViewModel", (time, model) => { modelMs = time; groupCount = model.groups.length; templateCount = model.templates.length; }],
      ]) {
        const original = win.GdsParser[name];
        win.GdsParser[name] = function (...args) {
          const start = performance.now();
          const value = original.apply(this, args);
          reportTime(performance.now() - start, value);
          return value;
        };
      }
      let graphicsCreated = 0;
      let contexts = new Map();
      const Graphics = win.PIXI.Graphics;
      win.PIXI.Graphics = class extends Graphics {
        constructor(...args) {
          super(...args);
          graphicsCreated += 1;
          if (args[0]) contexts.set(args[0].uid, new WeakRef(args[0]));
        }
      };
      for (let repeat = 0; repeat < 3; repeat += 1) {
        await pause(250);
        let maxFrameGapMs = 0;
        let previous = performance.now();
        let ticking = true;
        const tick = () => {
          const now = performance.now();
          maxFrameGapMs = Math.max(maxFrameGapMs, now - previous);
          previous = now;
          if (ticking) win.requestAnimationFrame(tick);
        };
        win.requestAnimationFrame(tick);
        const heapBefore = win.performance.memory?.usedJSHeapSize;
        const longTasks = [];
        const observer = new win.PerformanceObserver((list) => longTasks.push(...list.getEntries().map((entry) => entry.duration)));
        observer.observe({ type: "longtask" });
        graphicsCreated = 0;
        contexts = new Map();
        const start = performance.now();
        const transfer = new win.DataTransfer();
        transfer.items.add(new win.File([bytes], `${scenario.name}-${repeat}.gds`));
        get("file-input").files = transfer.files;
        get("file-input").dispatchEvent(new win.Event("change", { bubbles: true }));
        await until(() => !get("apply-options-button").disabled && get("warning").textContent === "");
        await raf(win);
        await raf(win);
        const loadMs = performance.now() - start;
        ticking = false;
        await pause(30);
        observer.disconnect();
        const styles = new Set();
        for (const ref of contexts.values()) {
          for (const instruction of ref.deref()?.instructions || []) {
            if (instruction.data.style) styles.add(instruction.data.style);
          }
        }
        const sample = { case: scenario.name, repeat, bytes: bytes.length, loadMs, parseMs, modelMs, maxFrameGapMs,
          longTaskMs: longTasks.reduce((a, b) => a + b, 0), heapBefore, heapAfter: win.performance.memory?.usedJSHeapSize,
          graphicsCreated, groupCount, templateCount, styleCount: styles.size, treeRows: doc.querySelectorAll(".cell-chip").length, status: get("status").textContent };
        report.samples.push(sample);
        show();
      }
      if (measureMemory) {
        if (!performance.measureUserAgentSpecificMemory) throw new Error("Retained-memory API unavailable in this browser; use allocation counts and a DevTools heap snapshot instead.");
        report.waitingForMemory = scenario.name;
        show();
        const memory = await performance.measureUserAgentSpecificMemory();
        report.memory.push({ case: scenario.name, bytes: memory.bytes });
        delete report.waitingForMemory;
        show();
      }
    }
    report.complete = true;
  } catch (error) { report.error = String(error); }
  show();
  const save = document.getElementById("save");
  if (save.href.startsWith("blob:")) URL.revokeObjectURL(save.href);
  save.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  save.download = report.target === "/" ? "after.json" : "before.json";
  save.hidden = false;
  run.disabled = false;
});
