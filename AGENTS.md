# AGENTS.md

## Project overview

`gdsviewer` is a standalone browser viewer for GDSII layout files. `gds_parser.js`
parses selected files and builds a hierarchy-aware view model without DOM or PixiJS
access. `gds_viewer.js` owns drawing and interaction. `index.html` loads both scripts
and vendored PixiJS through relative classic script tags. There is no Python runtime,
package, backend API, document store, CDN dependency, or build step.

Keep the supported geometry claims bounded by tests. The current reference fixtures
cover polygons, straight supported paths, nested/transformed references, rectangular
arrays, layer/datatype separation, multiple roots, bounds, and depth limits. They are
not proof of complete GDSII compatibility; see README.md for limitations.

## Working rules

- Read this file and README.md before changing code.
- Use an isolated Git worktree for changes intended for commit.
- Keep the project small: plain browser JavaScript, vendored PixiJS, and Node's built-in
  test runner. Do not introduce a framework, bundler, or package manager without need.
- Do not hand-edit environments, caches, generated metadata, or distribution artifacts.
  Legacy local Python environments may still exist in older checkouts; leave them alone.
- Do not commit, merge, tag, publish, or push without explicit user authorization for that action.

## Architecture

- `index.html`: layout, styles, controls, and relative script imports.
- `gds_parser.js`: browser/Node GDSII record parsing, path conversion, root selection,
  hierarchy transforms/repetitions, templates, groups, layers, bounds, and depth limits.
- `gds_viewer.js`: local file reading, view options, reusable Pixi graphics, visibility,
  pan/zoom/fit, measurements, grid, pointer readout, and scale bar. Serializes rendering
  and rejects stale file reads; releases old graphics when replacing the view.
- `vendor/`: the pinned PixiJS asset and provenance/license notices.
- `examples/yzuda/`: attributed layouts for README illustrations and documentation only.
- `tests/parser.test.cjs`: compares the JavaScript model against saved independent
  reference fixtures and checks malformed inputs and unsupported paths.
- `tests/static.test.cjs`: distribution structure, absence of backend calls, and static
  asset delivery. This is not a substitute for browser rendering checks.
- `tests/browser.html` and `tests/browser-smoke.js`: dependency-free browser harness
  using synthetic layouts and the real renderer through DOM events.
- `tests/serve.cjs`: optional Node static test server with a fixed asset allowlist and
  loopback binding. It exposes no application API and is not shipped as a runtime dependency.
- `tests/fixtures/`: small GDS files, saved reference JSON, hashes, and provenance.
- `open_gds_viewer.bat` / `open_gds_viewer.sh`: open index.html with the default browser.

## Implementation rules

- Use two-space indentation, semicolons, `const` by default, and `let` for reassignment.
- Keep parsing/model logic independent of the DOM and PixiJS. Preserve the boundary
  between source coordinates, model coordinates, and screen coordinates.
- Preserve layer and datatype separately, using `L<layer>/D<datatype>` keys.
- Reuse per-cell templates and instance transforms; avoid indiscriminate flattening.
- Keep serialization rounding at the model boundary, not early during decoding.
- Use `textContent` for filenames, cell names, labels, and error messages.
- Guard startup, empty views, dependency failures, reloads, and resize. Only the latest
  selected file may replace the view; controls must correspond to the displayed library.
- Destroy replaced graphics and shared contexts after their instances are removed.
- Keep keyboard shortcuts from intercepting typing in input/select controls.
- Preserve direct-file compatibility: relative classic scripts, no required fetch calls,
  no API probes, and no module import or backend requirement at startup.
- Do not claim direct file opening works on a browser/platform until tested there.

## Validation

Run the narrowest relevant check first. Stop on failures, diagnose, and rerun the
failing check. Do not weaken tests simply to clear a gate.

```text
node --check gds_parser.js
node --check gds_viewer.js
node --check tests/browser-smoke.js
node --test tests/*.test.cjs
```

Record current results; old test counts do not validate a new checkout. A sandbox may
block Node's test-process spawning; in that case run outside the sandbox if allowed,
or use `node --test --test-isolation=none tests/*.test.cjs` on a supporting Node version
and report the alternate invocation. No Python or npm package is required.

- Parser/model changes: cover malformed and empty inputs, missing cell names, multiple
  roots, metadata-like roots, supported paths, nested/repeated references, transforms,
  layer/datatype separation, bounds, and depth limits. Keep unsupported cases explicit.
- Preserve independently derived expected geometry. Never regenerate expectations
  from the parser under test solely to make a failure disappear. Polygon comparisons
  may normalize winding, start vertex, and exact collinear splits, not connectivity.
- Browser changes: run `node tests/serve.cjs`, open the printed Browser checks URL,
  and run the harness. Also visually inspect real rendering and test the native picker,
  visibility, navigation, measurements, grid, scale bar, pointer status, and resize.
  Test static hosting under a subdirectory as well as the root.
- Direct-file support: test opening index.html with no server where tooling permits.
  If browser policy blocks file URLs, report this explicitly; do not bypass the policy.
- Performance changes: test many polygons, layers, repeated references, and hierarchy.
  Check repeated file loading and release of old graphics. Do not infer a hard memory
  bound from a small smoke test.
- Launcher changes: test on the target OS. Report untested platforms and do not infer
  macOS/Linux behavior from Windows. A syntax check is not a launcher smoke test.

## Security and resource limits

Files are untrusted and stay in browser memory. There is no upload service or retained
server document store. The renderer has no explicit byte-size, polygon-count,
hierarchy-expansion, repetition-count, time, or parsed-memory limits; a small file may
expand into a large layout. Depth is a traversal option, not a complete resource limit.
Malformed/unsupported geometry must produce useful errors where implemented. Do not
log source layouts or geometry. Avoid inserting user text as HTML.

Keep test servers bound to loopback. Use only non-confidential synthetic fixtures in
browser tests. PixiJS remains vendored: when replacing it, record version, source URL,
SHA256, size, and license in vendor/VENDORED.md and rerun applicable checks.

## Commit and release gates

Before committing:

- Use an isolated worktree and review the complete diff for intended changes only.
- Include no local environments, caches, temporary test helpers, or distribution archives.
  The documented reference fixtures are intentional test data.
- Keep documentation and commands aligned with actual behavior. Run the automated
  gates and applicable browser/launcher checks, recording failures and tool/platform limits.
- Review resource implications of parser, traversal, repetition, and reload changes.
- Obtain explicit user authorization for the commit; authorization for implementing a
  change alone is not authorization to commit or release it.

Before releasing, also test the actual extracted distribution. It must contain
index.html, gds_parser.js, gds_viewer.js, vendor/pixi.min.js, required notices, and LICENSE.
Verify root/subdirectory hosting, offline assets, local file loading, and supported
launchers on the claimed platforms. No Python, uv, Node, backend API, or CDN may be
required to use the viewer. Document any unverified direct-file or platform behavior.
Do not publish, tag, or push without explicit authorization.
