# Independent geometry fixtures

These small layouts contain synthetic test geometry only. They were saved before
removing the Python reference implementation at commit 083d771, using gdstk 0.9.62.
The exact interpreter version, scenario options, and SHA256 hashes of every GDS file
and expected JSON model are recorded in manifest.json. No Python execution is needed
by the current tests or by the viewer.

JSON exports use LF line endings for portable checkouts. The manifest's sha256 values
describe these distributed bytes; originalJsonSha256 preserves the original Windows
CRLF export hashes. Restoring CRLF reproduced every original hash before updating
the manifest. No reference geometry or model values changed.

- hierarchy.gds: the former tests/test_js_parser.py parity fixture: TOP, CHILD, LEAF,
  and an empty $$$CONTEXT_INFO$$$ cell. Rectangles on L1/D0 and L7/D3, a straight
  flush path on L4/D2, a rotated/reflected/magnified nested reference, and a 2-by-2
  reference array. Snapshots cover all roots, TOP, LEAF, and depths 0, 1, and 2.
- roots.gds: independent A and B roots and empty metadata. A is the rectangle from
  (0, 0) to (2, 1), L1/D0; B is the triangle (10, 0), (13, 0), (11, 3), L1/D2.
  Snapshots cover the combined library and each selected root.
- paths.gds: three width-1 horizontal paths from x=0 to x=5 at y=0, 3, and 6 on
  L4/D0, L4/D1, and L4/D2. End styles are flush, square, and explicit extensions
  (0.25 at the start and 0.75 at the end). An L9/D0 concave polygon has vertices
  (0,10), (4,10), (4,11), (1,11), (1,14), (0,14).
- empty-cell.gds: one empty structure, EMPTY, with a reference model for its empty view.
- empty-library.gds: no structures; used to assert the controlled no-cells error.
- round-path.gds: a width-1 round-ended horizontal path from (0,0) to (5,0), used
  to preserve the explicit unsupported-path error.

The eleven JSON files are complete outputs from load_gds_view_model, with the title
and cell/depth options listed in manifest.json. New tests should derive expected
geometry independently. Do not regenerate expectations from gds_parser.js merely to
make a failing comparison pass. The comparator removes only 1e-9 numeric noise,
polygon start/winding differences, and exact collinear splits; it retains polygon
connectivity and concavity.
