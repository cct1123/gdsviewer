# Screenshots for the XOR walkthrough

These numbered captures document the earlier graphite palette. For the current
cream, sage, and terracotta interface, see the [design review](../design-review.md)
and [current capture manifest](current-capture-manifest.json).

The 11 full screenshots and 16 close-ups illustrate the [picture guide](../user-guide.md)
and [README](../../README.md). All loaded views use `examples/yzuda/xor.gds2`, the
public XOR example from [YZUDA](https://www.yzuda.org/download/_GDSII_examples.html).
The first screenshot shows the empty viewer before loading it.

## How they were captured

- Captured on 8 September 2026 in the Codex in-app browser on Windows, at its
  1280 × 720 viewport and device scale factor 1.
- Application source: the uncommitted working tree based on `d6520bf` on `main`.
  [capture-manifest.json](capture-manifest.json) records SHA256 hashes of the
  application sources, the example input, and every image. The four files listed
  in `normalizedTextSources` are hashed after converting CRLF to LF, matching
  Git's text normalization. Vendored PixiJS, the example input, and images are
  hashed as stored, without conversion.
- The captured UI uses stone-gray glass, graphite controls, and muted sage accents.
  Decorative WebGL was active. Major and minor grid lines are enabled in every
  loaded view, with five subdivisions per major interval.
- Used the loopback static helper in `tests/serve.cjs`, under `/viewer/`.
- The original `xor.gds2` file was supplied through the normal browser file input.
  Native OS picker dialogs were not exercised. No private layout was used.
- Every view was produced with the viewer's own controls. The sidebar is scrolled
  in the layer and measurement pictures to reveal the relevant controls.
- Full screenshots and close-ups are lossless PNGs. The README hero has since
  been replaced by a capture of the current palette; `02-layout-overview.png`
  remains the original walkthrough overview.
- The captures preserve the rendered UI; no labels, dimensions, or geometry were
  painted into the pictures. Text elements from the GDSII file are not rendered.
- The capture session reported no browser script errors. These screenshots validate
  the illustrated HTTP workflow, not direct-file opening or other browser engines
  and OS launchers. See the [validation record](../yzuda-demo-validation.md).

## Close-ups

Each close-up is an exact rectangular crop of its decoded PNG source. The crop process
uses Sharp, without resampling, sharpening, or retouching. All 16 outputs were
compared byte-for-byte with the corresponding decoded source regions.

[crop-regions.json](crop-regions.json) records the source, output filename, rectangle
`[x, y, width, height]`, suggested display width, and description. Coordinates are
in source-image pixels from the top-left corner. The guides may display a crop
larger to make a small control easier to read; the stored crop is unchanged.
Full-screenshot links let readers locate each detail in the window.

## Captured states

| Screenshot | Action | Observed result |
| --- | --- | --- |
| `01-open-viewer.png` | Open the viewer | Empty view, file prompt, collapsed root/depth controls, Grid selected. |
| `02-layout-overview.png` | Load xor.gds2 and fit | 4 / 4 cells, 15 / 15 layers, 520 polygons; 50.0 um scale bar. |
| `03-zoom-and-pan.png` | Wheel zoom, drag, then press z three times | Enlarged and shifted geometry; 20.0 um scale bar. |
| `04-layer-visibility.png` | Hide L47/D0 | Dashed hidden-layer button; 14 / 15 layers and 512 polygons. |
| `05-cell-visibility.png` | Show all, then hide nand2 | nand2 and via hidden; 2 / 4 cells and 166 polygons. |
| `06-root-cell.png` | Expand hierarchy options; apply nand2 with blank depth | 2 / 2 cells, 15 / 15 layers, 107 polygons. |
| `07-hierarchy-depth.png` | Apply abc2 with depth 0 | 1 / 1 cells, 4 / 4 layers, 28 polygons. |
| `08-grid-and-scale.png` | Restore all roots/levels; keep Grid enabled | Full XOR layout with both grid levels and 50.0 um scale bar. |
| `09-measure-distance.png` | Click a point at the middle-right; Ctrl-click to its left | Saved 44.0 um measurement, dx 44.0 um, dy 0.0 nm. |
| `10-pointer-coordinates.png` | Start another ruler above the saved one | Crosshair and zero-length preview; x 104 um, y 59.8 um. Earlier ruler remains. |
| `11-delete-measurement.png` | Cancel the preview, delete the saved ruler | No ruler drawn; Measurements says “No measurements yet.” |

The measurement was made by clicks in the rendered layout, not from a reference
circuit dimension. Values are reported as the viewer displayed them. Different
click positions may produce different readings. These external examples are
illustrations, not independent geometry test fixtures.
The XOR file's user unit is 1 µm, matching the viewer's current distance-label
assumption. These captures do not validate physical measurements for other user units.

## Updating the pictures

Follow the steps in the guide with the original XOR file. Capture each state after
loading or applying options has finished. Keep controls, filenames, counts, and
captions in agreement. Preserve the [source attribution](../../examples/yzuda/README.md).

When replacing a full screenshot, review its crop rectangles and regenerate the
associated close-ups. Check that each label is complete and that no unrelated
control intrudes into the crop. Refresh the README hero from the overview as well.
Update the appropriate manifest after the final captures and verify the saved files visually,
not only the live browser. Remove replaced image files after updating their links.
