from io import BytesIO
import gzip
import json

import numpy as np
import pytest

from gdsviewer import (
    PolygonRecord,
    build_gds_view_model,
    create_gds_viewer_app,
    extract_polygons,
    load_gds_cell,
)
from gdsviewer.viewer import PolygonRecord as PolygonRecordFromModel


def _call_wsgi_app(app, method: str, path: str, body: bytes = b"", extra_environ: dict[str, str] | None = None):
    status_holder: dict[str, object] = {}

    def start_response(status, headers):
        status_holder["status"] = status
        status_holder["headers"] = headers

    environ = {
        "REQUEST_METHOD": method,
        "PATH_INFO": path.split("?", 1)[0],
        "QUERY_STRING": path.split("?", 1)[1] if "?" in path else "",
        "CONTENT_LENGTH": str(len(body)),
        "wsgi.input": BytesIO(body),
    }
    if extra_environ:
        environ.update(extra_environ)
    response_body = b"".join(app(environ, start_response))
    return status_holder["status"], dict(status_holder["headers"]), response_body


def test_extract_polygons_keeps_cell_names_and_reference_transforms() -> None:
    import gdstk

    top = gdstk.Cell("TOP")
    child = gdstk.Cell("CHILD")

    top.add(gdstk.rectangle((0, 0), (2, 1), layer=1, datatype=0))
    child.add(gdstk.rectangle((0, 0), (1, 1), layer=7, datatype=3))
    top.add(gdstk.Reference(child, origin=(10, 5)))

    records = extract_polygons(top)

    assert len(records) == 2
    top_record = next(record for record in records if record.cell_name == "TOP")
    child_record = next(record for record in records if record.cell_name == "CHILD")

    assert top_record.layer == 1
    assert child_record.layer == 7
    np.testing.assert_allclose(child_record.points[0], np.array([10.0, 5.0]))


def test_gds_viewer_exports_polygon_record() -> None:
    assert PolygonRecord is PolygonRecordFromModel


def test_extract_polygons_includes_direct_paths() -> None:
    import gdstk

    cell = gdstk.Cell("PATHS")
    cell.add(gdstk.FlexPath([(0, 0), (5, 0)], 1, layer=4, datatype=2))

    records = extract_polygons(cell)

    assert len(records) == 1
    assert records[0].cell_name == "PATHS"
    assert records[0].layer == 4
    assert records[0].datatype == 2


def test_build_gds_view_model_groups_by_cell_and_layer() -> None:
    import gdstk

    cell = gdstk.Cell("TOP")
    child = gdstk.Cell("CHILD")
    cell.add(gdstk.rectangle((0, 0), (1, 1), layer=1, datatype=0))
    child.add(gdstk.rectangle((0, 0), (2, 1), layer=2, datatype=0))
    cell.add(gdstk.Reference(child, origin=(5, 0)))

    view_model = build_gds_view_model(cell)

    assert view_model["cellName"] == "TOP"
    assert len(view_model["groups"]) == 2
    assert len(view_model["templates"]) == 2
    labels = {(group["cellName"], group["layerKey"]) for group in view_model["groups"]}
    assert ("TOP", "L1/D0") in labels
    assert ("CHILD", "L2/D0") in labels
    assert all("templateId" in group for group in view_model["groups"])
    assert all("transform" in group for group in view_model["groups"])
    assert all("offset" in group for group in view_model["groups"])
    assert all("polygons" in template for template in view_model["templates"])
    assert sum(len(template["polygons"]) for template in view_model["templates"]) == 2
    assert all("polygon" in polygon for template in view_model["templates"] for polygon in template["polygons"])
    assert view_model["layers"] == [
        {
            "key": "L1/D0",
            "label": "L1/D0",
            "layer": 1,
            "datatype": 0,
            "cssColor": view_model["groups"][0]["cssColor"],
        },
        {
            "key": "L2/D0",
            "label": "L2/D0",
            "layer": 2,
            "datatype": 0,
            "cssColor": view_model["groups"][1]["cssColor"],
        },
    ]
    cells = {cell["name"]: cell for cell in view_model["cells"]}
    assert cells["TOP"]["children"] == ["CHILD"]
    assert cells["CHILD"]["children"] == []
    assert view_model["cellTree"]["roots"] == ["TOP"]


def test_build_gds_view_model_keeps_nested_cell_structure() -> None:
    import gdstk

    top = gdstk.Cell("TOP")
    child = gdstk.Cell("CHILD")
    grandchild = gdstk.Cell("GRANDCHILD")
    grandchild.add(gdstk.rectangle((0, 0), (1, 1), layer=9, datatype=0))
    child.add(gdstk.Reference(grandchild, origin=(1, 0)))
    top.add(gdstk.Reference(child, origin=(5, 0)))

    view_model = build_gds_view_model(top)

    cells_by_name = {cell["name"]: cell for cell in view_model["cells"]}

    assert cells_by_name["TOP"]["children"] == ["CHILD"]
    assert cells_by_name["CHILD"]["children"] == ["GRANDCHILD"]
    assert cells_by_name["GRANDCHILD"]["children"] == []
    assert view_model["cellTree"]["roots"] == ["TOP"]


