const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseGds, buildGdsViewModel, pathToPolygon, sceneInstances } = require("../gds_parser.js");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name));
const manifest = JSON.parse(fixture("manifest.json"));

test("ENDLIB accepts null padding but rejects trailing data and malformed end records", () => {
  const original = fixture("hierarchy.gds");
  const padded = Buffer.concat([original, Buffer.alloc(2048)]);
  assert.deepEqual(parseGds(padded), parseGds(original));
  padded[padded.length - 1] = 1;
  assert.throws(() => parseGds(padded), /Unexpected data after GDSII ENDLIB/);
  assert.throws(() => parseGds(Buffer.concat([original.subarray(0, -4), Buffer.alloc(8)])), /Invalid GDSII record length/);
  assert.throws(() => parseGds(Uint8Array.of(0, 6, 4, 0, 0, 0)), /Invalid GDSII ENDLIB/);
  assert.throws(() => parseGds(Uint8Array.of(0, 4, 4, 2)), /Invalid GDSII ENDLIB/);
});

// gdstk adds collinear vertices at path extensions. Remove those exact splits,
// then normalize cyclic starting vertex/winding while retaining connectivity.
function canonicalPolygon(coordinates) {
  const points = [];
  for (let index = 0; index < coordinates.length; index += 2) {
    points.push(coordinates.slice(index, index + 2));
  }
  if (JSON.stringify(points[0]) === JSON.stringify(points.at(-1))) points.pop();
  for (let index = points.length - 1; index >= 0 && points.length > 3; index -= 1) {
    const a = points[(index + points.length - 1) % points.length];
    const b = points[index];
    const c = points[(index + 1) % points.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const forward = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    if (cross === 0 && forward >= 0) points.splice(index, 1);
  }
  const rotations = [];
  for (const ordered of [points, [...points].reverse()]) {
    for (let start = 0; start < ordered.length; start += 1) {
      rotations.push(JSON.stringify(ordered.slice(start).concat(ordered.slice(0, start))));
    }
  }
  return rotations.sort()[0];
}

test("polygon comparison retains connectivity and ignores collinear splits", () => {
  const rectangle = canonicalPolygon([0, 0, 2, 0, 2, 1, 0, 1]);
  assert.equal(canonicalPolygon([0, 1, 2, 1, 2, 0, 1, 0, 0, 0]), rectangle);
  assert.notEqual(canonicalPolygon([0, 0, 2, 1, 2, 0, 0, 1]), rectangle);
});

function rounded(value) {
  return JSON.parse(JSON.stringify(value, (_, value) =>
    typeof value === "number" ? Number(value.toFixed(9)) : value,
  ));
}

function canonicalTemplates(templates) {
  return rounded(templates).map((template) => ({
    ...template,
    polygons: template.polygons.map(({ polygon }) => canonicalPolygon(polygon)).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
}

test("reference files retain their recorded provenance hashes", () => {
  for (const [name, hash] of Object.entries(manifest.sha256)) {
    assert.equal(createHash("sha256").update(fixture(name)).digest("hex"), hash, name);
  }
});

for (const scenario of manifest.scenarios) {
  test(`scene against independent Python reference: ${scenario.name}`, () => {
    const actual = buildGdsViewModel(parseGds(fixture(scenario.file)), scenario.options);
    const expected = JSON.parse(fixture(scenario.expected));
    for (const key of ["title", "cellName", "bounds", "cellTree", "cells", "layers"]) {
      assert.deepEqual(rounded(actual[key]), rounded(expected[key]), key);
    }
    assert.deepEqual(canonicalTemplates(actual.templates), canonicalTemplates(expected.templates));
    const describe = ({ cellName, layerKey, templateId, transform }, offset) =>
      rounded({ cellName, layerKey, templateId, transform, offset });
    assert.deepEqual([...sceneInstances(actual)].map(({ group, offset }) => describe(group, offset)),
      expected.groups.map((group) => describe(group, group.offset)));
    for (const layer of actual.layers) {
      assert.deepEqual([...sceneInstances(actual, layer.key)].map(({ group, offset }) => describe(group, offset)),
        expected.groups.filter((group) => group.layerKey === layer.key).map((group) => describe(group, group.offset)));
    }
    assert.equal(actual.groups.reduce((sum, group) => sum + group.count, 0), expected.groups.reduce((sum, group) => sum + group.count, 0));
  });
}

const cell = (name, references = [], polygons = []) => ({ name, references, polygons, paths: [] });
const reference = (cellName, options = {}) => ({ cellName, origin: [0, 0], columns: 1, rows: 1,
  columnVector: [0, 0], rowVector: [0, 0], angle: 0, magnification: 1, xReflection: false, ...options });
const square = { layer: 1, datatype: 0, points: [[0, 0], [1, 0], [1, 1], [0, 1]] };

test("nested compact arrays retain transformed lattice offsets, bounds, and painter order", () => {
  const library = { cells: [
    cell("TOP", [reference("MID", { columns: 2, columnVector: [-10, 0], angle: 90, magnification: 2, xReflection: true })]),
    cell("MID", [reference("LEAF", { rows: 2, rowVector: [0, 3] })], [square]),
    cell("LEAF", [], [square]),
  ] };
  const model = buildGdsViewModel(library);
  assert.equal(model.groups.length, 2);
  assert.deepEqual(model.groups.map((g) => g.count), [2, 4]);
  assert.deepEqual(model.bounds, { xmin: -10, ymin: 0, xmax: 8, ymax: 2 });
  const instances = [...sceneInstances(model, "L1/D0")].map(({ group, offset }) => [group.cellName, offset.map((n) => Math.round(n) || 0)]);
  assert.deepEqual(instances, [["MID", [0, 0]], ["LEAF", [0, 0]], ["LEAF", [6, 0]],
    ["MID", [-10, 0]], ["LEAF", [-10, 0]], ["LEAF", [-4, 0]]]);
});

test("tiny bytes can describe a billion instances without expanding the compact model", () => {
  const { makeLayout } = require("./performance/fixtures.js");
  const bytes = makeLayout({ columns: 30000, rows: 30000 });
  assert.equal(bytes.length, 270);
  const model = buildGdsViewModel(parseGds(bytes));
  assert.equal(model.groups.length, 1);
  assert.equal(model.groups[0].count, 900000000);
  assert.deepEqual(model.bounds, { xmin: 0, ymin: 0, xmax: 89999, ymax: 89999 });
});

test("shared cells reached at a shallower depth keep their descendants in the controls", () => {
  const library = { cells: [cell("TOP", [reference("DETOUR"), reference("SHARED")]),
    cell("DETOUR", [reference("SHARED")]), cell("SHARED", [reference("LEAF")]), cell("LEAF", [], [square])] };
  const model = buildGdsViewModel(library, { maxDepth: 2 });
  assert.deepEqual(model.cells.find((c) => c.name === "SHARED").children, ["LEAF"]);
  assert.equal(model.groups.length, 1);
});

test("instance traversal skips empty and off-layer array subtrees", () => {
  const library = { cells: [cell("TOP", [reference("EMPTY", { columns: 1000, rows: 1000 }), reference("OTHER")], [square]),
    cell("EMPTY"), cell("OTHER", [], [{ ...square, layer: 2 }])] };
  const model = buildGdsViewModel(library);
  assert.deepEqual([...sceneInstances(model, "L1/D0")].map(({ group }) => group.cellName), ["TOP"]);
  assert.deepEqual([...sceneInstances(model, "L2/D0")].map(({ group }) => group.cellName), ["OTHER"]);
  assert.deepEqual([...sceneInstances(model)].map(({ group }) => group.cellName), ["TOP", "OTHER"]);
});

test("cyclic references fail explicitly unless a finite depth terminates the view", () => {
  const library = { cells: [cell("LOOP", [reference("LOOP")], [square])] };
  assert.throws(() => buildGdsViewModel(library), /Cyclic GDSII reference/);
  const model = buildGdsViewModel(library, { maxDepth: 2 });
  assert.equal(model.groups.reduce((n, group) => n + group.count, 0), 3);
});

test("required content and supported record payloads are validated", () => {
  const valid = fixture("hierarchy.gds");
  assert.throws(() => parseGds(valid.subarray(6)), /HEADER/);
  assert.throws(() => parseGds(valid.subarray(0, -4)), /ENDLIB/);
  for (const type of [0x10, 0x13, 0x03]) {
    const invalid = Buffer.from(valid);
    for (let offset = 0; offset < invalid.length; offset += invalid.readUInt16BE(offset)) {
      if (invalid[offset + 2] === type) {
        if (type === 0x10) invalid[offset + 3] = 2;
        if (type === 0x13) invalid.writeInt16BE(0, offset + 4);
        if (type === 0x03) invalid.fill(0, offset + 4, offset + 20);
        break;
      }
    }
    assert.throws(() => parseGds(invalid), /Invalid GDSII/);
  }
});

test("library records retain units, paths, references, and repetitions", () => {
  const library = parseGds(fixture("hierarchy.gds"));
  assert.equal(library.name, "PARITY");
  assert.ok(Math.abs(library.unit - 1e-6) < 1e-15);
  assert.ok(Math.abs(library.precision - 1e-9) < 1e-18);
  const cells = new Map(library.cells.map((cell) => [cell.name, cell]));
  assert.deepEqual([...cells.keys()].sort(), ["$$$CONTEXT_INFO$$$", "CHILD", "LEAF", "TOP"]);
  assert.equal(cells.get("LEAF").paths[0].layer, 4);
  assert.equal(cells.get("CHILD").references[0].cellName, "LEAF");
  assert.equal(cells.get("TOP").references[0].columns, 2);
  assert.equal(cells.get("TOP").references[0].rows, 2);
});

test("input views honor byte offsets and lengths", () => {
  const source = fixture("hierarchy.gds");
  const padded = new Uint8Array(source.length + 12);
  padded.set(source, 5);
  assert.deepEqual(parseGds(new DataView(padded.buffer, 5, source.length)), parseGds(source));
  assert.deepEqual(parseGds(source.buffer.slice(source.byteOffset, source.byteOffset + source.length)), parseGds(source));
  assert.throws(() => parseGds("not bytes"), /ArrayBuffer or byte array/);
});

test("malformed framing is rejected with byte offsets", () => {
  assert.throws(() => parseGds(Uint8Array.of(0, 6, 0, 2, 0)), /record at byte 0 extends beyond/);
  assert.throws(() => parseGds(Uint8Array.of(0, 2, 0, 0)), /Invalid GDSII record length 2 at byte 0/);
  assert.throws(() => parseGds(Uint8Array.of(0)), /Incomplete GDSII record header at byte 0/);
  const bytes = fixture("hierarchy.gds");
  assert.throws(() => parseGds(bytes.subarray(0, bytes.length - 8)), /before.*closed/);
});

test("unknown cells and empty libraries produce actionable errors", () => {
  assert.throws(() => buildGdsViewModel(parseGds(fixture("roots.gds")), { cellName: "MISSING" }), /MISSING.*not found/);
  assert.throws(() => buildGdsViewModel(parseGds(fixture("empty-library.gds"))), /No cells/);
  assert.throws(() => parseGds(new Uint8Array()), /Invalid GDSII content/);
});

test("unsupported rounded paths fail explicitly", () => {
  assert.throws(() => buildGdsViewModel(parseGds(fixture("round-path.gds"))), /Round-ended.*not supported/);
});

test("degenerate paths produce no polygon", () => {
  assert.equal(pathToPolygon({ points: [[0, 0], [0, 0]], width: 1, pathType: 0 }), null);
  assert.equal(pathToPolygon({ points: [[0, 0], [5, 0]], width: 0, pathType: 0 }), null);
});
