# GDS Viewer

`gdsviewer` is a small, standalone browser viewer for GDSII layout files. Python and
[`gdstk`](https://heitzmann.github.io/gdstk/) parse the layout, while PixiJS renders
layers, cell instances, measurements, a grid, and a scale bar in the browser.

## Set up

Install [uv](https://docs.astral.sh/uv/), then run:

```text
uv sync
```

The browser client currently loads PixiJS from jsDelivr, so opening the viewer requires
an internet connection unless that script is already cached by the browser.

Browser uploads are limited to 100 MiB. The browser and server still buffer an accepted
file in memory, and parsed documents remain in server memory, so repeated or complex
uploads can exhaust memory well before that file-size limit.

## Run

Open an empty viewer and select or drag in a `.gds` file:

```text
uv run gdsviewer
```

Preload a layout:

```text
uv run gdsviewer path/to/layout.gds
```

For layouts with several top-level cells, pass a cell explicitly:

```text
uv run gdsviewer path/to/layout.gds --cell TOP
```

Use `open_gds_viewer.bat` on Windows or `./open_gds_viewer.sh` on macOS/Linux for the
default viewer. Run `uv run gdsviewer --help` for host, port, browser, title, and tree
depth options.

## License

MIT. See `LICENSE`.

## Python API

```python
from gdsviewer import load_gds_view_model, serve_gds_viewer

model = load_gds_view_model("layout.gds")
serve_gds_viewer(initial_gds_path="layout.gds")
```

## Validate

```text
uv run pytest
uv run ruff check src tests
node --check src/gdsviewer/gds_viewer.js
```
