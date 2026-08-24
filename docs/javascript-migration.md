# Client-side migration plan

## Current Python responsibilities

`src/gdsviewer/viewer.py` currently combines four distinct concerns:

1. GDSII input: `gdstk.read_gds` reads a library, `_visible_top_level_cells` filters metadata-like `$$$` roots, and `_select_gds_source` handles explicit cell selection.
2. Geometry semantics: direct polygons and paths are collected, paths are converted to polygons, and references are expanded through rotation, magnification, x-reflection, and repetition offsets.
3. View-model construction: cell templates are grouped by `(cell, layer, datatype)`, instances retain affine transforms, the cell tree and layer colors are built, and transformed layout bounds are calculated. Coordinates are rounded only at the JSON boundary.
4. Delivery: a WSGI application serves static assets, accepts uploaded bytes, retains parsed documents, and returns metadata plus layer-scoped geometry payloads.

PixiJS already owns rendering and interaction in `gds_viewer.js`: reusable graphics contexts, layer and cell visibility, pan/zoom/fit, measurements, snapping, grid, pointer coordinates, and scale bar. That rendering boundary should remain intact.

## Target architecture

The browser will read an uploaded `File` as an `ArrayBuffer`. A dependency-free `gds_parser.js` module will decode GDSII records into a library model, convert supported paths to polygons, select roots, traverse hierarchy, and emit the existing PixiJS view-model contract. Parsing/model construction must not depend on the DOM or PixiJS. The renderer will consume the same templates, groups, layers, cell tree, and bounds it consumes today.

During migration, Python remains only as a static-file server and optional launcher. Once browser loading no longer calls data APIs, a later slice can remove upload/document endpoints and gdstk, and can add a fully static distribution. PixiJS is still loaded from jsDelivr, so the viewer is not fully offline until that asset is pinned or vendored.

The pure-JavaScript parser is deliberately scoped to records needed by the current rendering contract: library units, structures, boundaries, paths, SREF/AREF references, layers/datatypes, coordinates, path width/end style, and reference transforms. Unsupported element types may be skipped, but malformed record framing and unsupported path geometry must fail clearly rather than render misleading geometry.

## Incremental slices

1. Parser and parity harness (done): add a standalone browser/Node-compatible GDSII record parser and JavaScript view-model builder. Generate fixtures with gdstk, run the JavaScript parser under Node, and compare cells, hierarchy, transforms, repeated instances, path polygons, layer metadata, and bounds with the existing Python view model.
2. Browser integration (done): uploaded `.gds` files are read as an `ArrayBuffer` and parsed entirely in the browser by `gds_parser.js`; uploads no longer hit `/api/load-gds`, and all layers/groups/templates are present locally instead of fetched per layer. CLI-preloaded layouts are also handled client-side now: the server exposes only a small preload configuration (`GET /api/preload`) plus the raw bytes (`GET /api/preloaded-gds`), the browser downloads those bytes, parses them with `gds_parser.js`, and builds the full local view model. The Python-side parsing/document-store endpoints (`/api/initial-data`, `/api/layer-data`) are gone; the upload endpoint remains until the next slice. Browser behavior still needs a manual smoke test (load, visibility, navigation, measurements, grid, scale bar, resize, errors); the automated suite covers endpoint contracts and client wiring only.
3. Static-server reduction (next): remove the upload endpoint, document store, and gdstk/NumPy runtime dependencies; serve only HTML, CSS/embedded styling, parser JavaScript, renderer JavaScript, and the optional preloaded file bytes. Decide and document whether CLI preloading/cell selection remains as browser startup configuration or is removed.
4. Static distribution: make the asset directory usable with a generic static server or direct hosting. Resolve the external PixiJS dependency if reproducible offline use is required, and update packaging, launchers, documentation, and release tests.

## Slice 1 boundaries and risks

This slice does not alter browser upload behavior, Python APIs, WSGI endpoints, or PixiJS rendering. It adds no npm dependency or build step. Parity fixtures cover the current viewer's supported geometry, but they are not proof of full GDSII compatibility. In particular, arbitrary curved/multi-segment path joins, text, boxes, nodes, properties, uncommon repetition encodings, and vendor extensions remain provisional until explicitly implemented and tested.

Binary parsing must use big-endian record lengths/types and GDSII IBM-style real numbers. Database coordinates must be scaled into the library user units before model construction. Parser failures include byte offsets so malformed uploads can later produce actionable browser errors.