def test_build_gds_view_model_deduplicates_repeated_cells_in_tree() -> None:
    import gdstk

    top = gdstk.Cell("TOP")
    child = gdstk.Cell("CHILD")
    grandchild = gdstk.Cell("GRANDCHILD")
    grandchild.add(gdstk.rectangle((0, 0), (1, 1), layer=3, datatype=0))
    child.add(gdstk.Reference(grandchild, origin=(0, 0)))
    top.add(gdstk.Reference(child, origin=(0, 0)))
    top.add(gdstk.Reference(child, origin=(10, 0)))

    view_model = build_gds_view_model(top)

    cells_by_name = {cell["name"]: cell for cell in view_model["cells"]}
    assert set(cells_by_name) == {"TOP", "CHILD", "GRANDCHILD"}
    assert cells_by_name["TOP"]["children"] == ["CHILD"]
    assert cells_by_name["CHILD"]["children"] == ["GRANDCHILD"]


def test_load_gds_cell_uses_single_top_level_cell(tmp_path) -> None:
    import gdstk

    cell = gdstk.Cell("TOP")
    cell.add(gdstk.rectangle((0, 0), (1, 1), layer=1, datatype=0))
    library = gdstk.Library()
    library.add(cell)
    path = tmp_path / "single_top.gds"
    library.write_gds(path)

    loaded = load_gds_cell(path)

    assert loaded.name == "TOP"


def test_load_gds_cell_requires_name_for_multiple_top_levels(tmp_path) -> None:
    import gdstk

    top_a = gdstk.Cell("TOP_A")
    top_b = gdstk.Cell("TOP_B")
    library = gdstk.Library()
    library.add(top_a, top_b)
    path = tmp_path / "multiple_top.gds"
    library.write_gds(path)

    with pytest.raises(ValueError, match="Multiple top-level cells"):
        load_gds_cell(path)

    assert load_gds_cell(path, cell_name="TOP_B").name == "TOP_B"


def test_load_gds_cell_prefers_top_name_and_ignores_metadata_top_level(tmp_path) -> None:
    import gdstk

    metadata = gdstk.Cell("$$$CONTEXT_INFO$$$")
    top = gdstk.Cell("TOP")
    library = gdstk.Library()
    library.add(metadata, top)
    path = tmp_path / "preferred_top.gds"
    library.write_gds(path)

    loaded = load_gds_cell(path)

    assert loaded.name == "TOP"


def test_viewer_app_serves_html_js_and_initial_data(tmp_path) -> None:
    import gdstk

    top = gdstk.Cell("FILE_TOP")
    top.add(gdstk.rectangle((0, 0), (2, 1), layer=5, datatype=0))
    library = gdstk.Library()
    library.add(top)
    path = tmp_path / "viewer_file.gds"
    library.write_gds(path)

    app = create_gds_viewer_app(initial_gds_path=path, initial_cell_name="FILE_TOP")

    status, headers, html_body = _call_wsgi_app(app, "GET", "/")
    assert status.startswith("200")
    assert headers["Content-Type"].startswith("text/html")
    html_text = html_body.decode("utf-8")
    assert "Load GDS File" in html_text
    assert "cell-name-input" not in html_text
    assert "layer-chip" in html_text
    assert "Measure" in html_text
    assert "Grid" in html_text
    assert "scale-bar" in html_text
    assert "Measurements" in html_text
    assert "pointer-status" in html_text
    assert "Drop .gds file to load" in html_text

    status, headers, js_body = _call_wsgi_app(app, "GET", "/gds_viewer.js")
    assert status.startswith("200")
    assert headers["Content-Type"].startswith("application/javascript")
    js_text = js_body.decode("utf-8")
    assert "setAllVisible" in js_text
    assert "updateScaleBar" in js_text
    assert "lockMeasuredPoint" in js_text
    assert "updateGridOverlay" in js_text
    assert "deleteSelectedMeasurement" in js_text
    assert "updateCursorOverlay" in js_text
    assert "updatePointerStatus" in js_text
    assert "zoomAtScreenPoint" in js_text
    assert 'event.key.toLowerCase() === "z"' in js_text
    assert 'event.key.toLowerCase() === "x"' in js_text
    assert "lastPointerScreen" in js_text
    assert "startKeyboardZoom" in js_text
    assert "tickKeyboardZoom" in js_text
    assert "loadGdsFile" in js_text
    assert 'stageNode?.addEventListener("drop"' in js_text

    status, _, json_body = _call_wsgi_app(app, "GET", "/api/initial-data")
    payload = json.loads(json_body)
    assert status.startswith("200")
    assert payload["view_model"]["cellName"] == "FILE_TOP"
    assert payload["initial_layer"]["layerKey"] == "L5/D0"


