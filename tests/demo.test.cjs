const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createHash } = require("node:crypto");
const { parseGds, buildGdsViewModel } = require("../gds_parser.js");
const directory = path.join(__dirname, "../examples/yzuda");

test("documentation layouts retain attributed source bytes and each layout builds", () => {
  const provenance = fs.readFileSync(path.join(directory, "README.md"), "utf8");
  for (const name of ["1Kpolyg.gds", "inv.gds2", "nand2.gds2", "xor.gds2"]) {
    const source = fs.readFileSync(path.join(directory, name));
    const hash = createHash("sha256").update(source).digest("hex");
    assert.ok(provenance.includes(hash), `Missing provenance hash for ${name}`);
    const model = buildGdsViewModel(parseGds(source));
    assert.ok(model.groups.length > 0, name);
    assert.ok(Object.values(model.bounds).every(Number.isFinite), name);
  }
});
