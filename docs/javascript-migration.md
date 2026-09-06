# Client-side migration plan

## Current Python responsibilities

`src/gdsviewer/viewer.py` retains the Python API/reference model and serves the browser.
Its parsing/model code is used by Python callers, parity tests, and the deprecated
upload API; normal browser file loading and CLI preloading use `gds_parser.js` instead.

1. GDSII input: `gdstk.read_gds` reads a library, `_visible_top_level_cells` filters metadata-like `$$$` roots, and `_select_gds_source` handles explicit cell selection.
2. Geometry semantics: direct polygons and paths are collected, paths are converted to polygons, and references are expanded through rotation, magnification, x-reflection, and repetition offsets.
3. View-model construction: cell templates are grouped by `(cell, layer, datatype)`, instances retain affine transforms, the cell tree and layer colors are built, and transformed layout bounds are calculated. Coordinates are rounded only at the JSON boundary.
4. Delivery: a WSGI application serves static assets, preload configuration, and raw preloaded bytes. The deprecated `POST /api/load-gds` endpoint still accepts uploads and stores parsed models; `GET /api/layer-data` still serves their layer-scoped geometry. The store defaults to eight documents with oldest-first eviction. The browser does not use either endpoint. `/api/initial-data` has been removed.

PixiJS already owns rendering and interaction in `gds_viewer.js`: reusable graphics contexts, layer and cell visibility, pan/zoom/fit, measurements, snapping, grid, pointer coordinates, and scale bar. That rendering boundary should remain intact.

## Browser architecture and remaining migration

The browser reads a selected/dropped `File` as an `ArrayBuffer`. The dependency-free `gds_parser.js` module decodes GDSII records into a library model, converts supported paths to polygons, selects roots, traverses hierarchy, and emits the PixiJS view-model contract. Parsing/model construction must not depend on the DOM or PixiJS. The renderer consumes the resulting templates, groups, layers, cell tree, and bounds locally without fetching per-layer geometry.

For the browser, Python supplies static assets, the optional launcher, and CLI preload configuration/raw bytes. A later slice can remove the deprecated upload/layer-data endpoints and document store, decide the future of the Python API/reference model, and remove gdstk/NumPy from runtime dependencies. PixiJS is already vendored at `src/gdsviewer/vendor/pixi.min.js`, so rendering has no runtime CDN dependency; its provenance and update procedure are recorded in `src/gdsviewer/vendor/VENDORED.md`. A fully static distribution remains a later step.

Browser-local file loading has no explicit file-size limit and does not send selected files to the server. The deprecated upload API defaults to a 100 MiB request limit and eight stored documents, configurable through the positive `max_upload_bytes` and `max_documents` factory arguments. These limits do not apply to browser-local loading or CLI preload delivery and do not bound parsed memory.

The pure-JavaScript parser is deliberately scoped to records needed by the current rendering contract: library units, structures, boundaries, paths, SREF/AREF references, layers/datatypes, coordinates, path width/end style, and reference transforms. Unsupported element types may be skipped, but malformed record framing and unsupported path geometry must fail clearly rather than render misleading geometry.

## Incremental slices

1. Parser and parity harness (done): add a standalone browser/Node-compatible GDSII record parser and JavaScript view-model builder. Generate fixtures with gdstk, run the JavaScript parser under Node, and compare cells, hierarchy, transforms, repeated instances, path polygons, layer metadata, and bounds with the existing Python view model.
2. Browser integration (done): selected/dropped `.gds` files are read as an `ArrayBuffer` and parsed entirely in the browser by `gds_parser.js`; file loading no longer calls `/api/load-gds`, and all layers/groups/templates are present locally instead of fetched per layer. CLI-preloaded layouts use `GET /api/preload` plus `GET /api/preloaded-gds`; the browser downloads the raw bytes, parses them with `gds_parser.js`, and builds the full local view model. `/api/initial-data` is removed. `/api/load-gds`, `/api/layer-data`, and the document store remain for compatibility until the next slice. Browser behavior still needs a manual smoke test (load, visibility, navigation, measurements, grid, scale bar, resize, errors); the automated suite covers parser/model parity, endpoint contracts, and client wiring, not browser rendering.
3. Static-server reduction (next): remove the upload and layer-data endpoints and document store. Decide the future of the Python API and parity reference before removing gdstk/NumPy runtime dependencies. Serve HTML, CSS/embedded styling, parser JavaScript, renderer JavaScript, vendored PixiJS, and optional preload configuration/raw bytes. Decide and document whether CLI preloading/cell selection remains as browser startup configuration or is removed.
4. Static distribution: make the asset directory usable with a generic static server or direct hosting. Preserve the vendored PixiJS asset and offline rendering, and update packaging, launchers, documentation, and release tests.

## Original slice 1 scope and ongoing risks

Slice 1 added the parser and parity harness without changing browser upload behavior, Python APIs, WSGI endpoints, or PixiJS rendering; slice 2 subsequently changed browser loading and preload delivery. Neither slice added an npm dependency or build step. The parity harness invokes Node.js from pytest, so Node is required for the automated suite as well as syntax checks. Parity fixtures cover the current viewer's supported geometry, but they are not proof of full GDSII compatibility. In particular, arbitrary curved/multi-segment path joins, text, boxes, nodes, properties, uncommon repetition encodings, and vendor extensions remain provisional until explicitly implemented and tested.

Binary parsing must use big-endian record lengths/types and GDSII IBM-style real numbers. Database coordinates must be scaled into the library user units before model construction. Binary record parsing failures include byte offsets to help diagnose malformed files in browser errors.
