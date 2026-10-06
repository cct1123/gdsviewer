// Deterministic synthetic layouts; expected counts follow the construction, not the parser.
(function (root) {
  function makeLayout({ polygons = 1, columns = 1, rows = 1, levels = 0 } = {}) {
    const bytes = [];
    const i16 = (n) => [(n >> 8) & 255, n & 255];
    const i32 = (n) => [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    const string = (s) => [...s].map((c) => c.charCodeAt(0)).concat(s.length % 2 ? [0] : []);
    const record = (type, data = [], format = 0) => bytes.push(...i16(data.length + 4), type, format, ...data);
    const xy = (points) => record(0x10, points.flatMap(([x, y]) => [...i32(x), ...i32(y)]), 3);
    const start = (name) => { record(5, Array(24).fill(0), 2); record(6, string(name), 6); };
    const ref = (name, x = 0) => { record(10); record(18, string(name), 6); xy([[x, 0]]); record(17); };
    record(0, i16(600), 2);
    record(1, Array(24).fill(0), 2);
    record(2, string("SYNTHETIC"), 6);
    // GDS real8: 1 user unit per DBU, 1e-6 metres per DBU.
    record(3, [65, 16, 0, 0, 0, 0, 0, 0, 60, 16, 198, 247, 160, 181, 237, 141], 5);
    start("TILE");
    for (let n = 0; n < polygons; n += 1) {
      const x = n % 200 * 3;
      const y = Math.floor(n / 200) * 3;
      record(8); record(13, i16(n % 4 + 1), 2); record(14, i16(0), 2);
      xy([[x, y], [x + 2, y], [x + 2, y + 2], [x, y + 2], [x, y]]); record(17);
    }
    record(7);
    if (columns * rows > 1) {
      start("ARRAY"); record(11); record(18, string("TILE"), 6);
      record(19, [...i16(columns), ...i16(rows)], 2);
      xy([[0, 0], [columns * polygons * 3, 0], [0, rows * 3]]); record(17); record(7);
    }
    for (let level = 0; level < levels; level += 1) {
      for (const side of ["A", "B"]) {
        start(`${side}${level}`);
        if (level === 0) ref("TILE");
        else { ref(`A${level - 1}`); ref(`B${level - 1}`, 3 * 2 ** (level - 1)); }
        record(7);
      }
    }
    record(4);
    return new Uint8Array(bytes);
  }
  const cases = [
    { name: "small-flat", polygons: 12 },
    { name: "medium-flat", polygons: 20000 },
    { name: "large-flat", polygons: 100000 },
    { name: "tiny-array", polygons: 1, columns: 128, rows: 128 },
    { name: "hierarchical", polygons: 8, columns: 64, rows: 64 },
    { name: "shared-dag", polygons: 1, levels: 11 },
  ];
  if (typeof module === "object") module.exports = { makeLayout, cases };
  else root.BenchmarkFixtures = { makeLayout, cases };
})(globalThis);
