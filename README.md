# GDS Viewer

`gdsviewer` is a small, standalone browser viewer for GDSII layout files. A JavaScript
parser reads layouts in the browser, while PixiJS renders layers, cell instances,
measurements, a grid, and a scale bar. Python serves the viewer and optional preloaded
files; the [`gdstk`](https://heitzmann.github.io/gdstk/)-backed Python API remains available.

## Set up

Use Python 3.12 or newer and a modern browser. Install
[uv](https://docs.astral.sh/uv/), then run:

```text
uv sync
```

Rendering requires no internet connection: PixiJS is vendored locally, and all scripts
load from relative paths. Its version, source, checksum, license, and update procedure
are recorded in [VENDORED.md](src/gdsviewer/vendor/VENDORED.md).

The client-side migration is underway: a dependency-free JavaScript GDSII parser and
view-model builder (`src/gdsviewer/gds_parser.js`) parses both browser-selected files
and CLI-preloaded layouts entirely in the client. Its output is checked against the
gdstk-backed Python model on generated layouts. The browser uses the server for static
assets, a small preload configuration, and the raw preloaded bytes. The deprecated
`POST /api/load-gds` and `GET /api/layer-data` endpoints remain for compatibility;
the browser no longer calls them. `/api/initial-data` has been removed. See
[the migration plan](docs/javascript-migration.md) for the bounded migration sequence
and current format limits.

Selected or dropped files are buffered and parsed locally without being uploaded to or
retained by the server. Browser file loading currently has no explicit file-size limit.
CLI-preloaded files are read by the server and sent to the browser for parsing.

The deprecated server upload API has a default 100 MiB request limit and retains at most
eight parsed documents, evicting the oldest when a successful upload exceeds that count.
Python callers can configure these positive limits with the application factory's
`max_upload_bytes` and `max_documents` arguments. They do not apply to browser-local
file loading or CLI preload delivery, and they do not bound parsed memory; one complex
layout can still use substantial memory.

## Run

Open an empty viewer and select or drag in a `.gds` file:

```text
uv run gdsviewer
```

Preload a layout:

```text
uv run gdsviewer path/to/layout.gds
```

To display one specific top-level cell, pass it explicitly:

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

Install Node.js to run both the JavaScript syntax checks and the parser parity tests
invoked by pytest. Node.js is not required to run the viewer.

```text
uv run pytest
uv run ruff check src tests
node --check src/gdsviewer/gds_parser.js
node --check src/gdsviewer/gds_viewer.js
```
