# Visual design review

The interface takes its visual direction from [CT.Cheung Studio](https://ctcheung.studio/):
serif display typography, widely spaced small labels, restrained glass, and a
quiet geometric motif. The viewer uses local Georgia and system fonts to preserve
offline operation; it does not download the reference site's web fonts.

## Day and night

| Role | Day | Night |
| --- | --- | --- |
| Canvas | Ivory `#FBF9F6` | Charcoal `#101018` |
| Main text | Slate `#3D405B` | Warm white `#F7F3EE` |
| Secondary text | Olive `#6A7059` | Lavender gray `#AAAABB` |
| Display accent | Terracotta `#D48C70` | Pale terracotta `#E2B49F` |
| Borders | Stone `#DEDBD3` | Charcoal gray `#393744` |
| Grid | Sage `#849078` | Pale sage `#9BA68F` |
| Geometry outlines | Slate `#65677D` | Lavender `#B3B0C8` |
| Rulers | Brown `#9C5138` | Peach `#E4B39A` |

The top-right pill names the mode it switches to. The initial mode follows the
system setting unless the user has saved a choice. `viewer_theme.js` applies it
before styles paint and saves only the appearance preference. If browser storage
is blocked, the switch still works for the current page session.

The palette covers sidebar controls, the canvas, major/minor grids, rulers,
coordinates, scale bars, warnings, and the decorative glass renderer. Layer colors
remain consistent between modes; outlines and fill opacity adjust for contrast.
Shared geometry contexts repaint in place, preserving the view transform, hidden
cells/layers, hierarchy options, and measurements. The toggle works even if PixiJS
is unavailable.

The decorative motif appears only in the empty view. The glass renderer remains
bounded and event-driven, with reduced-motion and reduced-transparency support.
On screens up to 540 pixels wide, the independently scrolling controls sit above
the canvas so the drawing and toolbar retain useful width.

## Current captures

| Day mode | Night mode |
| --- | --- |
| <a href="images/day/02-layout-overview.jpg"><img src="images/day/02-layout-overview.jpg" alt="Day mode: Public YZUDA XOR layout, 520 visible polygons"></a> | <a href="images/night/02-layout-overview.jpg"><img src="images/night/02-layout-overview.jpg" alt="Night mode: Public YZUDA XOR layout, 520 visible polygons"></a> |

These unmodified browser JPEG captures show the public YZUDA XOR example in the
Codex in-app browser on Windows, served under `/viewer/` at 838 × 912 pixels.
The [picture guide](user-guide.md) includes paired illustrations and close-ups
for every tutorial step. See the [capture record](images/README.md) for source
hashes, exact crop rectangles, and observed UI values. No private layout was used.

## Validation

The following implementation checks passed for source commit `f0ffb63`, before
the documentation capture update. The [documentation validation record](yzuda-demo-validation.md)
lists the subsequent XOR walkthrough and image checks.

All five documented JavaScript syntax checks passed. All 29 Node tests passed with
the documented `--test-isolation=none` fallback after the sandbox blocked test
worker creation with `spawn EPERM`. The suite includes independent reference
geometry, root/subdirectory asset delivery, saved theme preferences, OS appearance
changes, invalid preferences, and blocked storage.

All 18 browser checks passed with the suite starting once in day mode and once in
night mode. The checks cover loading, visibility, hierarchy, navigation, rulers,
grids, errors, overlapping loads, resize at 850/620/390 pixels, reload cleanup, and
decorative WebGL fallback. Repeated theme changes preserve the layout canvas,
shared contexts, zoom, visibility, grid choice, and saved rulers.

Empty and loaded views were visually reviewed in both modes. A synthetic layout
was opened through the browser file-chooser API, and a ruler was created manually.
The narrow 390-pixel view was also visually checked in the browser harness.

Direct-file navigation was blocked by the browser tool's URL policy, so that route
was not revalidated. Native OS picker dialogs, other browser engines, macOS/Linux
launchers, and large-layout performance were not tested. The existing measurement
unit and resource-limit caveats in the [README](../README.md) still apply.
