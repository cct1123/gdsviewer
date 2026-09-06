# AGENTS.md

## Project overview

`gdsviewer` is a small, standalone browser viewer for GDSII layout files. The browser's `gds_parser.js` parses local and CLI-preloaded layouts and builds a JSON-friendly view model; `gds_viewer.js` uses PixiJS to render polygon layers and cell instances, plus visibility controls, measurements, a grid, pointer coordinates, and a scale bar. Python serves assets and optional preload data. Its `gdstk` parser/model remains available to Python callers, the parity tests, and the deprecated upload API.

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
- Node.js for the JavaScript syntax gates and the parser parity tests invoked by pytest; it is not needed to run the viewer

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

Network requirement: none for rendering. `src/gdsviewer/gds_viewer.html` loads PixiJS from the vendored copy at `src/gdsviewer/vendor/pixi.min.js` (version, source URL, and SHA256 recorded in `src/gdsviewer/vendor/VENDORED.md`); all script tags use relative paths, so the viewer renders fully offline. The browser uses the Python server for the CLI preload flow (`/api/preload`, `/api/preloaded-gds`) plus static asset delivery. `POST /api/load-gds`, `GET /api/layer-data`, and the document store remain as deprecated compatibility paths scheduled for removal in the static-server reduction slice; the browser does not use them. `/api/initial-data` has been removed.

## Architecture map

- `pyproject.toml` — package metadata, Python/development dependencies, console entry point, pytest configuration, and Ruff line length.
- `uv.lock` — locked Python environment; update it through `uv`, not by hand.
- `src/gdsviewer/cli.py` — argument parsing, optional browser launch, and handoff to the server. Defaults to loopback (`127.0.0.1`) on port `8765`.
- `src/gdsviewer/__main__.py` — `python -m gdsviewer` entry point.
- `src/gdsviewer/__init__.py` — intentionally small public Python API.
- `src/gdsviewer/viewer.py` — Python API, reference model, and WSGI server:
  - uses gdstk to read libraries, select cells, convert direct paths, traverse transformed/repeated references, and build layer/template/group metadata and bounds for Python callers and parity tests;
  - serves HTML, local JavaScript (including vendored PixiJS), preload configuration, and raw preloaded GDS bytes;
  - retains the deprecated upload and per-layer JSON endpoints, backed by an in-process document store that evicts the oldest documents above its configured count limit.
- `src/gdsviewer/gds_parser.js` — standalone browser/Node parser and view-model builder; owns client-side GDSII decoding, supported path conversion, root selection, hierarchy/transforms/repetitions, templates, groups, layers, and bounds without depending on the DOM or PixiJS.
- `src/gdsviewer/gds_viewer.html` — page structure, styling, controls, and local imports for vendored PixiJS, the parser, and the renderer.
- `src/gdsviewer/gds_viewer.js` — browser/PixiJS side:
  - reads local files as `ArrayBuffer`s, fetches optional preload configuration/raw bytes, and calls the parser to build the full model locally;
  - constructs reusable graphics contexts and transformed instances;
  - manages layer/cell visibility, pan/zoom/fit, measurements, grid, cursor overlay, status, and scale bar.
- `tests/test_viewer.py` — Python parser/model and WSGI endpoint coverage using generated temporary GDS files. It also asserts the presence of important browser controls and client behaviors, but it is not a browser-rendering or visual-regression suite.
- `tests/test_js_parser.py` and `tests/js_parser_runner.cjs` — run the JavaScript parser under Node and compare its output with the gdstk-backed Python model on generated layouts; also exercise malformed input.
- `tests/test_client_parsing.py` — asserts local parsing/preload wiring, script imports, and static asset endpoints; these source and endpoint checks do not verify browser rendering.
- `open_gds_viewer.sh` and `open_gds_viewer.bat` — convenience launchers.

Browser data flow:

