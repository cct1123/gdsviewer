# User-guide screenshots

The JPEG files are unedited captures of the actual GDS Viewer WebUI. The `crops/`
folder contains 16 PNG close-ups taken from those originals. They illustrate the
[user guide](../user-guide.md) and the repository [README](../../README.md).

## Cropped close-ups

Each close-up keeps an exact rectangular region of its source screenshot, without
changing the decoded pixels. Crops were created with Windows `System.Drawing` and
saved as PNG, with no resampling, sharpening, retouching, or generated UI elements.
The original JPEGs remain available through the full-screenshot links in the guides.

[crop-regions.json](crop-regions.json) records each source filename, crop filename,
and rectangle as `[x, y, width, height]` in source-image pixels, measured from the
top-left corner. Its `width` field outside the rectangle is the suggested display
width in the guides. Small controls are displayed larger to make labels easier to
read; this does not resize the stored image. Crop filenames describe the function
being highlighted, including controls and their resulting status or geometry.

## Capture conditions

- Captured on 6 September 2026 using the Codex in-app browser on Windows.
- Application source: commit `b980197`; documentation worktree: `codex/readme-beginners`.
- Started with `node tests/serve.cjs` and opened the printed **Static test viewer**
  address under `/viewer/`. The server is bound to loopback.
- Used a 1280 × 960 desktop viewport so the canvas tools could be exercised.
  The sidebar is scrolled in some pictures to expose lower controls.
- Loaded only `tests/fixtures/hierarchy.gds`, the bundled synthetic example, through
  the native file-picker flow. No private design files were used.
- Captures come from browser screenshots, without image generation, retouching,
  or fabricated interface elements. Captions describe the observed states.
- Direct-file opening was not tested. Other browser engines and macOS/Linux launchers
  remain unverified. These screenshots do not establish complete GDSII compatibility.

## Screens and observed results

| File | Action or state | Visible result |
| --- | --- | --- |
| `01-open-viewer.jpg` | Empty startup | File-loading prompt; view options disabled. |
| `02-layout-overview.jpg` | Load hierarchy.gds and fit | 3 cells, 3 layers, 9 visible polygons. |
| `03-zoom-and-pan.jpg` | Wheel zoom and canvas drag | Enlarged and shifted layout; geometry extends outside the window. |
| `04-layer-visibility.jpg` | Hide L7/D3 | 2 of 3 layers and 5 polygons visible. |
| `05-cell-visibility.jpg` | Show all, then hide CHILD | CHILD and LEAF hidden; 1 of 3 cells and 1 polygon visible. |
| `06-root-cell.jpg` | Apply LEAF with blank depth, zoom out three steps | LEAF alone; 2 layers and 2 polygons. |
| `07-hierarchy-depth.jpg` | Apply TOP with depth 0 | TOP's own rectangle; 1 cell, 1 layer, 1 polygon. |
| `08-grid-and-scale.jpg` | Restore all roots/levels and enable Grid | Nine polygons over the grid; 10.0 um scale bar. |
| `09-measure-distance.jpg` | Measure between matching repeated shapes | Saved 20.0 um ruler; dx 20.0 um, dy 0.0 nm. |
| `10-pointer-coordinates.jpg` | Start another ruler at a first point | Crosshair and x/y readout; previous saved ruler remains. |
| `11-delete-measurement.jpg` | Cancel unfinished ruler, delete saved ruler | No ruler drawn; list says “No measurements yet.” |

Also exercised Hide All (zero visible polygons), Show All (nine restored), keyboard
zoom with z/x, and Fit View. The browser reported no warnings or errors in the
captured session. Measurement mode was observed to end automatically after the
second point; the beginner documentation reflects that behavior.

## Updating the pictures

Use the same bundled example and repeat the steps in the user guide. Capture the
actual result after each operation finishes. Keep each screenshot's control values,
visible counts, filename, and caption consistent. Update this record if the browser,
application behavior, sample, or viewport changes.

After replacing an original, review its rectangles in `crop-regions.json` and
regenerate the associated PNG crops. Check that every label and button is fully
visible and that each crop matches its source region exactly. Keep the overview
uncropped so readers can locate the controls, and retain full-screenshot links
beside the close-ups.
