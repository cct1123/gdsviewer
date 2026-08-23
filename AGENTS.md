# AGENTS.md

## Project overview

`gdsviewer` is a small, standalone browser viewer for GDSII layout files. Python and `gdstk` parse a layout and produce a JSON-friendly view model; the browser client uses PixiJS to render polygon layers and cell instances, plus visibility controls, measurements, a grid, pointer coordinates, and a scale bar.

Keep the project small and dependable. Preserve the boundary between parsing/model construction and browser rendering. Be explicit about rendering limits: the current geometry path covers polygons and direct paths (paths are converted to polygons), together with transformed and repeated cell references. Do not imply that every GDSII record type or layout feature is rendered unless tests demonstrate it.

## Working rules

- Read this file and `README.md` before changing code.
- Use an isolated Git worktree for any change intended for commit. Do not develop release-bound work directly in the primary checkout.
- Keep changes narrowly scoped; avoid adding a framework, build pipeline, or browser package manager without a concrete need.
- Do not edit generated or local-state directories such as `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `__pycache__/`, or `src/gdsviewer.egg-info/`.
- Do not commit or push until all applicable gates below pass and the user explicitly authorizes that commit or release.

## Setup and run

Requirements:

- Python 3.12 or newer
- `uv`
- A modern browser
- Node.js only for the JavaScript syntax gate

From the repository root:

```text
uv sync
```

`uv sync` installs the locked runtime and default development dependencies, including `gdstk`, NumPy, pytest, and Ruff.

Run an empty viewer, then select or drag in a `.gds` file:

```text
uv run gdsviewer
```

Preload a layout:

```text
uv run gdsviewer path/to/layout.gds
```

Choose one top-level cell explicitly when needed:

```text
uv run gdsviewer path/to/layout.gds --cell TOP
```

The default server listens on `127.0.0.1:8765` and opens a browser. See all CLI options with:

```text
uv run gdsviewer --help
```

Network requirement: `src/gdsviewer/gds_viewer.html` currently loads PixiJS 8.x from jsDelivr (`https://cdn.jsdelivr.net/npm/pixi.js@8.x/dist/pixi.min.js`). The Python server and local assets can start offline, but rendering requires network access unless that CDN asset is already cached. Do not describe the viewing experience as fully offline while this dependency remains external.

## Architecture map

- `pyproject.toml` — package metadata, Python/development dependencies, console entry point, pytest configuration, and Ruff line length.
- `uv.lock` — locked Python environment; update it through `uv`, not by hand.
- `src/gdsviewer/cli.py` — argument parsing, optional browser launch, and handoff to the server. Defaults to loopback (`127.0.0.1`) on port `8765`.
- `src/gdsviewer/__main__.py` — `python -m gdsviewer` entry point.
- `src/gdsviewer/__init__.py` — intentionally small public Python API.
- `src/gdsviewer/viewer.py` — Python/gdstk side:
  - reads GDSII libraries and selects cells;
  - converts direct paths to polygons;
  - traverses hierarchy, transforms, magnification, rotation, reflection, and repetitions;
  - builds layer/template/group metadata and layout bounds;
  - serves HTML, JavaScript, initial metadata, uploads, and per-layer JSON through a small WSGI app;
  - keeps parsed view models in an in-process document store.
- `src/gdsviewer/gds_viewer.html` — page structure, styling, controls, PixiJS CDN import, and local client-script import.
- `src/gdsviewer/gds_viewer.js` — browser/PixiJS side:
  - fetches initial, uploaded, and per-layer data;
  - constructs reusable graphics contexts and transformed instances;
  - manages layer/cell visibility, pan/zoom/fit, measurements, grid, cursor overlay, status, and scale bar.
- `tests/test_viewer.py` — Python parser/model and WSGI endpoint coverage using generated temporary GDS files. It also asserts the presence of important browser controls and client behaviors, but it is not a browser-rendering or visual-regression suite.
- `open_gds_viewer.sh` and `open_gds_viewer.bat` — convenience launchers.

Data flow:

1. `gdstk.read_gds` parses a file on the Python side.
2. `viewer.py` selects roots and builds a hierarchy-aware, JSON-friendly view model.
3. The WSGI app returns metadata and one layer initially, then serves additional layers on demand.
4. `gds_viewer.js` maps templates and transformed groups into PixiJS graphics and owns all interactive browser state.

Keep parsing and geometry semantics in Python. Keep drawing, interaction, DOM state, and viewport behavior in JavaScript. If the wire format changes, update both sides and add endpoint/model assertions.

## Code style

### Python

- Follow the existing Python 3.12+ style and Ruff configuration; maximum line length is 120.
- Use type hints on public functions and on non-obvious internal data structures.
- Prefer small, deterministic helpers. Keep filesystem/server concerns separate from geometry traversal where practical.
- Use `pathlib.Path`, context managers, and explicit keyword arguments for multi-option APIs.
- Preserve layer and datatype separately; use the existing `L<layer>/D<datatype>` key format at the browser boundary.
- Preserve hierarchy and instance transforms rather than flattening indiscriminately. Cache reusable per-cell geometry where possible.
- Treat floating-point rounding as a serialization/rendering decision. Do not reduce source precision earlier than necessary.
- Raise actionable errors for missing cells, empty libraries, and ambiguous top-level-cell selection.
- Keep `gdsviewer.__init__` exports intentional; adding an internal helper does not automatically make it public API.

### JavaScript and HTML

