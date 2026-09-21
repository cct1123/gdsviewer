# Screenshots for the XOR walkthrough

The [picture guide](../user-guide.md), [README](../../README.md), and
[reproduction guide](../layout-tutorial.md) use paired day/night illustrations:
20 unique full screenshots and 34 control or canvas close-ups cover the same
11 tutorial states in each mode. The grid step reuses the byte-identical overview
image, preserving all 22 captured states without duplicate image files. All loaded
views use the unchanged public
[`xor.gds2` example from YZUDA](../../examples/yzuda/README.md).

## How they were captured

- Captured on 21 September 2026 in the Codex in-app browser on Windows, at
  838 × 912 pixels and device scale factor 1.
- Application source: commit `f0ffb63948049f97212e1ee2dd0da5f97365c86f`.
  [capture-manifest.json](capture-manifest.json) records the source, input, image
  hashes, and observed UI state for each capture. The five application files in
  `normalizedTextSources` are hashed after converting CRLF to LF. Vendored PixiJS,
  the example input, and images are hashed as stored.
- Used the loopback helper in `tests/serve.cjs`, under `/viewer/`. The public XOR
  file was supplied through the normal browser file input. Native OS picker
  dialogs were not exercised. No private layout was used.
- Each state was produced with the viewer's controls and captured in both modes.
  The sidebar is scrolled in the layer and measurement pictures to show the
  relevant controls. Decorative WebGL was active; both grid levels are enabled
  in every loaded screenshot.
- Full screenshots retain the browser's JPEG output. Close-ups are PNG crops
  of those decoded JPEG pixels. No labels, dimensions, or geometry were painted
  into the pictures. Text elements from the GDSII file are not rendered.
- The capture session reported no browser script errors. These pictures document
  the illustrated HTTP workflow. See the [validation record](../yzuda-demo-validation.md)
  for direct-file, platform, and measurement limitations.

## Close-ups

Each close-up is an exact rectangular crop, generated with Sharp without
resampling, sharpening, or retouching. All 34 outputs were compared pixel for
pixel with their decoded source regions. The saved full screenshots and crops
were also reviewed visually.

[crop-regions.json](crop-regions.json) records each source image, output filename,
rectangle, and description. Rectangle coordinates `x`, `y`, `width`, and `height`
are in source-image pixels from the top-left corner. The guides may display a
small control at a larger size for legibility; the stored crop is unchanged.
Clicking an illustration opens its full screenshot for context.

## Captured states

Every filename below exists in both `day/` and `night/`. In the manifest, `step`
identifies the captured tutorial state and `image` names its stored screenshot.

| Screenshot | Action | Observed result |
| --- | --- | --- |
| `01-open-viewer.jpg` | Open the viewer | Empty view, load prompt, Grid selected. The appearance button names the other mode. |
| `02-layout-overview.jpg` | Load xor.gds2 and fit | 4 / 4 cells, 15 / 15 layers, 520 polygons; 50.0 um scale bar. |
| `03-zoom-and-pan.jpg` | Wheel zoom and drag | Enlarged and shifted geometry; 50.0 um scale bar spans more pixels. |
| `04-layer-visibility.jpg` | Hide L47/D0 | Dashed hidden-layer button; 14 / 15 layers and 512 polygons. |
| `05-cell-visibility.jpg` | Show all, then hide nand2 | nand2 and via hidden; 2 / 4 cells and 166 polygons. |
| `06-root-cell.jpg` | Apply nand2 with blank depth | 2 / 2 cells, 15 / 15 layers, 107 polygons. |
| `07-hierarchy-depth.jpg` | Apply abc2 with depth 0 | 1 / 1 cells, 4 / 4 layers, 28 polygons. |
| `02-layout-overview.jpg` (grid step) | Restore all roots/levels; toggle Grid off and on; fit | Full XOR layout with both grid levels and 50.0 um scale bar. |
| `09-measure-distance.jpg` | Click a point at the middle-right; Ctrl-click to its left | Saved 44.0 um measurement, dx 44.0 um, dy 0.0 nm. |
| `10-pointer-coordinates.jpg` | Start another ruler above the saved one | Zero-length preview; x 103 um, y 60.4 um. Earlier ruler remains. |
| `11-delete-measurement.jpg` | Cancel the preview, delete the saved ruler | No ruler drawn; Measurements says “No measurements yet.” |

The measurement was made by clicks in the rendered layout. It is an observed UI
reading, not a reference circuit dimension; different points give different
readings. These external examples are illustrations, not independent geometry
test fixtures. The XOR file's user unit is 1 µm, matching the viewer's current
distance-label assumption. The captures do not validate other user units.

## Updating the pictures

Follow the guide with the original XOR file. Capture each state after loading or
applying options finishes, then switch appearance and capture the same state.
For pointer coordinates, return to the same canvas point after using the switch.
Keep the filenames, counts, and captions in agreement with the actual UI.
Preserve the [source attribution](../../examples/yzuda/README.md).

When replacing a full screenshot, review its crop rectangles and regenerate the
close-ups. Check that labels are complete. Refresh the README and both guides
from the same overview pair. Update the manifest, visually inspect the saved
images, and remove replaced files after updating their links.
