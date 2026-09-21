# Documentation validation — 2026-09-21

This update replaces the older tutorial illustrations with day/night captures of
the interface at commit `f0ffb63`. The README, [picture guide](user-guide.md), and
[reproduction guide](layout-tutorial.md) use the same unchanged public
[YZUDA XOR file](../examples/yzuda/README.md). No application code changed during
this documentation update.

## Documentation checks

- Walked through the public XOR file in the Codex in-app browser on Windows,
  served under `/viewer/` at 838 × 912 pixels. Loaded it through the normal
  browser file input: 4 cells, 15 layer/datatype pairs, and 520 polygons.
- Captured 11 states in each mode, covering the empty viewer, loading, zoom/pan,
  layer and cell visibility, root selection, depth, grid/scale, saved rulers,
  pointer coordinates, cancellation, and deletion. Switching modes retained
  the layout state and saved measurement.
- Verified the pictured results: hiding L47/D0 leaves 512 polygons; hiding nand2
  also hides via and leaves 166; selecting nand2 shows 107; abc2 at depth 0 shows
  28 polygons on 4 layers.
- Reviewed all 22 captured states and 34 close-ups. The full captures are stored
  as 20 unique images after removing two byte-identical copies. Each close-up
  matches its decoded source pixels exactly. Captions, local links, image references,
  paired state metadata, and manifest hashes were checked.
- The capture session reported no browser script errors. Decorative WebGL was
  active. The viewer required no API or automatic example preload.
- The focused documentation-layout Node tests passed, checking the public input
  hashes and supported example geometry. See the check command below.

```text
node --test --test-isolation=none tests/demo.test.cjs
```

The [capture record](images/README.md) lists each state. Its
[manifest](images/capture-manifest.json) identifies the source and image bytes.
The ruler reads **44.0 µm**, with zero vertical displacement; the pointer example
reads **x 103 µm | y 60.4 µm**. These are UI readings, not reference dimensions.

## Follow-up consistency review

The review removed the duplicate day/night grid screenshots and updated tutorial
links, crop sources, and the manifest to reuse the identical overview images.
README and tutorial guidance now also describe the controls above the canvas on
narrow screens. Application code and the captured pixels are unchanged.

All five syntax checks and all 29 Node tests passed using the documented
`--test-isolation=none` fallback. All 18 browser checks passed in a run starting
in night mode, including repeated switches between both modes. The 390-pixel
layout was visually checked. Local documentation links, source and image hashes,
and exact crop pixels were checked again after pruning.

## Implementation checks and limits

Before this documentation update, the same application commit passed all five
documented JavaScript syntax checks, all 29 Node tests, and all 18 browser checks
with the suite starting once in each mode. The Node suite used the documented
`--test-isolation=none` fallback after the sandbox blocked test worker creation.
The [design review](design-review.md#validation) records those implementation
checks from the original implementation; the follow-up run is recorded above.

The XOR file uses a 1 µm library user unit. Other user units can produce misleading
distance labels because the viewer currently assumes micrometres. Text elements
are not drawn. These screenshots are not independent geometry references or
large-layout performance measurements.

Direct-file loading was checked in headless Edge on Windows on 6 September 2026.
It was not revalidated for the current interface: the browser tool's URL policy
blocked that navigation. Native OS picker dialogs, other browser engines, and
macOS/Linux launchers were not checked in this update.

The documentation layouts remain optional and never load automatically.
Parsing and hierarchy expansion retain the resource limits described in the
[README](../README.md#supported-layouts-and-limits).