- Use plain browser JavaScript and the existing PixiJS API; do not introduce transpilation or bundling casually.
- Match the existing formatting: two-space indentation, semicolons, `const` by default, and `let` only for reassigned state.
- Guard optional DOM and PixiJS state, especially during startup, file reload, and resize.
- Keep layout coordinates distinct from screen coordinates. Apply transforms in one well-defined direction and test pan/zoom anchor behavior when changing it.
- Build labels and user-derived text with `textContent`, not `innerHTML`.
- Keep large geometry payloads layer-scoped and reuse templates/graphics contexts instead of duplicating polygon data for every instance.
- Preserve keyboard, pointer, drag/drop, and resize behavior when changing controls. A JavaScript syntax pass is necessary but does not verify browser behavior.

## Testing: cheap checks first

Run the narrowest relevant check while iterating, then expand. Stop on failure, diagnose it, and rerun the failing check before proceeding.

1. Python-only change: run the focused test first, for example:

   ```text
   uv run pytest tests/test_viewer.py -k <relevant_name>
   ```

2. JavaScript change: run the syntax check immediately:

   ```text
   node --check src/gdsviewer/gds_viewer.js
   ```

3. Python lint after focused tests pass:

   ```text
   uv run ruff check src tests
   ```

4. Full automated gate:

   ```text
   uv run pytest
   uv run ruff check src tests
   node --check src/gdsviewer/gds_viewer.js
   ```

Verified baseline for this repository state: `uv run pytest` reports 14 passing tests; `uv run ruff check src tests` passes; and `node --check src/gdsviewer/gds_viewer.js` passes.

Failure branches and required coverage:

- Parsing/model changes: test malformed or empty input where relevant, unknown cell names, multiple top-level cells, metadata-like top-level cells, direct paths, nested references, repeated references, transforms, layer/datatype separation, bounds, and `max_depth` behavior.
- WSGI/upload changes: test empty request bodies, parse failures, unknown document IDs, missing layer keys, large/gzipped JSON responses, cleanup of temporary files, and status/content-type behavior.
- Browser/data-contract changes: update model and endpoint assertions, run `node --check`, then manually exercise initial preload and drag/drop upload in a browser. Check layer and cell toggles, pan, wheel and keyboard zoom, fit, measurements and deletion, grid, scale bar, pointer status, resize, empty layouts, and PixiJS-load failure messaging.
- Performance-sensitive changes: use a layout with many polygons, layers, repeated references, and hierarchy. Confirm that initial layer loading remains responsive and memory does not grow unexpectedly across repeated uploads.
- Platform-launcher changes: exercise the changed launcher on its target platform; do not infer Windows behavior from a Linux shell or vice versa.

Do not weaken or delete a failing test merely to clear a gate. If a check cannot run because its tool or platform is unavailable, report that limitation explicitly; do not call the gate passed.

## Security and robustness

This is a local viewing tool, not a hardened multi-user service.

- Keep the default bind address at `127.0.0.1`. There is no authentication, authorization, TLS, CSRF defense, origin validation, or tenant isolation. Binding to `0.0.0.0` or another non-loopback interface exposes the upload and document endpoints and must be treated as an explicit security decision, not a harmless convenience.
- Treat every GDS file and filename as untrusted. Parsing malformed files reaches native-backed `gdstk` code; errors must become controlled client errors rather than server crashes where possible.
- The upload endpoint trusts `CONTENT_LENGTH`, rejects bodies larger than 100 MiB by default, reads each accepted body into memory, writes a temporary file, parses the full layout, and builds an in-memory view model. The `create_gds_viewer_app` `max_upload_bytes` argument can configure this limit. There is still no polygon-count, hierarchy-expansion, repetition-count, time, or parsed-memory limit, so files below the byte limit can produce very large geometry. Do not expose the service to untrusted networks without adding and testing further limits.
- The in-process document store has no eviction and retains each parsed model for the life of the server. Repeated uploads can exhaust memory. Any production-like use needs bounded storage and cleanup.
- `max_depth` can limit hierarchy traversal, but it is not a complete resource-control mechanism; broad trees, repetitions, and large cells can still consume substantial CPU and memory.
- Temporary uploads must always be deleted, including parse-error paths. Never use a user-provided path directly for temporary storage.
- Return useful parse errors, but reconsider raw exception text before any non-local deployment because it may reveal implementation or filesystem details.
- Do not insert filenames, cell names, layer labels, query values, or error text as HTML. Continue using JSON encoding and DOM `textContent`.
- The external PixiJS script is a supply-chain and availability dependency. Version-range CDN URLs can change content. If offline or reproducible operation becomes a requirement, vendor or pin a reviewed asset and document its license and update process.
- Avoid logging uploaded layout contents or geometry. GDS files may contain confidential design data.

## Commit and release gates

Before requesting a commit:

- Work is in an isolated worktree and the diff is limited to the intended change.
- No local environments, caches, generated metadata, temporary GDS files, or other artifacts are included.
- Documentation matches actual behavior and every documented command has been run successfully in the applicable environment.
- The full automated gate passes:

  ```text
  uv run pytest
  uv run ruff check src tests
  node --check src/gdsviewer/gds_viewer.js
  ```

- Browser-facing changes have a recorded manual smoke test covering load, rendering, visibility controls, navigation, measurements, grid, and scale bar. State the browser and any untested platform explicitly.
- Security and memory implications of upload, hierarchy, repetition, and document-store changes have been reviewed.

Before a release, also:

- Confirm the version and user-facing documentation are consistent.
- Re-run `uv sync` from the lockfile in a clean worktree, then rerun every automated gate.
- Test both an empty viewer with browser upload and a preloaded representative GDS file; include a multi-root or explicitly selected-cell case.
- Confirm package data includes `gds_viewer.html` and `gds_viewer.js`, and smoke-test the installed console entry point rather than only the source checkout.
- Record the external jsDelivr/PixiJS requirement and all known rendering or platform limitations in release notes.
- Do not commit, tag, publish, or push until the gates pass and the user gives explicit authorization for that action.
