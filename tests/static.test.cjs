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
  assert.deepEqual(scripts, ["./vendor/pixi.min.js", "./gds_parser.js", "./liquid_glass.js", "./gds_viewer.js"]);
  assert.doesNotMatch(html, /type="module"|https?:\/\/|__INITIAL/);
  for (const script of scripts) assert.ok(fs.statSync(path.join(root, script)).isFile());
  assert.doesNotMatch(fs.readFileSync(path.join(root, "open_gds_viewer.sh"), "utf8"), /\r/);
});

test("liquid-glass adaptations retain their MIT notices and source provenance", () => {
  for (const [filename, author] of [
    ["LIQUIDGL-LICENSE.txt", /Copyright \(c\) NaughtyDuk/],
    ["LIQUID-GLASS-EFFECT-LICENSE.txt", /Copyright \(c\) 2025 Kevin Ramirez/],
  ]) {
    const license = fs.readFileSync(path.join(root, "vendor", filename), "utf8");
    assert.match(license, author);
    assert.match(license, /Permission is hereby granted/);
    assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
    assert.ok(fs.readFileSync(path.join(root, "README.md"), "utf8").includes(filename));
  }
  const provenance = fs.readFileSync(path.join(root, "vendor/VENDORED.md"), "utf8");
  assert.match(provenance, /b79845de77299c3fad3f05c470997719d31fbc9c/);
  assert.match(provenance, /493b710b41d817cbdc3b60808e87ce747d7916f6/);
});

test("application has no backend calls or Python package", () => {
  for (const name of ["gds_parser.js", "gds_viewer.js", "liquid_glass.js"]) {
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
      for (const asset of ["gds_parser.js", "gds_viewer.js", "liquid_glass.js", "vendor/pixi.min.js"]) {
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
