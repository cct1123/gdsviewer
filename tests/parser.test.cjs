const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseGds, buildGdsViewModel, pathToPolygon } = require("../gds_parser.js");

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

function canonicalModel(model) {
  const result = JSON.parse(JSON.stringify(model, (_, value) =>
    typeof value === "number" ? Number(value.toFixed(9)) : value,
  ));
  result.templates = result.templates.map((template) => ({
    ...template,
    polygons: template.polygons.map(({ polygon }) => canonicalPolygon(polygon)).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

test("reference files retain their recorded provenance hashes", () => {
  for (const [name, hash] of Object.entries(manifest.sha256)) {
    assert.equal(createHash("sha256").update(fixture(name)).digest("hex"), hash, name);
  }
});

for (const scenario of manifest.scenarios) {
  test(`saved Python reference: ${scenario.name}`, () => {
    const actual = buildGdsViewModel(parseGds(fixture(scenario.file)), scenario.options);
    assert.deepEqual(canonicalModel(actual), canonicalModel(JSON.parse(fixture(scenario.expected))));
  });
}

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
  assert.throws(() => buildGdsViewModel(parseGds(new Uint8Array())), /No cells/);
});

test("unsupported rounded paths fail explicitly", () => {
  assert.throws(() => buildGdsViewModel(parseGds(fixture("round-path.gds"))), /Round-ended.*not supported/);
});

test("degenerate paths produce no polygon", () => {
  assert.equal(pathToPolygon({ points: [[0, 0], [0, 0]], width: 1, pathType: 0 }), null);
  assert.equal(pathToPolygon({ points: [[0, 0], [5, 0]], width: 0, pathType: 0 }), null);
});
