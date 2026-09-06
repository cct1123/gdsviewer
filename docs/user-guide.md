# GDS Viewer: a guide in pictures

This walkthrough uses the small example included with the project. Follow the
steps in order, or jump to the control you want to learn. The close-ups are cropped
from real browser screenshots so you can read each control. Follow the **Full
screenshot** links to see where each detail sits in the window.

[Open the viewer](#1-open-the-viewer) · [Load a file](#2-load-the-example-layout) ·
[Move and zoom](#3-move-zoom-and-fit) · [Hide layers and cells](#4-show-or-hide-layers-and-cells) ·
[Choose a cell](#5-inspect-one-cell) · [Hierarchy depth](#6-limit-the-hierarchy-depth) ·
[Grid and scale](#7-use-the-grid-and-scale-bar) · [Measure](#8-measure-a-distance) ·
[Coordinates](#9-read-coordinates-and-cancel-an-unfinished-ruler) · [Delete a ruler](#10-delete-a-measurement)

## 1. Open the viewer

Extract the project ZIP if necessary, then open `index.html` with a browser.
On Windows, you can also double-click `open_gds_viewer.bat`. Keep the JavaScript
files and `vendor` folder beside `index.html`.

If opening the HTML directly does not work, follow the
[optional local-server instructions](../README.md#if-opening-the-html-directly-does-not-work).
The screenshots here were taken using that method on Windows; direct-file launch
and macOS/Linux launchers remain unverified.

<img src="images/crops/01-load-file.png" alt="Load GDS heading, Load GDS File button, and drag-and-drop hint" width="426">

[Full screenshot: empty viewer](images/01-open-viewer.jpg)

**What to look for:** the **Load GDS File** button is on the left. An empty drawing
area is normal at startup. Root-cell and depth controls become available after a
file loads. No layout is loaded automatically.

## 2. Load the example layout

1. Click **Load GDS File**.
2. In the file picker, open the project's `tests/fixtures` folder.
3. Choose `hierarchy.gds`.
4. Click **Fit View**.

For your own layouts, choose any supported `.gds` file instead. You can also drag
a file onto the drawing area. Loading another file replaces the current view and
clears its measurements. The file is processed locally in your browser.

![The hierarchy example displayed with all three cells and three layers enabled](images/02-layout-overview.jpg)

**What to look for:** the title says `hierarchy.gds`. The bottom-right status ends
with **Visible polygons: 9**. The sidebar shows three cells and three layer buttons.

| Part of the window | What it does |
| --- | --- |
| Load GDS | Opens a layout from your computer. |
| Root cell and Hierarchy depth | Choose which part of the file to build into the view. |
| Fit View, Show All, Hide All, Measure, Grid | Control navigation and viewing tools. |
| Cells and Layers | Show or hide selected parts of the layout. |
| Measurements | Lists rulers you have created, with a Delete button for each. |
| Drawing area | Shows the geometry and any rulers or grid. |
| Bottom-left scale bar | Relates distances on screen to layout units. |
| Bottom-right status | Reports how many cells, layers, and polygons are visible. |

The sidebar can scroll independently of the drawing area. Scroll down inside it
if the layer controls or saved measurements are below the edge of your window.

## 3. Move, zoom, and fit

1. Put the pointer over the drawing area and scroll the wheel to zoom.
2. Click and drag to move the layout around.
3. Click **Fit View** to bring the complete layout back into view.

You can also hold **z** to zoom in and **x** to zoom out at the pointer. Keyboard
shortcuts do not act while you are typing in an input or choosing a root cell.

<img src="images/crops/03-fit-controls.png" alt="Fit View, Show All, and Hide All controls" width="360">

<img src="images/crops/03-zoomed-layout.png" alt="Close-up of the enlarged and panned repeated shapes" width="710">

[Full screenshot: zoomed and panned layout](images/03-zoom-and-pan.jpg)

**What changed:** the shapes are larger and shifted. Some geometry is outside the
window, but it has not been removed. **Fit View** restores the overview; it does
not turn hidden cells or layers back on. Use **Show All** if you also need those.

## 4. Show or hide layers and cells

A **layer** groups geometry by its layer number and datatype. For example,
`L7/D3` means layer 7, datatype 3. A **cell** is a named group of shapes that can
include copies of other cells.

### Hide one layer

1. Click **Show All** to begin with everything visible.
2. Under **Layers**, click **L7/D3**, the blue layer.

<img src="images/crops/04-layer-controls.png" alt="Layer buttons with L7/D3 faded and turned off" width="425">

<img src="images/crops/04-layer-status.png" alt="Status showing two of three layers and five visible polygons" width="515">

[Full screenshot: blue layer hidden](images/04-layer-visibility.jpg)

**What changed:** the button fades, the blue shapes disappear, and the status shows
**Visible layers: 2 / 3** and **Visible polygons: 5**. Click the same button again
to restore that layer.

### Hide a whole cell branch

1. Click **Show All** again.
2. Under **Cells**, click the **CHILD** name button.

<img src="images/crops/05-cell-controls.png" alt="Cell tree with TOP enabled and CHILD and LEAF faded" width="407">

The remaining shape, enlarged here for clarity:

<img src="images/crops/05-cell-result.png" alt="The single remaining TOP rectangle" width="233">

[Full screenshot: CHILD branch hidden](images/05-cell-visibility.jpg)

**What changed:** `CHILD` and its nested `LEAF` geometry are hidden together.
The small `TOP` rectangle remains, and the status shows **Visible polygons: 1**.
This also affects repeated copies of the hidden branch.

Use the small triangle beside a cell to expand or collapse its tree listing;
use the cell's **name button** to change visibility. **Hide All** hides all cells
and layers. **Show All** restores them. Neither action deletes anything from the file.

Click **Show All** before continuing.

## 5. Inspect one cell

The **Root cell** menu chooses the cell whose layout you want to inspect. This is
different from temporarily hiding a branch in the Cells list.

1. Choose **LEAF** from **Root cell**.
2. Leave **Hierarchy depth** empty.
3. Click **Apply view options**.
4. If the outlines fill the viewing area, scroll down slightly to zoom out.

<img src="images/crops/06-root-options.png" alt="LEAF selected as Root cell with blank Hierarchy depth and Apply view options" width="425">

The grey **All levels** text is a hint shown when the depth field is empty.

[Full screenshot: LEAF shown on its own](images/06-root-cell.jpg)

**What changed:** only the selected cell's own layout is shown. `LEAF` contains two
polygons on two layers; the repeated placements visible in the overview are gone.
The full screenshot is zoomed out three wheel steps to show the complete outlines.

Choose **All top-level cells** and apply to return to the design roots.
Applying view options resets visibility choices and clears saved measurements.

## 6. Limit the hierarchy depth

Cells can contain other cells, which can contain more cells. These nested levels
form the **hierarchy**.

1. Choose **TOP** as the root cell.
2. Enter **0** in **Hierarchy depth**.
3. Click **Apply view options**.

<img src="images/crops/07-depth-options.png" alt="TOP selected with Hierarchy depth set to zero" width="410">

[Full screenshot: TOP at depth zero](images/07-hierarchy-depth.jpg)

**What changed:** the viewer includes only `TOP`'s own rectangle and fits it to the
window. Geometry from child cells is excluded. The status shows one visible polygon.

| Depth | What is included |
| --- | --- |
| Empty | All nested levels. |
| `0` | The selected root's own geometry only. |
| `1` | The root plus its immediate children. |
| `2` | The root, its children, and their children. |

Use a non-negative whole number. To restore the overview, choose **All top-level
cells**, erase the depth value completely, and click **Apply view options**.
Depth can reduce the displayed geometry, but it cannot prevent every oversized or
slow file load.

## 7. Use the grid and scale bar

With the complete example restored, click **Grid**.

<img src="images/crops/08-grid-button.png" alt="The highlighted Grid button" width="106">

<img src="images/crops/08-grid-scale-detail.png" alt="Grid around the TOP rectangle and the 10.0 um scale bar" width="414">

[Full screenshot: grid and scale bar](images/08-grid-and-scale.jpg)

**What to look for:** faint grid lines appear, and the **Grid** button is highlighted.
Click it again to hide the grid. The scale bar at bottom left changes as you zoom;
in this picture it reads **10.0 um**.

`um` means micrometres (µm). `nm` means nanometres; 1 µm equals 1,000 nm. Read the
displayed units when measuring instead of comparing pixel distances between screenshots.

## 8. Measure a distance

1. Click **Measure**, or press **m**.
2. Click the centre of the upper-left blue rectangle.
3. Click the centre of the matching blue rectangle to its right, at the same height.
   Hold **Ctrl** while choosing the second point to constrain the ruler horizontally
   or vertically.

<img src="images/crops/09-ruler-detail.png" alt="Horizontal ruler reading 20.0 um, dx 20.0 um, dy 0.0 nm" width="786">

[Full screenshot: ruler between repeated shapes](images/09-measure-distance.jpg)

**What to look for:** the screenshot's ruler reads **20.0 um**, with **dx 20.0 um**
and **dy 0.0 nm**. `dx` is the horizontal distance and `dy` the vertical distance.
Your value may differ slightly depending on where you click.

The completed ruler appears in **Measurements**. Scroll down inside the sidebar
if needed to find the saved entry and its **Delete** button:

<img src="images/crops/09-saved-ruler.png" alt="Measurements section with the saved 20.0 um ruler and Delete button" width="425">

After the second point, measurement mode **ends automatically** and normal dragging
resumes. Click **Measure** again to create another ruler. While a ruler is still
being drawn, use the right mouse button to drag and pan.

## 9. Read coordinates and cancel an unfinished ruler

1. Click **Measure** again.
2. Move over the layout and click a first point, but do not choose a second point yet.

<img src="images/crops/10-pointer-detail.png" alt="Crosshair and zero-length preview at the first point of a new ruler" width="314">

The coordinate readout appears above the scale bar at the bottom left:

<img src="images/crops/10-coordinate-readout.png" alt="Coordinate readout showing x 12.0 um and y 9.01 um above the scale bar" width="380">

[Full screenshot: crosshair and coordinates](images/10-pointer-coordinates.jpg)

**What to look for:** a crosshair marks the current point. The bottom-left readout
shows its layout coordinates; here it reads **x 12.0 um | y 9.01 um**. The new ruler
shows zero length until you move to another point. The earlier saved ruler remains.

Click **Measure** or press **m** to cancel this unfinished ruler. The temporary
crosshair and coordinate readout disappear when measurement mode ends.

## 10. Delete a measurement

Find the saved ruler under **Measurements** and click its **Delete** button. You
can also select its entry and press **Delete** on the keyboard.

**Before deleting:** use the button on the saved entry.

<img src="images/crops/09-saved-ruler.png" alt="Saved measurement with its Delete button on the right" width="425">

**After deleting the last ruler:** the list is empty.

<img src="images/crops/11-empty-measurements.png" alt="Measurements section with No measurements yet after deletion" width="408">

[Full screenshot: ruler deleted](images/11-delete-measurement.jpg)

**What changed:** the ruler disappears from both the drawing and the list. With
the last ruler removed, the sidebar says **No measurements yet.** The layout and
grid are still present.

## If your screen looks different

- **Blank at startup:** load a file first.
- **Blank after hiding things:** click **Show All**, then **Fit View**.
- **Only one shape appears:** check the root-cell choice and clear the depth value
  before applying. The example's default overview contains nine polygons.
- **A control is missing:** scroll inside the sidebar.
- **An error appears:** read the message. A failed parse preserves the previous
  layout; not every GDSII element type is supported.

See [troubleshooting](../README.md#troubleshooting) and
[supported layouts and limits](../README.md#supported-layouts-and-limits) for more.

Screenshots use the bundled synthetic example, not a private design. Capture details
and observed results are recorded in [images/README.md](images/README.md).
