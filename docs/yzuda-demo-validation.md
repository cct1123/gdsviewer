# Documentation layout validation — 2026-09-06

- Syntax checks passed for `gds_parser.js`, `gds_viewer.js`, and `tests/browser-smoke.js`.
- Node 24.14.1: `node --test --test-isolation=none tests/*.test.cjs` passed all 25 tests.
  This invocation avoids the sandbox's test-process spawning restriction.
- Headless Microsoft Edge on Windows: all 14 browser harness checks passed,
  including `.gds2` input/drop events, hierarchy options, visibility, navigation,
  measurement, grid, scale, pointer readout, resize, stale loads, errors, and cleanup.
- Verified that no example selector/button exists and startup requests no example
  assets at `/`, `/viewer/`, and direct `file://` opening.
- Loaded `xor.gds2` through the normal file input at all three locations: 4 visible
  cells, 15 layer/datatype pairs, and 520 visible polygons.
- `docs/viewer-xor.png` is a visually inspected 1440 × 1000 screenshot from `/viewer/`
  with all layers visible and no example panel. The README and tutorial share it.
- Native OS picker dialogs were not exercised; browser automation supplied files
  through the normal file input. No macOS/Linux launcher checks were performed.

The documentation files are not application dependencies. Removing the demo script
also removes its startup base64 payload and decoding path. File parsing retains
existing resource limitations; the external examples are not geometry correctness
oracles. The `.gds2` extension and ENDLIB null-padding support remain available for
user-selected files.
