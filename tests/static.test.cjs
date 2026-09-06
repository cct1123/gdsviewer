const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createStaticServer } = require("./serve.cjs");
const root = path.join(__dirname, "..");

test("vendored PixiJS retains the upstream bytes and license notice", () => {
  const asset = fs.readFileSync(path.join(root, "vendor/pixi.min.js"));
  assert.equal(asset.length, 818297);
  assert.equal(createHash("sha256").update(asset).digest("hex"), "07cbe045435c2a487c2f28f9a3a9ee43069dbbec0c77585477bb6e63b5e125a8");
  assert.match(fs.readFileSync(path.join(root, "vendor/PIXI-LICENSE.txt"), "utf8"), /Mathew Groves, Chad Engler/);
});

test("entry point uses existing relative classic scripts", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  assert.deepEqual(scripts, ["./vendor/pixi.min.js", "./gds_parser.js", "./gds_viewer.js"]);
  assert.doesNotMatch(html, /type="module"|https?:\/\/|__INITIAL/);
  for (const script of scripts) assert.ok(fs.statSync(path.join(root, script)).isFile());
  assert.doesNotMatch(fs.readFileSync(path.join(root, "open_gds_viewer.sh"), "utf8"), /\r/);
});

test("application has no backend calls or Python package", () => {
  for (const name of ["gds_parser.js", "gds_viewer.js"]) {
    const source = fs.readFileSync(path.join(root, name), "utf8");
    assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|\/api\//);
  }
  for (const name of ["pyproject.toml", "uv.lock", "src/gdsviewer/viewer.py"]) {
    assert.equal(fs.existsSync(path.join(root, name)), false, name);
  }
});

test("static helper serves root and nested assets and exposes no API", async () => {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const prefix of ["/", "/viewer/"]) {
      const page = await fetch(base + prefix);
      assert.equal(page.status, 200);
      assert.match(page.headers.get("Content-Type"), /text\/html/);
      for (const asset of ["gds_parser.js", "gds_viewer.js", "vendor/pixi.min.js"]) {
        const response = await fetch(base + prefix + asset);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("Content-Type"), /javascript/);
        assert.equal(await response.text(), fs.readFileSync(path.join(root, asset), "utf8"));
      }
    }
    for (const route of ["/api/preload", "/api/preloaded-gds", "/api/load-gds", "/api/layer-data", "/README.md"]) {
      assert.equal((await fetch(base + route)).status, 404);
    }
    assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
