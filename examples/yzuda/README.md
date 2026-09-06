# YZUDA demonstration layouts

Downloaded on 2026-09-06 from [GDSII Layout Examples](https://www.yzuda.org/download/_GDSII_examples.html).
These third-party example layouts are attributed to YZUDA; the viewer's MIT license
does not relicense them. The source page supplies no explicit license statement.

| Example | Original download | Local file |
| --- | --- | --- |
| Inverter | [inv.gds2](https://www.yzuda.org/download/_GDSII_examples/inv.gds2) | `inv.gds2` |
| NAND gate | [nand2.gds2](https://www.yzuda.org/download/_GDSII_examples/nand2.gds2) | `nand2.gds2` |
| XOR gate | [xor.gds2](https://www.yzuda.org/download/_GDSII_examples/xor.gds2) | `xor.gds2` |
| Random layout, 1,000 polygons | [1Kpolyg.zip](https://www.yzuda.org/download/_GDSII_examples/1Kpolyg.zip) | `1Kpolyg.gds` extracted from ZIP |

The GDS bytes are unchanged, including zero padding after ENDLIB in the gate files.
The NAND and XOR downloads both name their root `abc2`; the labels above follow the
source page. These files are demo inputs, not independent geometry reference models.
Text labels are skipped by the viewer; the screenshot shows supported geometry.

`demo-data.js` contains the same bytes encoded as base64 so **Load example** works
without fetching files, including when opening the viewer locally. Regenerate it
after deliberately replacing source files with `node examples/yzuda/build-demo.cjs`.

SHA256:

```text
1Kpolyg.gds  a67e6202f6310db4e9125dc5d321c0ee8eabf571d39d74a18e9e5929db92a9bb
inv.gds2    640772dfbb6f844de15cdc0e354fa93621a6a74630d7d8aea07ec687d20569c8
nand2.gds2  00f07747700c09688eeb4667e0026dd3cd2e41cfba250c6c3ba3e6cc6b060c53
xor.gds2    50a0e3919d4e780ef4783428489f5aec96f88cf91609a58a19752564820a2b79
```
