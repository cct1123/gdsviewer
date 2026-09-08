# Vendored assets

## pixi.min.js

- Package: pixi.js
- Version: 8.20.0 (the version resolved by jsDelivr for the previous `pixi.js@8.x` CDN pin)
- Source URL: https://cdn.jsdelivr.net/npm/pixi.js@8.20.0/dist/pixi.min.js
- SHA256: `07cbe045435c2a487c2f28f9a3a9ee43069dbbec0c77585477bb6e63b5e125a8`
- Size: 818,297 bytes
- License: MIT; included in [PIXI-LICENSE.txt](PIXI-LICENSE.txt), from the
  [v8.20.0 source](https://raw.githubusercontent.com/pixijs/pixijs/v8.20.0/LICENSE).

Loaded from `index.html` via a relative path (`./vendor/pixi.min.js`).
The viewer does not contact jsDelivr at runtime.
The Git attributes preserve the upstream LF bytes without checkout conversion.
Upgrade deliberately: replace the file, re-record version/source/hash here, and rerun the gates.

## Liquid-glass adaptations

The viewer uses a focused adaptation, not the complete liquidGL DOM snapshot engine.

- Shader reference: [naughtyduk/liquidGL](https://github.com/naughtyduk/liquidGL),
  v2.0.2, commit `b79845de77299c3fad3f05c470997719d31fbc9c`.
- Reviewed upstream file:
  [scripts/liquidGL.js](https://github.com/naughtyduk/liquidGL/blob/b79845de77299c3fad3f05c470997719d31fbc9c/scripts/liquidGL.js).
- SHA256 of that upstream file:
  `0ef150fdf88b436a302b1dd4ee5ae12d75341818abafd9fb4b5ae1d0ae4e002c`.
- Adapted code: `../liquid_glass.js`. The bevel-dependent refraction and channel
  dispersion are adapted from liquidGL. The renderer, procedural background,
  squircle distance field, pointer lighting, event scheduling, and resource cleanup
  are local. It never samples the GDS canvas, captures DOM content, or loads textures.
- License: MIT, Copyright (c) NaughtyDuk; full notice in
  [LIQUIDGL-LICENSE.txt](LIQUIDGL-LICENSE.txt), copied from the pinned
  [package/LICENSE](https://github.com/naughtyduk/liquidGL/blob/b79845de77299c3fad3f05c470997719d31fbc9c/package/LICENSE).

The CSS surface and inset highlights in `../index.html` are adapted from
[kevinbism/liquid-glass-effect](https://github.com/kevinbism/liquid-glass-effect),
commit `493b710b41d817cbdc3b60808e87ce747d7916f6`,
[style.css](https://github.com/kevinbism/liquid-glass-effect/blob/493b710b41d817cbdc3b60808e87ce747d7916f6/style.css).
License: MIT, Copyright (c) 2025 Kevin Ramirez; full notice in
[LIQUID-GLASS-EFFECT-LICENSE.txt](LIQUID-GLASS-EFFECT-LICENSE.txt).
The upstream photograph and remote assets are not used.

Ship both notices with the viewer. These are adapted sources: do not replace the
local renderer with the upstream snapshot engine as an automatic dependency update.
