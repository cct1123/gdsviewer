# AGENTS.md

## Objective

Make local GDSII inspection dependable: correct supported geometry and units,
consistent hierarchy controls, responsive navigation, and useful errors. Keep files
in the browser and the viewer usable without installation, a build, or a backend.
Prioritize correctness and usability over more formats or infrastructure.

## Workflow

Read [README.md](README.md) and the affected code. Use one agent to inspect,
implement, verify, and report ordinary changes. Keep plans proportional to the task;
proceed within the user's authorized scope without a separate plan-approval gate.

Use an isolated Git worktree for changes intended for commit. Keep the diff focused
and leave unrelated work, local environments, caches, and release archives alone.
Commit, merge, tag, push, and publish each require explicit user authorization.

## Architecture

- `gds_parser.js`: byte decoding and hierarchy-aware models; no DOM or PixiJS.
- `gds_viewer.js`: local file/example loading, rendering, controls, and interaction.
- `index.html`: layout, styles, and relative classic scripts.
- `vendor/`: pinned PixiJS; follow [VENDORED.md](vendor/VENDORED.md) for updates.
- `examples/yzuda/`: attributed demos; follow its [README](examples/yzuda/README.md).
  Regenerate `demo-data.js` with `node examples/yzuda/build-demo.cjs`; never hand-edit it.
- `tests/`: Node tests, independent fixtures, and a real-browser harness.
  `tests/serve.cjs` is a loopback-only development helper.
- `open_gds_viewer.bat` / `.sh`: open the static page in the default browser.

Keep plain JavaScript, vendored assets, and Node's built-in test runner. Introduce
an abstraction or dependency only for a demonstrated need. Preserve static hosting
and direct-file compatibility: local assets, relative classic scripts, and no
required fetches, API, module imports, runtime installation, or build step.

## Implementation

- Use two-space indentation, semicolons, `const` by default, and `let` for reassignment.
- Keep source, model, and screen coordinates distinct; account for physical units
  explicitly and round only at the model boundary. Preserve separate layer/datatype
  keys (`L<layer>/D<datatype>`), reusable cell templates, and instance transforms.
- Treat layouts as untrusted. Use `textContent` for names and errors; do not upload,
  persist, or log source layouts. Validate supported records and state unsupported
  behavior honestly. Keep geometry claims bounded by tests.
- Reject stale file reads. Keep the displayed geometry, library, and controls paired
  across reloads and failures. Remove old instances before destroying shared contexts.
- Guard startup, dependency failures, empty views, and resize. Preserve typing in
  input/select controls and check affected navigation and measurement interactions.
- Consider growth from references, arrays, snapping, and reloads. Depth is not a
  memory/time budget; the viewer has no comprehensive resource limits.

## Validation and handoff

Use the commands in README. Start with the narrowest relevant check, diagnose
failures, and never weaken assertions to pass. Run the documented syntax checks
and Node suite for code changes; verify facts and links for documentation changes.

- Parser/model: add focused regressions and run the independent reference suite.
  Preserve [fixture provenance](tests/fixtures/README.md); never derive expected
  geometry from the parser under test. Cover relevant units, malformed inputs,
  roots, transforms, repetitions, shared references, cycles, bounds, and depth.
- Viewer/HTML: run the browser harness and visually check affected interactions,
  including loading, visibility, navigation, measurements, overlays, resize, and
  reload cleanup. Use non-confidential synthetic fixtures; demo files are not
  independent reference models. Check root/subdirectory hosting for asset changes.
- Performance: measure representative layouts and reloads; small smoke tests do
  not establish responsiveness or a hard memory bound.
- Launchers/releases: test the actual OS/browser and extracted distribution,
  including offline demos, notices, attribution, and LICENSE. Follow README's
  distribution list. Report untested platforms and policy blocks without bypassing them.

Report what changed, why, validation results, unresolved findings, and worktree
status. Distinguish completed work from proposals and unperformed checks.
