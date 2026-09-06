# GDS Viewer: a guide in pictures

Let's explore the XOR layout together. You'll open the file, peel back a layer,
look inside a cell, and place a ruler. You can follow the whole walkthrough or jump
to the part you need. Each close-up links to a full screenshot for context.

We use [`examples/yzuda/xor.gds2`](../examples/yzuda/xor.gds2), the XOR example from
[YZUDA](https://www.yzuda.org/download/_GDSII_examples.html). The original filename
is `xor.gds2`; you do not need to rename it to `.gds`.

[Open](#1-open-the-viewer) · [Load](#2-load-the-example-layout) ·
[Move and zoom](#3-move-zoom-and-fit) · [Visibility](#4-show-or-hide-layers-and-cells) ·
[Choose a cell](#5-inspect-one-cell) · [Depth](#6-limit-the-hierarchy-depth) ·
[Grid](#7-use-the-grid-and-scale-bar) · [Measure](#8-measure-a-distance) ·
[Coordinates](#9-read-coordinates-and-cancel-an-unfinished-ruler) · [Delete a ruler](#10-delete-a-measurement)

## 1. Open the viewer

Extract the project ZIP if needed, then open `index.html` in a browser. On Windows,
you can also double-click `open_gds_viewer.bat`. Keep the JavaScript files and
`vendor` folder beside the HTML file.

<img src="images/crops/01-load-file.png" alt="Load GDS File button and .gds / .gds2 file hint" width="390">

[Full screenshot: empty viewer](images/01-open-viewer.jpg)

An empty drawing area is normal. The file button is ready on the left; root-cell
and depth controls become available after a file loads. Nothing opens automatically.

If your browser will not open the page directly, try the
[optional local server](../README.md#if-opening-the-html-directly-does-not-work).
These screenshots use that server in Edge on Windows. Direct `file://` loading has
also been checked in headless Edge; native OS picker dialogs and macOS/Linux
launchers were not exercised in this update.

## 2. Load the example layout

1. Click **Load GDS File**.
2. Open the project's `examples/yzuda` folder in the picker.
3. Choose **xor.gds2**.
4. Click **Fit View**.

![The XOR layout with all cells and layers visible](images/02-layout-overview.jpg)

The title now says **GDS Viewer: xor.gds2**. The status at the bottom right shows
**4 / 4 cells**, **15 / 15 layers**, and **520 visible polygons**. This is our
starting point for the walkthrough. The source file calls its top cell `abc2`,
even though the filename is `xor.gds2`.

The left sidebar holds the controls. The large area on the right is the drawing,
and the scale bar sits at its lower left. The sidebar scrolls on its own—scroll
there if you cannot see all the layers or the measurement list.

To open your own design, choose a supported `.gds` or `.gds2` file instead, or drag
it into the drawing area. Loading another file replaces the view and clears its
measurements. Files stay in your browser.

## 3. Move, zoom, and fit

Point at an interesting part of the layout and scroll to zoom in. Drag to move the
view. When you want the whole design back, click **Fit View**.

<img src="images/crops/03-fit-controls.png" alt="Fit View, Show All, and Hide All buttons" width="390">

<img src="images/crops/03-zoomed-layout.png" alt="A closer view of the XOR layout after zooming and panning" width="700">

[Full screenshot: zoomed and panned layout](images/03-zoom-and-pan.jpg)

The shapes get larger, while their borders stay thin. Geometry outside the window
is still there. **Fit View** brings it back into view, but does not restore hidden
layers or cells; use **Show All** for those.

You can also hold **z** to zoom in and **x** to zoom out at the pointer. Shortcuts
do not interrupt typing in an input or selecting a root cell.

## 4. Show or hide layers and cells

### Hide one layer

A layer button includes both the layer number and its datatype. **L47/D0**, for
example, means layer 47, datatype 0.

Click **Show All**, then **Fit View**. Scroll down in the sidebar and click
**L47/D0**, the light-blue layer.

<img src="images/crops/04-layer-controls.png" alt="XOR layer controls with L47/D0 faded and turned off" width="390">

<img src="images/crops/04-layer-status.png" alt="Status showing 14 of 15 layers and 512 visible polygons" width="540">

[Full screenshot: L47/D0 hidden](images/04-layer-visibility.jpg)

The button fades and its shapes disappear. There are now **14 / 15 visible layers**
and **512 visible polygons**. Click the button again to restore the layer.

### Hide a cell branch

A **cell** is a named group of shapes that can include other cells. Click
**Show All** again, then click the **nand2** name under **Cells**.

<img src="images/crops/05-cell-controls.png" alt="Cell tree with nand2 and via faded after hiding the branch" width="390">

Some of the remaining wiring looks like this:

<img src="images/crops/05-cell-result.png" alt="A closer look at the wiring remaining after hiding nand2" width="650">

[Full screenshot: nand2 branch hidden](images/05-cell-visibility.jpg)

The repeated `nand2` geometry disappears along with its `via` child. Visibility is
shared by cell name, so `via` is hidden in its other placements too. You will see
both names faded in the tree. The result is **2 / 4 visible cells** and
**166 visible polygons**.

Click a cell's **name** to change visibility. The small triangle beside it expands
or collapses the tree listing. **Show All** restores hidden geometry; these controls
never delete anything from the file. Click **Show All** before continuing.

## 5. Inspect one cell

To see what one `nand2` cell contains, choose it as the root:

1. Select **nand2** in **Root cell**.
2. Leave **Hierarchy depth** empty.
3. Click **Apply view options**.

<img src="images/crops/06-root-options.png" alt="nand2 selected as Root cell, with the depth field empty" width="390">

[Full screenshot: nand2 on its own](images/06-root-cell.jpg)

You now see a single `nand2` layout and its nested `via` geometry, rather than all
of its placements in the XOR design. The status shows **107 visible polygons**.
The grey **All levels** text is a hint: the depth field is empty.

Choose **All top-level cells** and apply to return to the full design. Applying
view options resets visibility choices and clears saved measurements.

## 6. Limit the hierarchy depth

Cells inside cells form the **hierarchy**. To see just the top cell's own geometry,
select **abc2**, enter **0** in **Hierarchy depth**, and apply.

<img src="images/crops/07-depth-options.png" alt="abc2 selected with hierarchy depth set to zero" width="390">

[Full screenshot: abc2 at depth zero](images/07-hierarchy-depth.jpg)

Only the shapes belonging directly to `abc2` remain: **28 polygons on 4 layers**.
The nested gate and via cells are left out of this view.

| Depth | What you see |
| --- | --- |
| Empty | Every nested level. |
| `0` | The selected root's own shapes. |
| `1` | The root and its immediate children. |
| `2` | The root, its children, and their children. |

Use a non-negative whole number. To return to the overview, choose **All top-level
cells**, erase the depth value, and apply. Depth can reduce the amount drawn after
loading; it cannot prevent every slow or oversized file load.

## 7. Use the grid and scale bar

With the full layout restored, click **Grid**.

<img src="images/crops/08-grid-button.png" alt="The highlighted Grid button" width="100">

<img src="images/crops/08-grid-scale-detail.png" alt="Grid lines and the 50.0 um scale bar below the XOR layout" width="520">

[Full screenshot: grid and scale bar](images/08-grid-and-scale.jpg)

Faint grid lines appear behind the layout. The scale bar in this view reads
**50.0 um**; it changes as you zoom. Click **Grid** again to turn it off before the
next step.

`um` means micrometres (µm), and `nm` means nanometres. There are 1,000 nm in 1 µm.
Read these units instead of comparing the sizes of shapes across screenshots.
The XOR file uses micrometres for its user units. The viewer currently assumes
this when labelling distances; see the [unit limitation](../README.md#supported-layouts-and-limits)
before measuring a file that uses different units.

## 8. Measure a distance

Let's measure between two matching contact regions near the upper-left of the layout.

1. Click **Measure**, or press **m**.
2. Click near the centre of the right-hand contact region in the pair shown below.
3. Hold **Ctrl** and click the matching region to its left at the same height.

<img src="images/crops/09-ruler-detail.png" alt="Horizontal XOR ruler reading 30.1 um, dx 30.1 um, dy 0.0 nm" width="620">

[Full screenshot: completed ruler](images/09-measure-distance.jpg)

Our ruler reads **30.1 um**, with **dx 30.1 um** and **dy 0.0 nm**. `dx` is the
horizontal distance; `dy` is the vertical distance. Yours may differ slightly
because it depends on where you click. This is a walkthrough measurement, not a
reference dimension for the circuit.

After the second click, measurement mode ends and normal dragging resumes. Scroll
to **Measurements** near the bottom of the sidebar to find the saved ruler:

<img src="images/crops/09-saved-ruler.png" alt="Measurements section with a saved 30.1 um ruler and its Delete button" width="390">

Click **Measure** again to start another ruler. While placing one, you can pan
with a right-button drag.

## 9. Read coordinates and cancel an unfinished ruler

Click **Measure** again, then click a first point near the middle of the layout.
Leave the second point unset for now.

<img src="images/crops/10-pointer-detail.png" alt="Crosshair and a zero-length ruler preview at the first point" width="470">

The bottom-left readout shows the current layout coordinates:

<img src="images/crops/10-coordinate-readout.png" alt="Readout showing x 62.0 um and y 55.3 um above the scale bar" width="400">

[Full screenshot: crosshair and coordinates](images/10-pointer-coordinates.jpg)

Here the readout is **x 62.0 um | y 55.3 um**. Your values will follow your pointer.
The new ruler starts at zero length until you move to another point, and the
previously saved ruler stays in place.

Press **m** to cancel the unfinished ruler. Its preview and coordinate readout
disappear when measurement mode ends.

## 10. Delete a measurement

Scroll to **Measurements** and click **Delete** beside the saved ruler. You can
also select its entry and press **Delete** on the keyboard.

<img src="images/crops/09-saved-ruler.png" alt="Saved ruler with its Delete button on the right" width="390">

After deleting it, the list looks like this:

<img src="images/crops/11-empty-measurements.png" alt="Measurements section saying No measurements yet" width="390">

[Full screenshot: measurement removed](images/11-delete-measurement.jpg)

The ruler disappears from both the drawing and the list. The XOR geometry remains.

## If your screen looks different

- **Nothing has loaded yet:** choose `examples/yzuda/xor.gds2` with the file picker.
- **Parts are missing:** click **Show All**, then **Fit View**.
- **You see one cell or only wiring:** choose **All top-level cells**, clear the
  depth field, and apply. The full XOR overview has 520 visible polygons.
- **A control is out of sight:** scroll inside the sidebar.
- **A file gives an error:** read the message. A failed parse leaves the previous
  layout available; the viewer does not support every GDSII element type.

See [troubleshooting](../README.md#troubleshooting) and
[supported layouts and limits](../README.md#supported-layouts-and-limits) for more.

These are real browser captures of the public YZUDA example, with 1-pixel polygon
borders. Text elements in the file are not rendered. [Source attribution](../examples/yzuda/README.md)
and [screenshot details](images/README.md) are included with the project.
