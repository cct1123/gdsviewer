# GDS Viewer

Take a closer look at a chip layout, one layer at a time. GDS Viewer opens `.gds`
and `.gds2` files in your browser, where you can move around the design, inspect
individual cells, and measure distances. Your files stay on your computer.

There is nothing to install or build. The drawing library is included, so you can
use the viewer offline too.

The ivory glass sidebar uses slate text, sage indicators, and soft terracotta
accents. It keeps cell and layer controls beside the drawing. **Fit View**,
**Measure**, and **Grid** sit above the canvas. The grid starts on, with stronger
major lines and five lighter subdivisions per interval, and adapts as you zoom.

![YZUDA's XOR layout in the glass UI with the cell tree and default major/minor grid](docs/viewer-xor.png)

See the [visual design review](docs/design-review.md) for the palette and current
empty and loaded views. The step-by-step pictures below retain the earlier styling;
their controls and workflow still apply.

New to layout viewers? The [guide in pictures](docs/user-guide.md) walks through
this same XOR layout, with close-ups of each control and the result of using it.

## Open your first layout

1. Download or copy the project folder. If it is a ZIP, extract it first.
2. Open `index.html` in your browser. Keep the JavaScript files and `vendor` folder
   beside it. On Windows, you can also double-click `open_gds_viewer.bat`.
3. Click **Load GDS File** and choose a `.gds` or `.gds2` file. Dragging a file into
   the drawing area works too.
4. Click **Fit View** whenever you want to see the whole layout again.

<img src="docs/images/crops/01-load-file.png" alt="Load GDS File button and the .gds / .gds2 file hint" width="390">

The viewer starts empty. To follow along with the pictures, open
[`examples/yzuda/xor.gds2`](examples/yzuda/xor.gds2). This is the XOR example from
[YZUDA](https://www.yzuda.org/download/_GDSII_examples.html); its original filename
ends in `.gds2`, which the viewer accepts. The example files are included for the
documentation and are opened with the same picker as your own files.
[Full screenshot of the empty viewer](docs/images/01-open-viewer.png).

On macOS or Linux, open `index.html` with a browser, or use `./open_gds_viewer.sh`.
The current screenshots were captured in the Codex in-app browser on Windows using
the optional local server. See the [validation record](docs/yzuda-demo-validation.md)
for checked behavior and platform limits.

## Find your way around

| When you want to… | Try this |
| --- | --- |
| Move across the layout | Click and drag in the drawing area. |
| Get a closer look | Scroll the wheel, or hold **z** to zoom in and **x** to zoom out at the pointer. |
| Return to the overview | Click **Fit View**. |
| Hide a layer or cell | Click its name in the sidebar. Click again to bring it back. |
| Restore everything you hid | Click **Show All**. |
| Show or hide the reference grid | **Grid** starts on, with major lines and five minor subdivisions per interval. Click to toggle both. |
| Open another file | Use **Load GDS File** again, or drop the file into the viewer. |

**Fit View**, **Measure**, and **Grid** are in the toolbar above the canvas.
The sidebar scrolls separately from the drawing. If you cannot see all the layers
or the measurement list, scroll inside the sidebar.

<img src="docs/images/crops/04-layer-controls.png" alt="XOR layer controls with L47/D0 hidden, using a dashed border and hollow indicator" width="390">

A muted layer button with a dashed border and hollow indicator means that layer is
hidden. Here, **L47/D0** is off: layer 47, datatype 0. Nothing is deleted from the file.
[See the visibility walkthrough](docs/user-guide.md#4-show-or-hide-layers-and-cells).

### Measure a distance

Click **Measure** (or press **m**), then click two points. Hold **Ctrl** while
choosing the second point to keep the ruler horizontal or vertical.

<img src="docs/images/crops/09-ruler-detail.png" alt="A horizontal ruler on the XOR layout reading 44.0 um, with dy 0.0 nm" width="550">

This ruler across the middle of the XOR layout reads **44.0 µm**. Your result
depends on the points you choose. The label also gives `dx`, the horizontal
distance, and `dy`, the vertical distance.
[Follow the measurement steps](docs/user-guide.md#8-measure-a-distance).

After the second click, the ruler is saved and normal dragging resumes. Click
**Measure** again for another ruler. While drawing a ruler, use a right-button drag
to pan. Press **m** to cancel an unfinished ruler, or use **Delete** beside a saved
measurement to remove it.

### Look inside one cell

A **cell** is a named group of shapes. It can contain copies of other cells; that
nesting is the **hierarchy**. You can leave these settings alone at first:

- Expand **Root cell & hierarchy** to access these settings.
- **Root cell** chooses what to inspect. Keep **All top-level cells** for the full
  design, or choose a cell such as `nand2` in the XOR example.
- **Hierarchy depth** controls how far into the nested cells to look. Leave it
  blank for all levels. `0` shows only the root's own shapes; `1` adds its children.
- Click **Apply view options** after changing either setting.

Applying these options resets hidden layers and cells, and clears measurements.
The guide shows [one cell on its own](docs/user-guide.md#5-inspect-one-cell) and
[the root at depth zero](docs/user-guide.md#6-limit-the-hierarchy-depth).

## Troubleshooting

| What you see | What to try |
| --- | --- |
| An empty viewer when it opens | Choose a file with **Load GDS File**. Nothing loads automatically. |
| A loaded layout looks blank | Click **Show All**, then **Fit View**. If needed, choose **All top-level cells**, clear the depth field, and apply. An empty cell has no shapes to show. |
| “PixiJS failed to load” | Extract the full project again. The `vendor` folder must sit beside `index.html`. |
| The page opens in a text editor | Right-click `index.html` and use **Open with** to select your browser. |
| A parsing or unsupported-path error | Try the XOR documentation file to check that the viewer is working. Some GDSII geometry is not supported; a failed parse leaves the previous layout available. |
| A large layout feels slow | Try a smaller file. Once it loads, choosing one root cell or a lower depth may help, but these options cannot prevent every oversized load. |

### If opening the HTML directly does not work

You can serve the folder locally. This optional route needs Node.js; simply opening
`index.html` does not.

1. Open a terminal in the project folder. For example, in PowerShell:

   ```powershell
   cd "C:\projects\gdsviewer"
   ```

2. Start the helper:

   ```text
   node tests/serve.cjs
   ```

3. Open the address printed after **Static test viewer:**. Its port number changes
   each time. The other address, **Browser checks:**, runs the developer tests.
4. Leave the terminal open while you use the viewer. Press **Ctrl+C** there to stop it.

The helper is available only on your computer. If `node` is not found, install
Node.js to use this option, or try opening `index.html` in another browser.

## Supported layouts and limits

Tests cover polygons, straight paths with flush, square, and explicit end extensions,
nested and repeated cells, rectangular arrays, rotation, magnification, reflection,
separate layers and datatypes, multiple roots, and hierarchy-depth limits. Empty
cells open as empty views. Malformed record framing produces an error. Zero padding
after ENDLIB is accepted; nonzero trailing data is rejected. Round-ended paths
produce an explicit unsupported error.

This is not a complete GDSII implementation. Text, boxes, nodes, properties, unusual
reference flags, vendor extensions, and arbitrary path joins are not guaranteed to
render correctly. Some unsupported elements are skipped. Model coordinates are
rounded to 0.001 of the file's library user unit. The XOR pictures show supported
geometry; they do not include the file's text labels.

Distance labels currently assume that one library user unit is one micrometre,
as it is in the XOR example. Files using other user units can display misleading
measurement, coordinate, and scale-bar labels; check the file's units before relying
on those readings.

Files are processed in browser memory and are not uploaded. Old drawing resources
are released when you replace a layout, but there are no enforced file-size,
geometry-count, processing-time, or memory limits. A heavily repeated layout can
pause the browser or exhaust memory. Hierarchy depth is a viewing option, not a
complete resource limit.

## Share or host the viewer

Keep these files together when copying the viewer or putting it on a static web host:

```text
index.html
gds_parser.js
gds_viewer.js
liquid_glass.js
vendor/
  pixi.min.js
  VENDORED.md
  PIXI-LICENSE.txt
  LIQUIDGL-LICENSE.txt
  LIQUID-GLASS-EFFECT-LICENSE.txt
LICENSE
```

The launchers and README are optional. Include `docs/` for the illustrated guide,
and `examples/yzuda/` with its attribution for the tutorial layouts. Keep `tests/`
if you want the local server or developer checks. Static hosting also works under
a subdirectory; no backend or build step is required.

The former Python API and `/api/*` endpoints are retired on `main`. See the
[migration record](docs/javascript-migration.md) if you used the older viewer.

## For developers

The project aims to make local GDSII inspection dependable and easy to use, with
plain JavaScript and local assets. [AGENTS.md](AGENTS.md) has the contributor guidance.

Development checks use Node.js (validated with 24.14.1). No npm packages are needed:

```text
node --check gds_parser.js
node --check gds_viewer.js
node --check liquid_glass.js
node --check tests/browser-smoke.js
node --test tests/*.test.cjs
```

If a sandbox blocks test processes with `spawn EPERM`, use
`node --test --test-isolation=none tests/*.test.cjs` on Node 24 and record the fallback.
The suite checks independent reference models, malformed inputs, and static asset
delivery. See [fixture provenance](tests/fixtures/README.md).

For browser checks, start the helper above and open its **Browser checks:** address.
Click **Run browser checks** to exercise loading, navigation, visibility,
major/minor grids, measurements, resizing, errors, overlapping loads, and graphics
cleanup. Also inspect the drawing and test the native picker manually on the
browsers you support.
[The screenshot record](docs/images/README.md) describes how the guide was captured.

The local liquid-glass renderer in `liquid_glass.js` refracts a decorative backdrop;
it does not sample geometry, measurements, or page content. It redraws on UI
interaction and resize, with no idle animation. Its separate WebGL canvas is capped
at 1.5 million pixels and falls back to CSS if WebGL fails or reduced transparency
is requested. Reduced motion disables pointer lighting. There are no remote
textures or additional runtime dependencies. See [attribution and notices](vendor/VENDORED.md#liquid-glass-adaptations).

PixiJS version, checksum, license, and update instructions are in
[vendor/VENDORED.md](vendor/VENDORED.md).

## License

Viewer code: MIT. See [LICENSE](LICENSE) and the notices in `vendor/`. The YZUDA
layouts have their own [source attribution](examples/yzuda/README.md); their download
page does not state an explicit license.
