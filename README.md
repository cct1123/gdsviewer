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

The client-side migration is underway: a dependency-free JavaScript GDSII parser and
view-model builder (`src/gdsviewer/gds_parser.js`) parses both browser-uploaded files
and CLI-preloaded layouts entirely in the client. Its output is checked against the
gdstk-backed Python model on generated layouts. The server only supplies static assets,
a small preload configuration, the raw preloaded bytes, and the (soon-to-be-removed)
upload endpoint. See `docs/javascript-migration.md` for the bounded migration sequence
and current format limits.

Browser uploads are limited to 100 MiB. The browser and server still buffer each
accepted file in memory. Uploaded documents are retained by the server only until the
next slice removes the upload path; at most eight parsed documents are kept, evicting
the oldest after a successful upload. Python callers can configure both positive limits
with the application factory's `max_upload_bytes` and `max_documents` arguments. These
limits bound upload size and document count, not parsed memory; one complex layout can
still use substantial memory.

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
node --check src/gdsviewer/gds_parser.js
node --check src/gdsviewer/gds_viewer.js
```
