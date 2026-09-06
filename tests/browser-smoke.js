// Browser integration tests using standard DOM APIs and the real Pixi renderer.
const frame = document.getElementById("viewer");
const results = document.getElementById("results");
const runButton = document.getElementById("run");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const pause = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(predicate, message) {
  const deadline = performance.now() + 15000;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${message}`);
    await pause();
  }
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  results.textContent = "Running...\n";
  let passed = 0;
  const check = async (name, action) => {
    await action();
    passed += 1;
    results.textContent += `PASS ${name}\n`;
  };
  try {
    frame.src = "../index.html";
    await new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    const get = (id) => doc.getElementById(id);
    const warning = () => get("warning").textContent;
    const status = () => get("status").textContent;
    const ready = () => !get("apply-options-button").disabled;
    const bytes = {};
    for (const name of ["hierarchy", "roots", "empty-cell", "empty-library", "round-path"]) {
      const response = await fetch(`./fixtures/${name}.gds`);
      assert(response.ok, `Fixture ${name} is missing`);
      bytes[name] = await response.arrayBuffer();
    }
    const selectFile = (data, name = "fixture.gds", drop = false) => {
      const transfer = new win.DataTransfer();
      transfer.items.add(new win.File([data], name));
      if (drop) {
        doc.querySelector(".stage").dispatchEvent(new win.DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
      } else {
        get("file-input").files = transfer.files;
        get("file-input").dispatchEvent(new win.Event("change", { bubbles: true }));
      }
    };
    const load = async (data, name, drop = false) => {
      selectFile(data, name, drop);
      await until(() => ready() && warning() === "" && doc.title === `GDS Viewer: ${name}`, `load ${name}: ${warning()}`);
    };
    const apply = async (cell, depth) => {
      get("cell-select").value = cell;
      get("depth-input").value = depth;
      get("view-options").requestSubmit();
      await until(() => ready() && warning() === "", "apply options");
    };
    const host = get("pixi-host");
    const pointer = (type, x, y, button = 0) => host.dispatchEvent(new win.PointerEvent(type, {
      bubbles: true, clientX: x, clientY: y, button,
    }));

    await check("static startup and safe empty controls", async () => {
      assert(/Choose a GDS/.test(warning()), warning());
      assert(!ready(), "View options enabled without a file");
      get("show-all-button").click();
      get("hide-all-button").click();
      get("fit-button").click();
      assert(win.performance.getEntriesByType("resource").every((item) => !/\/api\//.test(item.name)), "Startup called an API");
    });
    await check("file picker renders hierarchy", async () => {
      await load(bytes.hierarchy, "hierarchy.gds");
      assert(/Visible polygons: 9$/.test(status()), status());
      assert(doc.querySelectorAll("canvas").length === 1, "Missing or duplicate canvas");
      assert(get("cell-select").options.length === 5, "Missing cell options");
    });
    await check("root selection and depth controls", async () => {
      await apply("TOP", "0");
      assert(/Visible polygons: 1$/.test(status()), status());
      await apply("LEAF", "");
      assert(/Visible polygons: 2$/.test(status()), status());
      get("depth-input").value = "-1";
      assert(!get("view-options").checkValidity(), "Negative depth was accepted");
      get("depth-input").value = "1.5";
      assert(!get("view-options").checkValidity(), "Fractional depth was accepted");
      await apply("", "");
      assert(/Visible polygons: 9$/.test(status()), status());
    });
    await check("layer and cell visibility", async () => {
      doc.querySelector('[data-key="L7/D3"]').click();
      assert(/Visible polygons: 5$/.test(status()), status());
      doc.querySelector('.cell-chip[data-key="TOP"]').click();
      assert(/Visible polygons: 0$/.test(status()), status());
      get("show-all-button").click();
      assert(/Visible polygons: 9$/.test(status()), status());
      get("hide-all-button").click();
      assert(/Visible polygons: 0$/.test(status()), status());
      get("show-all-button").click();
    });
    await check("wheel and keyboard zoom, pan, fit, grid, scale, pointer", async () => {
      const scale = () => get("scale-bar-label").textContent + get("scale-bar-line").style.width;
      const fitted = scale();
      const rect = host.getBoundingClientRect();
      const x = rect.left + 200;
      const y = rect.top + 200;
      host.dispatchEvent(new win.WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: -100 }));
      assert(scale() !== fitted, "Wheel zoom did not change scale");
      get("fit-button").click();
      assert(scale() === fitted, "Fit did not restore scale");
      win.dispatchEvent(new win.KeyboardEvent("keydown", { key: "z" }));
      await pause(60);
      win.dispatchEvent(new win.KeyboardEvent("keyup", { key: "z" }));
      assert(scale() !== fitted, "Keyboard zoom did not change scale");
      get("fit-button").click();
      get("grid-button").click();
      assert(get("grid-button").classList.contains("is-active"), "Grid toggle failed");
      get("measure-button").click();
      pointer("pointermove", x, y);
      const before = get("pointer-status").textContent;
      pointer("pointerdown", x, y, 2);
      pointer("pointermove", x + 80, y + 60, 2);
      pointer("pointerup", x + 80, y + 60, 2);
      pointer("pointermove", x, y);
      assert(before !== get("pointer-status").textContent, "Pan did not change pointer coordinates");
      assert(get("pointer-status").style.display !== "none", "Pointer status hidden");
      get("fit-button").click();
    });
    await check("measurements, deletion, and option reset", async () => {
      const rect = host.getBoundingClientRect();
      pointer("pointerdown", rect.left + 120, rect.top + 200);
      pointer("pointerdown", rect.left + 220, rect.top + 250);
      assert(doc.querySelectorAll(".measurement-item").length === 1, "Measurement missing");
      doc.querySelector(".measurement-delete").click();
      assert(doc.querySelectorAll(".measurement-item").length === 0, "Delete failed");
      pointer("pointerdown", rect.left + 150, rect.top + 180);
      pointer("pointerdown", rect.left + 250, rect.top + 230);
      await apply("TOP", "0");
      assert(doc.querySelectorAll(".measurement-item").length === 0, "Options retained stale measurements");
    });
    await check("resize preserves a correctly sized canvas", async () => {
      frame.style.width = "850px";
      await pause(150);
      const canvas = doc.querySelector("canvas");
      assert(Math.abs(canvas.getBoundingClientRect().width - host.clientWidth) <= 1, "Canvas did not resize");
      frame.style.width = "1100px";
      await pause(150);
    });
    await check("drop loading, multiple roots, and filename escaping", async () => {
      await load(bytes.roots, "layout <img src=x>.gds", true);
      assert(/Visible polygons: 2$/.test(status()), status());
      assert(!doc.querySelector(".title img"), "Filename became HTML");
      await apply("B", "0");
      assert(/Visible polygons: 1$/.test(status()), status());
    });
    await check("empty layouts and errors preserve the previous view", async () => {
      await load(bytes["empty-cell"], "empty-cell.gds");
      assert(/Visible polygons: 0$/.test(status()), status());
      for (const [data, name, message] of [
        [bytes["empty-library"], "empty.gds", /No cells/],
        [bytes["round-path"], "round.gds", /Round-ended/],
        [new Uint8Array([0, 6, 0, 2, 0]), "bad.gds", /byte 0/],
      ]) {
        selectFile(data, name);
        await until(() => ready() && message.test(warning()), `error for ${name}`);
        assert(doc.title === "GDS Viewer: empty-cell.gds", "Failed load replaced the view");
      }
    });
    await check("latest selected file wins over a slow earlier read", async () => {
      const original = win.File.prototype.arrayBuffer;
      let release;
      win.File.prototype.arrayBuffer = function () {
        return this.name === "slow.gds" ? new Promise((resolve) => { release = resolve; }) : original.call(this);
      };
      try {
        selectFile(bytes.hierarchy, "slow.gds");
        await load(bytes.roots, "newest.gds");
        release(bytes.hierarchy);
        await pause(100);
        assert(doc.title === "GDS Viewer: newest.gds", "Stale read overwrote latest file");
      } finally {
        win.File.prototype.arrayBuffer = original;
      }
    });
    await check("a failed newer selection keeps controls paired with the finishing render", async () => {
      const original = win.requestAnimationFrame;
      let release;
      win.requestAnimationFrame = function (callback) {
        win.requestAnimationFrame = original;
        release = () => original.call(win, callback);
        return 0;
      };
      try {
        selectFile(bytes.hierarchy, "finishing.gds");
        await until(() => Boolean(release), "render frame pause");
        selectFile(new Uint8Array([0, 6, 0, 2, 0]), "newer-invalid.gds");
        await pause();
        release();
        await until(() => ready() && /byte 0/.test(warning()), "newer file error");
        assert(doc.title === "GDS Viewer: finishing.gds", "Finishing render was lost");
        await apply("LEAF", "");
        assert(/Visible polygons: 2$/.test(status()), "Options used a different library from the displayed file");
      } finally {
        win.requestAnimationFrame = original;
      }
    });
    await check("repeated dense hierarchical loads release graphics contexts", async () => {
      const dense = bytes.hierarchy.slice(0);
      const view = new DataView(dense);
      for (let offset = 0; offset < view.byteLength; offset += view.getUint16(offset)) {
        if (view.getUint8(offset + 2) === 0x13) {
          view.setInt16(offset + 4, 32);
          view.setInt16(offset + 6, 32);
        }
      }
      const prototype = win.PIXI.GraphicsContext.prototype;
      const destroy = prototype.destroy;
      let destroyed = 0;
      prototype.destroy = function (...args) { destroyed += 1; return destroy.apply(this, args); };
      try {
        for (let index = 0; index < 5; index += 1) {
          await load(dense, `dense-${index}.gds`);
          assert(/Visible polygons: 2049$/.test(status()), status());
          assert(doc.querySelectorAll("canvas").length === 1, "Canvas accumulated across reloads");
        }
        assert(destroyed >= 12, `Old graphics contexts were not released: ${destroyed}`);
      } finally {
        prototype.destroy = destroy;
      }
    });
    await check("missing PixiJS produces an actionable startup error", async () => {
      const broken = document.createElement("iframe");
      document.body.appendChild(broken);
      try {
        const html = await (await fetch("../index.html")).text();
        const loaded = new Promise((resolve) => broken.addEventListener("load", resolve, { once: true }));
        broken.srcdoc = html.replace("<head>", '<head><base href="../">').replace('<script src="./vendor/pixi.min.js"></script>', "");
        await loaded;
        assert(/PixiJS failed to load/.test(broken.contentDocument.getElementById("warning").textContent), "Missing dependency error absent");
      } finally {
        broken.remove();
      }
    });
    results.textContent += `\n${passed} browser checks passed.\n`;
  } catch (error) {
    results.textContent += `FAIL ${error.stack || error}\n`;
  } finally {
    runButton.disabled = false;
  }
});
