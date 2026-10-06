# Loading performance

The optimization keeps the static, browser-local architecture and pinned PixiJS.
It adds no runtime assets, dependencies, workers, installation, or build step.

## What the profile changed

The baseline is commit `2654a8efb91f6fc57b505c9852e943186de4e05c`.
Initial browser profiles showed that parsing was a small fraction of load time:
fixed frame/idle waits delayed tiny files, closed shared hierarchy branches created
thousands of unnecessary DOM nodes, and repeated instances made reload cleanup slow.

- Decode XY coordinates directly, avoiding a temporary integer array, and flatten
  model coordinates with a single output array rather than per-point arrays.
- Keep AREF repetition vectors and counts in the viewer's compact model. Compute
  array bounds from lattice extrema; generate instance offsets only when consumed.
  The existing expanded model API remains the default for reference compatibility.
- Preserve nested instance order within each layer, including overlapping cells.
  Use the same traversal for measurement snapping. Cell templates remain shared.
- Construct closed tree branches on demand, preserving current visibility when
  they open. Track the shallowest visit to shared cells for depth-limited controls.
- Share fill/stroke styles per template. Every polygon still has its own fill and
  outline, preserving overlap compositing.
- Use Pixi's rectangle primitive for exact axis-aligned four-corner rectangles.
  All other polygons retain their original drawing path. Browser pixel comparisons
  cover reflection, rotation, both windings, and overlapping translucent rectangles.
- Detach old instances, destroy their shared contexts once, then destroy instances.
  This avoids repeated removal from large shared-context listener arrays.
- Yield after elapsed work instead of waiting after every layer and tree batch.
  Large layers are explicitly rendered separately so deferred tessellation does
  not accumulate in one frame. Tiny layouts have no mandatory frame delay.
- Accept all three extensions case-insensitively through the common picker/drop
  loader. Validate required content and supported record payloads. Invalid newer
  selections also invalidate older pending reads.

## Reproduce in a browser

Create or use an unchanged checkout of the baseline commit. From the changed
checkout, run:

```text
node tests/performance/serve.cjs <absolute-path-to-baseline-checkout>
```

Open the printed loopback URL. Choose **Baseline**, run the benchmarks, then choose
**Working tree** and run again. Keep the tab foreground, window dimensions fixed,
and other activity low. No generated GDS files need to be saved. The fixtures are
deterministic synthetic layouts from `tests/performance/fixtures.js`, independent
of the parser. Use **Download JSON**, or copy the displayed report. Repeat runs and
reverse their order when comparing machines or making further changes.

Each case creates a fresh viewer iframe, loads once (repeat 0), then reloads twice
(repeats 1 and 2). `loadMs` runs from picker-event dispatch through enabled controls,
cleared loading status, and two animation frames. It includes file reading, parsing,
model construction, cleanup, controls, drawing, and initial rendering. Parsing and
model times are synchronous stage samples. `maxFrameGapMs` measures the longest
animation-frame interval during the load. Long Task entries are also recorded, but
do not capture all rendering/GPU stalls; use frame gaps alongside them.

For memory, select **Measure retained memory** and run separately. The development
server enables cross-origin isolation for the browser's experimental
[`measureUserAgentSpecificMemory`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory)
API. It can take minutes and is not available in every browser. It estimates the
current page and its iframe after three loads; it is not peak memory or total
browser/GPU process memory. Compare the same browser version. The headers and
memory API are only used by this optional benchmark helper.

## Recorded timing run

Windows, Codex in-app Chromium 154.0.0.0, 1280 × 720 outer viewport,
1100 × 800 viewer iframe, vendored PixiJS, October 6, 2026. Timings below are from
separate ordinary runs with memory measurement disabled. Baseline ran first.
First load includes renderer initialization; reload is the mean of repeats 1 and 2.
This is a small local sample, not a cross-browser performance guarantee.

| Synthetic layout | File bytes | Visible polygons | First load, before → after (ms) | Reload, before → after (ms) |
| --- | ---: | ---: | ---: | ---: |
| Small flat | 880 | 12 | 148 → 93 | 104 → 33 |
| Medium flat | 1,280,112 | 20,000 | 430 → 306 | 213 → 99 |
| Large flat | 6,400,112 | 100,000 | 1,572 → 1,282 | 1,094 → 641 |
| Tiny array, 128 × 128 | 270 | 16,384 | 357 → 221 | 1,841 → 100 |
| Hierarchical array, 64 × 64, eight shapes per cell | 718 | 32,768 | 1,078 → 550 | 626 → 111 |
| Shared hierarchy, 11 levels | 2,112 | 2,048 | 2,153 → 113 | 2,127 → 59 |