1. The browser reads a selected/dropped file locally, or fetches CLI preload configuration and raw GDS bytes from the server.
2. `gds_parser.js` decodes the bytes, selects roots, and builds a hierarchy-aware, JSON-friendly view model.
3. All layers, templates, and groups are available locally; browser file loading and layer toggles do not call the deprecated upload or per-layer endpoints.
4. `gds_viewer.js` maps templates and transformed groups into PixiJS graphics and owns all interactive browser state.

Keep browser parsing and geometry semantics in `gds_parser.js`, independent of the DOM and PixiJS. Keep drawing, interaction, DOM state, and viewport behavior in `gds_viewer.js`. Maintain the Python model as the parity reference while it remains supported. If the shared view-model contract changes, update both builders, the renderer, parity tests, and affected endpoint/model assertions.

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

2. JavaScript change: run the syntax checks immediately:

   ```text
   node --check src/gdsviewer/gds_parser.js
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
   node --check src/gdsviewer/gds_parser.js
   node --check src/gdsviewer/gds_viewer.js
   ```

Record the current test count and results when running these gates. A previous baseline is not validation of the current checkout. Pytest includes Node-based parser parity tests as well as Python model, WSGI, and client-wiring tests.

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
- Treat every GDS file and filename as untrusted. Browser loads use the JavaScript parser; Python API calls and deprecated server uploads reach native-backed `gdstk` code. Parsing errors must become controlled browser or API errors rather than crashes where possible.
- Browser-selected/dropped files are buffered and parsed locally without being sent to or retained by the server. The browser currently has no explicit file-size limit; the server factory's limits do not apply to this flow or to raw CLI preload delivery.
- The deprecated upload endpoint trusts `CONTENT_LENGTH`, rejects bodies larger than 100 MiB by default, reads each accepted body into memory, writes a temporary file, parses the full layout, and builds an in-memory view model. The positive `create_gds_viewer_app` `max_upload_bytes` argument configures this API limit. Neither parser has polygon-count, hierarchy-expansion, repetition-count, time, or parsed-memory limits, so even small files can produce very large geometry. Do not expose the service to untrusted networks without adding and testing further limits.
- The deprecated in-process document store keeps at most eight documents by default, evicting the oldest after successful uploads exceed the positive `max_documents` limit. This bounds stored document count, not parsed memory or other Python caches; complex layouts can still exhaust memory.
- `max_depth` can limit hierarchy traversal, but it is not a complete resource-control mechanism; broad trees, repetitions, and large cells can still consume substantial CPU and memory.
- Temporary uploads must always be deleted, including parse-error paths. Never use a user-provided path directly for temporary storage.
- Return useful parse errors, but reconsider raw exception text before any non-local deployment because it may reveal implementation or filesystem details.
- Do not insert filenames, cell names, layer labels, query values, or error text as HTML. Continue using JSON encoding and DOM `textContent`.
- PixiJS is vendored locally. Upgrade it deliberately, and update the version, source URL, SHA256, size, and license record in `src/gdsviewer/vendor/VENDORED.md` when replacing the asset. Preserve offline rendering and verify the packaged asset is served correctly.
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
  node --check src/gdsviewer/gds_parser.js
  node --check src/gdsviewer/gds_viewer.js
  ```

- Browser-facing changes have a recorded manual smoke test covering load, rendering, visibility controls, navigation, measurements, grid, and scale bar. State the browser and any untested platform explicitly.
- Security and memory implications of upload, hierarchy, repetition, and document-store changes have been reviewed.

Before a release, also:

- Confirm the version and user-facing documentation are consistent.
- Re-run `uv sync` from the lockfile in a clean worktree, then rerun every automated gate.
- Test both an empty viewer with browser upload and a preloaded representative GDS file; include a multi-root or explicitly selected-cell case.
- Confirm package data includes `gds_viewer.html`, `gds_parser.js`, `gds_viewer.js`, and `vendor/pixi.min.js`, and smoke-test the installed console entry point rather than only the source checkout.
- Record the vendored PixiJS version, offline rendering support, and all known rendering or platform limitations in release notes.
- Do not commit, tag, publish, or push until the gates pass and the user gives explicit authorization for that action.
