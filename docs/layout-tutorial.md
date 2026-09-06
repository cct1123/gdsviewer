# Reproduce the README illustration

The YZUDA layouts are documentation examples. The viewer opens your own files
through its normal picker or drag-and-drop controls.

1. Open `index.html` in a browser.
2. Select **Load GDS File** and choose `examples/yzuda/xor.gds2` from this repository.
3. Leave **Root cell** on **All top-level cells** and **Hierarchy depth** blank.
4. Select **Show All**, then **Fit View** to reproduce the layout below.

![XOR layout with all layers visible](viewer-xor.png)

Toggle a layer chip to inspect overlapping geometry, drag to pan, or scroll to zoom.
Select **Measure**, then click two points to place a ruler; press **m** to leave
measurement mode. **Fit View** returns to the full layout.

For other illustrations, load `inv.gds2`, `nand2.gds2`, or `1Kpolyg.gds` from the same
folder. The files are unchanged downloads from [YZUDA](https://www.yzuda.org/download/_GDSII_examples.html);
see [attribution and checksums](../examples/yzuda/README.md). The gate files contain
text elements the viewer does not render. These illustrations are not proof of
complete GDSII compatibility.
