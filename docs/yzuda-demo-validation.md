# Documentation and UI validation — 2026-09-08

This record covers the earlier [picture guide](user-guide.md), its graphite/sage
palette, and default major/minor grid. The [design review](design-review.md) records
the later palette refinement and current README image. All captures use the
unchanged public [YZUDA XOR file](../examples/yzuda/README.md).

## Checks

- Syntax checks passed for `gds_parser.js`, `gds_viewer.js`, `liquid_glass.js`, and
  `tests/browser-smoke.js`.
- Node 24.14.1: all 26 tests passed with
  `node --test --test-isolation=none tests/*.test.cjs`, the documented fallback for
  the sandbox's test-process spawning restriction. This includes fixture hashes,
  independent geometry references, notices, and root/subdirectory asset delivery.
- All 17 browser harness checks passed in the Codex in-app browser against the real
  Pixi renderer with synthetic layouts. They cover loading, hierarchy, visibility,
  navigation, measurements, both grid levels, resize, failed/stale reads, repeated
  reload cleanup, and glass fallback.
- The resize check now waits for the requested viewport and matching canvas width
  instead of assuming that resize completes within 150 ms. The width and clipping
  assertions are unchanged.
- Manually walked through the public XOR file in the Codex in-app browser on
  Windows at `/viewer/`: 4 cells, 15 layer/datatype pairs, and 520 visible polygons.
  Verified the illustrated layer/cell hiding, root/depth changes, zoom/pan, grid,
  ruler creation, pointer preview, cancellation, and deletion.
- The capture session recorded no browser script errors. Decorative WebGL was
  active, and the viewer required no API or example preload.
- Replaced 11 full screenshots, 16 close-ups, and the README hero with current PNG
  captures at 1280 × 720. Each close-up was compared pixel for pixel with its source
  region; captions, local links, and image references were checked.

The [capture record](images/README.md) lists each state. Its
[manifest](images/capture-manifest.json) identifies the source and image bytes.
The ruler example reads **44.0 µm**, with zero vertical displacement; the pointer
example reads **x 104 µm | y 59.8 µm**. These are observed UI readings, not reference
circuit dimensions.

## Limits and earlier checks

The XOR file uses a 1 µm library user unit. The viewer still assumes that unit when
formatting physical distances, so other user units can produce misleading labels.
Text elements are not drawn, and these external layouts are illustrations rather
than independent geometry or performance benchmarks.

Direct-file loading was checked in headless Edge on Windows on 6 September 2026;
it was not revalidated for this capture because this session's browser automation
blocks direct-file navigation. Native OS picker dialogs, macOS/Linux launchers,
and other browser engines were not checked in this update. Browser automation
supplied the public XOR file through the normal file input.

The documentation layouts remain optional files. They are not application runtime
dependencies and are never loaded automatically. Parsing and hierarchy expansion
retain the resource limits described in the README.
