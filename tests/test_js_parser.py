import json
import math
from pathlib import Path
import subprocess

import pytest

from gdsviewer import load_gds_view_model


RUNNER = Path(__file__).with_name("js_parser_runner.cjs")


def _run_parser(command: str, path: Path, options: dict[str, object] | None = None) -> dict[str, object]:
    result = subprocess.run(
        ["node", str(RUNNER), command, str(path), json.dumps(options or {})],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def _write_parity_gds(path: Path) -> None:
    import gdstk

    leaf = gdstk.Cell("LEAF")
    leaf.add(gdstk.rectangle((0, 0), (2, 1), layer=7, datatype=3))
    leaf.add(gdstk.FlexPath([(0, 3), (4, 3)], 1, layer=4, datatype=2, simple_path=True))

    child = gdstk.Cell("CHILD")
    child.add(
        gdstk.Reference(
            leaf,
            origin=(1, 2),
            rotation=math.pi / 2,
            magnification=2,
            x_reflection=True,
        )
    )

    top = gdstk.Cell("TOP")
    top.add(gdstk.rectangle((-2, -1), (3, 2), layer=1, datatype=0))
    top.add(gdstk.Reference(child, origin=(10, 5), columns=2, rows=2, spacing=(20, 10)))

    metadata = gdstk.Cell("$$$CONTEXT_INFO$$$")
    library = gdstk.Library(name="PARITY", unit=1e-6, precision=1e-9)
    library.add(metadata, leaf, child, top)
    library.write_gds(path)


def _canonical_model(model: dict[str, object]) -> dict[str, object]:
    templates = []
    for template in model["templates"]:
        polygons = []
        for item in template["polygons"]:
            points = list(zip(item["polygon"][::2], item["polygon"][1::2], strict=True))
            polygons.append(sorted((round(x, 3), round(y, 3)) for x, y in points))
        templates.append(
            {
                "id": template["id"],
                "cellName": template["cellName"],
                "layer": template["layer"],
                "datatype": template["datatype"],
                "layerKey": template["layerKey"],
                "cssColor": template["cssColor"],
                "polygonCount": template["polygonCount"],
                "polygons": sorted(polygons),
            }
        )
    groups = [
        {
            key: ([round(value, 9) for value in group[key]] if key in {"transform", "offset"} else group[key])
            for key in (
                "id",
                "cellId",
                "cellName",
                "layer",
                "datatype",
                "layerKey",
                "cssColor",
                "count",
                "templateId",
                "transform",
                "offset",
            )
        }
        for group in model["groups"]
    ]
    return {
        "title": model["title"],
        "cellName": model["cellName"],
        "bounds": model["bounds"],
        "cellTree": model["cellTree"],
        "layers": [
            {key: layer[key] for key in ("key", "label", "layer", "datatype", "cssColor")}
            for layer in model["layers"]
        ],
        "groups": groups,
        "templates": templates,
    }


def test_javascript_parser_reads_library_records(tmp_path: Path) -> None:
    path = tmp_path / "parity.gds"
    _write_parity_gds(path)

    library = _run_parser("parse", path)

    assert library["name"] == "PARITY"
    assert library["unit"] == pytest.approx(1e-6)
    assert library["precision"] == pytest.approx(1e-9)
    cells = {cell["name"]: cell for cell in library["cells"]}
    assert set(cells) == {"$$$CONTEXT_INFO$$$", "LEAF", "CHILD", "TOP"}
    assert {(polygon["layer"], polygon["datatype"]) for polygon in cells["LEAF"]["polygons"]} == {(7, 3)}
    assert {(path["layer"], path["datatype"]) for path in cells["LEAF"]["paths"]} == {(4, 2)}
    assert cells["CHILD"]["references"][0]["cellName"] == "LEAF"
    assert cells["TOP"]["references"][0]["columns"] == 2
    assert cells["TOP"]["references"][0]["rows"] == 2


def test_javascript_view_model_matches_python_gdstk_model(tmp_path: Path) -> None:
    path = tmp_path / "parity.gds"
    _write_parity_gds(path)

    python_model = load_gds_view_model(path, title="Parity")
    javascript_model = _run_parser("view-model", path, {"title": "Parity"})

    assert _canonical_model(javascript_model) == _canonical_model(python_model)


def test_javascript_parser_rejects_malformed_record(tmp_path: Path) -> None:
    path = tmp_path / "malformed.gds"
    path.write_bytes(b"\x00\x06\x00\x02\x00")

    result = subprocess.run(
        ["node", str(RUNNER), "parse", str(path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode != 0
    assert "GDSII record at byte 0 extends beyond the input" in result.stderr
