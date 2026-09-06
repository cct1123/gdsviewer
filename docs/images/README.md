# Screenshots for the XOR walkthrough

The 11 full screenshots and 16 close-ups illustrate the [picture guide](../user-guide.md)
and [README](../../README.md). All loaded views use `examples/yzuda/xor.gds2`, the
public XOR example from [YZUDA](https://www.yzuda.org/download/_GDSII_examples.html).
The first screenshot shows the empty viewer before loading it.

## How they were captured

- Captured on 6 September 2026 in headless Microsoft Edge on Windows, at a
  1440 × 1000 viewport and device scale factor 1.
- Application source: `d140156` on `main`, with constant 1-pixel polygon borders.
- Used the loopback static helper in `tests/serve.cjs`, under `/viewer/`.
- The original `xor.gds2` file was supplied through the normal browser file input.
  Native OS picker dialogs were not exercised. No private layout was used.
- Every view was produced with the viewer's own controls. The sidebar is scrolled
  in the layer and measurement pictures to reveal the relevant controls.
- Full screenshots are JPEGs at quality 96. The README hero, `../viewer-xor.png`,
  is a PNG of the same fitted overview state.
- The captures preserve the rendered UI; no labels, dimensions, or geometry were
  painted into the pictures. Text elements from the GDSII file are not rendered.
- The capture session reported no browser script errors. Previous checks also
  exercised direct `file://` loading and root/subdirectory hosting in Edge on
  Windows. These screenshots do not validate other browsers or OS launchers.

## Close-ups

Each PNG is an exact rectangular crop of its decoded JPEG source. The crop process
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
| `01-open-viewer.jpg` | Open the viewer | Empty view, file prompt, disabled root/depth controls. |
| `02-layout-overview.jpg` | Load xor.gds2 and fit | 4 / 4 cells, 15 / 15 layers, 520 polygons; 50.0 um scale bar. |
| `03-zoom-and-pan.jpg` | Zoom in six wheel steps, then drag | Enlarged and shifted geometry; 20.0 um scale bar. |
| `04-layer-visibility.jpg` | Hide L47/D0 | 14 / 15 layers and 512 polygons. |
| `05-cell-visibility.jpg` | Show all, then hide nand2 | nand2 and via hidden; 2 / 4 cells and 166 polygons. |
| `06-root-cell.jpg` | Apply nand2 with blank depth | 2 / 2 cells, 15 / 15 layers, 107 polygons. |
| `07-hierarchy-depth.jpg` | Apply abc2 with depth 0 | 1 / 1 cells, 4 / 4 layers, 28 polygons. |
| `08-grid-and-scale.jpg` | Restore all roots/levels; enable Grid | Full XOR layout with grid and 50.0 um scale bar. |
| `09-measure-distance.jpg` | Turn Grid off; place a horizontal ruler | Saved 30.1 um measurement, dx 30.1 um, dy 0.0 nm. |
| `10-pointer-coordinates.jpg` | Start another ruler near the middle | Crosshair and zero-length preview; x 62.0 um, y 55.3 um. Earlier ruler remains. |
| `11-delete-measurement.jpg` | Cancel the preview, delete the saved ruler | No ruler drawn; Measurements says “No measurements yet.” |

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