The large flat reload's longest frame gaps fell from 436–441 ms to 94–104 ms;
the tiny array's fell from 1,760–1,797 ms to 35–40 ms. First-load frame gaps were
not uniformly lower: the small flat case increased from 44 to 58 ms, and the
four-layer hierarchical array from 108 to 140 ms, while both finished sooner.
Earlier exploratory runs were faster in absolute terms, so these are a final
paired local run rather than a claim that timings are stable across sessions.

The per-load samples, rounded to 0.1 ms, are in
[`before.csv`](../tests/performance/before.csv) and
[`after.csv`](../tests/performance/after.csv). The browser reports matching visible
polygon counts throughout. The generator and harness, not the CSV, are the inputs
for new measurements.

## Allocation evidence

The harness counts actual unique style objects held by drawing instructions, model
groups, live tree buttons, and constructed Graphics instances. These counts are
deterministic and do not depend on when garbage collection runs.

| Case / retained structure | Before | After |
| --- | ---: | ---: |
| 100,000 polygons: fill/stroke style objects | 200,000 | 8 |
| 20,000 polygons: fill/stroke style objects | 40,000 | 8 |
| 12 polygons: fill/stroke style objects | 24 | 8 |
| Tiny array: model groups | 16,384 | 1 |
| Hierarchical array: model groups | 16,384 | 4 |
| Shared hierarchy: initial tree buttons | 6,142 | 14 |

Graphics instance counts are unchanged: 16,384 for both array cases. Standard
`performance.memory` samples are included in the CSV for transparency, but their
heap totals fluctuate with garbage collection and previously used iframe realms.
Do not subtract those samples to claim retained-memory savings.

Separate retained-memory estimates after three loads are recorded in
[`memory.csv`](../tests/performance/memory.csv). One estimate per case/version was
collected with `measureUserAgentSpecificMemory`, using the same browser and helper.
These numbers include the benchmark page and loaded viewer, not GPU process memory.

| Case | Before (MiB) | After (MiB) | Observation |
| --- | ---: | ---: | --- |
| Small flat | 12.19 | 12.35 | Essentially unchanged; +0.17 MiB |
| Medium flat | 69.11 | 65.11 | About 6% lower |
| Large flat | 296.44 | 276.23 | About 7% lower, 20.2 MiB saved |
| Tiny array | 56.30 | 52.27 | About 7% lower |
| Hierarchical array | 77.41 | 78.65 | Essentially unchanged; +1.24 MiB |
| Shared hierarchy | 28.66 | 20.29 | About 29% lower |

The memory reduction is substantial for the shared tree and modest for the flat
and tiny-array cases. There is no demonstrated whole-page memory improvement for
the smallest file or the four-layer hierarchical array. Retained Pixi instances
and rendering buffers dominate those cases. Do not generalize these six estimates
to all layouts or claim an across-the-board memory reduction.

## Validation and limits

The independent reference models remain unchanged. Both expanded and compact
models are checked against all eleven references. Additional regressions cover
nested reflected/rotated arrays, lattice bounds, painter order, shared cells at
different depths, cycles, required content, and malformed supported payloads.
A 270-byte, 900-million-instance case verifies compact **model construction only**;
it is deliberately not rendered and establishes no viewer resource bound.

The browser harness covers loading, all three extensions through both routes,
invalid content, visibility, lazy tree expansion, later-instance snapping,
navigation, grid, measurements, resize, themes, overlapping loads, and repeated
graphics cleanup. Node checks cover root/subdirectory assets and no backend calls.
All documented syntax checks, 46 Node tests, and 23 browser checks passed on the
final code. Node used the README's `--test-isolation=none` fallback because ordinary
test worker creation returned `spawn EPERM` in the sandbox. Fixture hashes and
local documentation links were also verified.
The actual file chooser was also checked under subdirectory hosting, with visual
inspection at 390 px. Direct `file:` navigation was blocked by the browser tool's
URL policy; that browser check remains unperformed. No launcher, extracted release,
Firefox, Safari, macOS, or Linux validation was performed for this change.

Remaining limitations:

- Rendering still creates one Pixi Graphics object per visible cell/layer instance.
  Compact arrays reduce model memory; they do not make enormous arrays safe to draw.
- Non-array reference paths still expand during model construction. Deep/shared
  graphs, very wide open tree branches, and recursive traversal can still be costly.
- Parsing, individual template construction, tessellation, context destruction,
  theme repaint, and visibility updates still have synchronous portions. The 8 ms
  scheduling target is not a maximum task duration. Large single-layer templates
  can still stall; the final 100,000-polygon first load still had a 267 ms gap.
- Snapping scans visible instance geometry and allocates transient points. No
  spatial index, viewport culling, level-of-detail approximation, or GPU instancing
  was introduced. No hard time, memory, file-size, or instance-count budgets exist.
- Existing format/geometry support and coordinate rounding are unchanged. The
  existing distance-label assumption of micrometre user units also remains; see
  the README before using measurements from other library units.

The measured work supports these focused changes. Workers, a new rendering backend,
or an instance/spatial index would need separate profiles and correctness tests.
