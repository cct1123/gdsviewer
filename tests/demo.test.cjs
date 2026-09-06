const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { createHash } = require("node:crypto");
const { parseGds, buildGdsViewModel } = require("../gds_parser.js");
const directory = path.join(__dirname, "../examples/yzuda");

test("offline demo payload preserves all attributed source bytes and each layout builds", () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(directory, "demo-data.js"), "utf8"), context);
  const provenance = fs.readFileSync(path.join(directory, "README.md"), "utf8");
  assert.deepEqual(Object.keys(context.GdsDemoData).sort(), ["1Kpolyg.gds", "inv.gds2", "nand2.gds2", "xor.gds2"]);
  for (const [name, encoded] of Object.entries(context.GdsDemoData)) {
    const source = fs.readFileSync(path.join(directory, name));
    assert.deepEqual(Buffer.from(encoded, "base64"), source, name);
    const hash = createHash("sha256").update(source).digest("hex");
    assert.ok(provenance.includes(hash), `Missing provenance hash for ${name}`);
    const model = buildGdsViewModel(parseGds(source));
    assert.ok(model.groups.length > 0, name);
    assert.ok(Object.values(model.bounds).every(Number.isFinite), name);
  }
});
