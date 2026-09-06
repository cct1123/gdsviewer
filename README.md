# GDS Viewer

Open a `.gds` or `.gds2` chip-layout file, explore its layers, and measure distances in your
browser. Your files stay on your computer.

**No Python, uv, installation, or build step is needed to use the viewer.**
The drawing library is included, so the viewer can work offline.

## Project objective

Make local GDSII inspection dependable: correct supported geometry and units,
consistent hierarchy controls, responsive navigation, and useful errors. Keep files
in the browser and the viewer usable without installation, a build, or a backend.
Prioritize correctness and usability over more formats or infrastructure.
Contributor guidance is in [AGENTS.md](AGENTS.md).

![GDS Viewer displaying YZUDA's XOR gate example](docs/viewer-xor.png)

## Illustration and tutorial files

The screenshot shows the [YZUDA XOR gate example](https://www.yzuda.org/download/_GDSII_examples.html)
loaded with **Load GDS File**, with all layers visible. Text labels are not rendered.
The inverter, NAND, XOR, and 1,000-polygon files are kept for documentation only.
See the [illustration tutorial](docs/layout-tutorial.md) and
[source attribution and checksums](examples/yzuda/README.md).


**Learn by following the pictures:** open the [illustrated user guide](docs/user-guide.md)
for focused close-ups of loading, zooming, visibility, cell selection, grid, and
measurements. Each close-up links to the original full screenshot for context.

## Start here

You need the project folder, a modern browser, and a `.gds` file to view.
If you downloaded a ZIP, **extract it first**. Keep `index.html` beside the
JavaScript files and the `vendor` folder; do not move it out on its own.

### Windows

1. Open the extracted project folder in File Explorer.
2. Find `index.html`, right-click it, and choose **Open with** and your browser.
   You can also double-click `open_gds_viewer.bat` to use your default browser.
3. Click **Load GDS File** and choose your `.gds` file. You can also drag the file
   onto the large viewing area.
4. Click **Fit View** to bring the layout into view.

The page starts empty until you choose a file. To try a small example, load
`tests/fixtures/hierarchy.gds` from the project folder.

<img src="docs/images/crops/01-load-file.png" alt="Load GDS File button and the drag-and-drop hint" width="426">

*Start with this button in the left sidebar.* [Full screenshot](docs/images/01-open-viewer.jpg)

### macOS and Linux

Open `index.html` with your browser, then follow steps 3 and 4 above. The optional
`open_gds_viewer.sh` launcher opens the same page. Launchers accept no arguments;
choose the layout inside the browser.

**Testing note:** direct `file://` loading of the XOR documentation file was tested
in headless Microsoft Edge on Windows. Root and subdirectory hosting also passed.
Native OS picker dialogs, macOS/Linux launchers, and other browser engines remain
unverified for this update; see [validation details](docs/yzuda-demo-validation.md).

## If opening the HTML directly does not work

You can use the included local server. This option requires Node.js and the full
project folder, including `tests/`. It still uses no Python, and layout files are
read inside your browser.

1. Open a terminal in the project folder, the folder containing `index.html`.
   On Windows, you can open PowerShell and change to that folder. For example,
   if you saved the project at `C:\projects\gdsviewer`, run:

   ```powershell
   cd "C:\projects\gdsviewer"
   ```

2. Start the server:

   ```text
   node tests/serve.cjs
   ```

3. Copy the address printed after **Static test viewer:** into your browser.
   It starts with `http://127.0.0.1:`; the port number is chosen each time.
   The separate **Browser checks:** address is for developers.
4. Leave the terminal open while using the viewer. Press **Ctrl+C** in that
   terminal when you want to stop the server.

The server is available only on your computer. If the terminal says `node` is not
recognized or not found, Node.js is not available there. Install Node.js to use this
optional method; the viewer itself does not require it.

## Find your way around

| What you want to do | How to do it |
| --- | --- |
| Open another layout | Click **Load GDS File**, or drop another `.gds` file onto the viewer. |
| Move around the layout | Click and drag in the viewing area. |
| Zoom in or out | Scroll the mouse wheel, or hold **z** to zoom in and **x** to zoom out at the pointer. |
| See the whole layout again | Click **Fit View**. |
| Show or hide parts of the layout | Toggle individual layers or cells in the sidebar. **Show All** and **Hide All** affect all of them. |
| Show a reference grid | Click **Grid**. |
| Check the current scale | Read the scale bar in the viewing area. |

<img src="docs/images/crops/04-layer-controls.png" alt="Layer controls with L7/D3 faded because it is hidden" width="425">

*Click a layer button to hide or restore its shapes. A faded button means hidden.*
[Visibility walkthrough](docs/user-guide.md#4-show-or-hide-layers-and-cells) ·
[Full screenshot](docs/images/04-layer-visibility.jpg)

### Measure a distance

1. Click **Measure** or press **m**.
2. Click a starting point, then an ending point to create a ruler.
3. Hold **Ctrl** while choosing the second point to keep the ruler horizontal or vertical.

<img src="docs/images/crops/09-ruler-detail.png" alt="A ruler measuring 20.0 um horizontally between two repeated shapes" width="786">

*This example measures 20 micrometres. The label also shows horizontal (`dx`) and
vertical (`dy`) distances.* [Full screenshot](docs/images/09-measure-distance.jpg)

While measuring, drag with the right mouse button to move the view. Use a ruler's
delete button, or select it in the measurement list and press **Delete**, to remove it.
After the second point, measuring ends automatically and normal navigation resumes.
Click **Measure** again to start another ruler. To cancel an unfinished ruler,
click **Measure** or press **m** before choosing its second point.

See the [measurement walkthrough](docs/user-guide.md#8-measure-a-distance) for a
20 micrometre example and screenshots of the saved ruler and Delete button.

### Choose which cells to display

A **cell** is a named group of shapes that can include copies of other cells.
This nesting is called the **hierarchy**. You can leave the default settings alone
when first opening a file.

- **Root cell:** leave **All top-level cells** selected to view the design roots,
  or choose a specific cell to inspect it.
- **Hierarchy depth:** leave this blank to include all nested levels. Enter `0`
  to show only the selected root's own shapes, or `1` to also include its immediate
  child cells.
- Click **Apply view options** after changing either setting.

Applying view options resets visibility choices and clears measurements. Loading
another file also clears measurements.

See the close-ups for [choosing a root cell](docs/user-guide.md#5-inspect-one-cell)
and [setting hierarchy depth](docs/user-guide.md#6-limit-the-hierarchy-depth).

## Troubleshooting

| What you see | What to try |
| --- | --- |
| An empty viewer at startup | Click **Load GDS File** and select a `.gds` file. Nothing loads automatically. |
| A loaded layout looks blank | Click **Show All**, then **Fit View**. Select **All top-level cells**, clear **Hierarchy depth**, and apply the options. An empty cell has no shapes to display. |
| “PixiJS failed to load” | Extract the whole project again and keep the `vendor` folder beside `index.html`. It contains the drawing library. |
| The page opens in a text editor | Right-click `index.html` and use **Open with** to choose a browser. |
| A file produces a parsing or unsupported-path error | Try the included `tests/fixtures/hierarchy.gds` example. The viewer supports only the geometry described below; a failed parse leaves the previous layout available. |
| A large layout makes the browser slow | Try a smaller layout. Once it loads, selecting one cell or a lower hierarchy depth may reduce what is drawn. These options cannot prevent every slow or oversized load. |

## Supported layouts and limits

Tests cover polygons, straight paths with flush, square, and explicit end extensions,
nested and repeated cells, rectangular arrays, rotation, magnification, reflection,
separate layers and datatypes, multiple roots, and hierarchy-depth limits.
Empty cells display an empty view. Libraries with no cells and malformed record
framing produce errors. Round-ended paths produce an explicit unsupported error.
Zero padding after ENDLIB is accepted; nonzero trailing data is rejected.

This is not a complete GDSII implementation. Text, boxes, nodes, properties, unusual
reference flags, vendor extensions, and arbitrary path joins are not guaranteed to
render correctly. Some unsupported elements are skipped. Model coordinates are
rounded to 0.001 of the file's library user unit.

Files are processed in browser memory and are not uploaded. Replacing a layout
releases its old drawing resources, but there are no enforced file-size, geometry,
processing-time, or memory limits. Large or heavily repeated layouts can pause the
browser or exhaust memory. Hierarchy depth is a viewing option, not a complete
resource limit.

## Share or host the viewer

Keep these files together when copying the viewer to another computer or a static
web host:

```text
index.html
gds_parser.js
gds_viewer.js
vendor/
  pixi.min.js
  VENDORED.md
  PIXI-LICENSE.txt
LICENSE
```

The launchers and this README are optional conveniences. Keep `tests/` as well if
you want the example layouts, local server, or developer checks. Static hosting
also works under a subdirectory. There is no build step or application backend.
Keep `docs/`, including `docs/images/`, if you want the illustrated instructions
and README pictures to remain available with your copy. Keep `examples/yzuda/`
with its attribution if you also include the documentation layouts.

The `main` branch is the Python-free version. The previous Python launcher version
is preserved on `python-launch`. Commands such as `uv run gdsviewer`, the Python
API, and `/api/*` endpoints are retired on `main`. See the
[migration record](docs/javascript-migration.md) for details.

## For developers

You can skip this section if you only want to view layouts.

Development checks use Node.js, validated with version 24.14.1. There are no npm
packages to install. From the project folder, run:

```text
node --check gds_parser.js
node --check gds_viewer.js
node --check tests/browser-smoke.js
node --test tests/*.test.cjs
```

If a sandbox blocks test child processes with `spawn EPERM`, Node 24 also supports
`node --test --test-isolation=none tests/*.test.cjs`. Record use of this fallback;
ordinary assertion failures still need diagnosis.

The Node suite checks saved independent reference models, malformed inputs, and
static asset delivery. Fixture provenance is in [tests/fixtures/README.md](tests/fixtures/README.md).

To check browser interactions, start the local server as described above, open its
**Browser checks:** address, and click **Run browser checks**. The harness uses
synthetic layouts and the real renderer to exercise loading, controls, navigation,
measurements, resize, error handling, overlapping loads, and graphics cleanup.
Also inspect the rendered layout and try the native file picker manually.

The included PixiJS version, checksum, license, and update instructions are in
[vendor/VENDORED.md](vendor/VENDORED.md).

## License

Viewer code: MIT. See `LICENSE` and the vendored asset notices. Third-party documentation
layouts have separate [source attribution](examples/yzuda/README.md); no explicit
license is stated on their download page.
