# YZUDA demo validation — 2026-09-06

- Syntax checks passed for `gds_parser.js`, `gds_viewer.js`, and `tests/browser-smoke.js`.
- Node 24.14.1: `node --test --test-isolation=none tests/*.test.cjs` passed.
  The default test runner was blocked by sandbox process spawning (`spawn EPERM`).
- Headless Microsoft Edge on Windows: all 15 browser harness checks passed, including
  all four demo examples, `.gds2` picker-input/drop events, hierarchy options,
  visibility, navigation, measurement, grid, scale, pointer readout, resize, stale
  loads, errors, and graphics cleanup.
- XOR demo rendered at both `/` and `/viewer/` on the loopback static helper and
  directly from `file://`, with 4 visible cells, 15 layer/datatype pairs, and 520
  visible polygons. The root/subdirectory viewer pages enforce `connect-src 'none'`.
- `docs/viewer-xor.png` is an actual 1440 × 1000 browser screenshot from `/viewer/`,
  with the XOR demo loaded and every layer visible. It was visually inspected.
- Native OS file-picker dialogs were not exercised; file selection was tested
  through DOM file input events. No macOS/Linux launcher checks were performed.

Null padding acceptance scans trailing bytes once without copying them. The offline
demo script retains base64 copies of the four small source files; loading one decodes
that file and enters the existing serialized file-loading path. This adds no general
resource limits and is not a geometry correctness oracle for the external examples.