def test_viewer_app_loads_uploaded_gds(tmp_path) -> None:
    import gdstk

    top = gdstk.Cell("UPLOAD_TOP")
    top.add(gdstk.rectangle((0, 0), (2, 1), layer=8, datatype=1))
    library = gdstk.Library()
    library.add(top)
    path = tmp_path / "upload.gds"
    library.write_gds(path)

    app = create_gds_viewer_app()
    body = path.read_bytes()
    status, _, json_body = _call_wsgi_app(
        app,
        "POST",
        "/api/load-gds?filename=upload.gds&cell_name=UPLOAD_TOP",
        body=body,
    )

    payload = json.loads(json_body)
    assert status.startswith("200")
    assert payload["view_model"]["cellName"] == "UPLOAD_TOP"
    assert payload["view_model"]["title"] == "GDS Viewer: upload.gds"
    assert payload["view_model"]["documentId"].startswith("doc-")
    assert payload["initial_layer"]["groups"][0]["layerKey"] == "L8/D1"
    assert payload["initial_layer"]["groups"][0]["templateId"]
    assert payload["initial_layer"]["templates"][0]["polygons"]
    assert payload["view_model"]["layers"] == [
        {"key": "L8/D1", "label": "L8/D1", "layer": 8, "datatype": 1, "cssColor": payload["initial_layer"]["groups"][0]["cssColor"]}
    ]


def test_viewer_app_can_gzip_large_json_response(tmp_path) -> None:
    import gdstk

    top = gdstk.Cell("TOP")
    for index in range(5000):
        top.add(gdstk.rectangle((index, 0), (index + 0.5, 1), layer=1, datatype=0))
    library = gdstk.Library()
    library.add(top)
    path = tmp_path / "gzip_large.gds"
    library.write_gds(path)

    app = create_gds_viewer_app()
    status, headers, body = _call_wsgi_app(
        app,
        "POST",
        "/api/load-gds?filename=gzip_large.gds&cell_name=TOP",
        body=path.read_bytes(),
        extra_environ={"HTTP_ACCEPT_ENCODING": "gzip"},
    )

    assert status.startswith("200")
    assert headers["Content-Encoding"] == "gzip"
    payload = json.loads(gzip.decompress(body))
    assert payload["view_model"]["cellName"] == "TOP"
    assert payload["initial_layer"]["layerKey"] == "L1/D0"


def test_viewer_app_loads_multiple_top_levels_without_cell_name(tmp_path) -> None:
    import gdstk

    metadata = gdstk.Cell("$$$CONTEXT_INFO$$$")
    top_a = gdstk.Cell("ARRAY_A")
    top_b = gdstk.Cell("ARRAY_B")
    top_a.add(gdstk.rectangle((0, 0), (1, 1), layer=1, datatype=0))
    top_b.add(gdstk.rectangle((2, 0), (3, 1), layer=2, datatype=0))
    library = gdstk.Library()
    library.add(metadata, top_a, top_b)
    path = tmp_path / "multi_root.gds"
    library.write_gds(path)

    app = create_gds_viewer_app()
    status, _, json_body = _call_wsgi_app(
        app,
        "POST",
        "/api/load-gds?filename=multi_root.gds",
        body=path.read_bytes(),
    )

    payload = json.loads(json_body)
    assert status.startswith("200")
    assert {cell["name"] for cell in payload["view_model"]["cells"]} == {"ARRAY_A", "ARRAY_B"}
    assert payload["initial_layer"]["groups"]


def test_viewer_app_serves_layer_data_endpoint(tmp_path) -> None:
    import gdstk

    top = gdstk.Cell("TOP")
    top.add(gdstk.rectangle((0, 0), (1, 1), layer=1, datatype=0))
    top.add(gdstk.rectangle((2, 0), (3, 1), layer=2, datatype=0))
    library = gdstk.Library()
    library.add(top)
    path = tmp_path / "layer_data.gds"
    library.write_gds(path)

    app = create_gds_viewer_app()
    status, _, upload_body = _call_wsgi_app(
        app,
        "POST",
        "/api/load-gds?filename=layer_data.gds&cell_name=TOP",
        body=path.read_bytes(),
    )
    upload_payload = json.loads(upload_body)
    document_id = upload_payload["view_model"]["documentId"]

    status, _, layer_body = _call_wsgi_app(
        app,
        "GET",
        f"/api/layer-data?document_id={document_id}&layer_key=L2/D0",
    )
    layer_payload = json.loads(layer_body)

    assert status.startswith("200")
    assert layer_payload["layerKey"] == "L2/D0"
    assert len(layer_payload["groups"]) == 1
    assert layer_payload["templates"][0]["layerKey"] == "L2/D0"
