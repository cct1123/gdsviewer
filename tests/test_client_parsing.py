"""Tests for browser-side GDS parsing integration (migration slice 2)."""

from pathlib import Path

import gdstk
import pytest

from gdsviewer.viewer import _asset_text


def _write_simple_gds(path: Path) -> None:
    leaf = gdstk.Cell("LEAF")
    leaf.add(gdstk.rectangle((0, 0), (2, 1), layer=7, datatype=3))
    top = gdstk.Cell("TOP")
    top.add(gdstk.rectangle((-2, -1), (3, 2), layer=1, datatype=0))
    top.add(gdstk.Reference(leaf, origin=(1, 1)))
    library = gdstk.Library(name="CLIENT", unit=1e-6, precision=1e-9)
    library.add(top, leaf)
    library.write_gds(path)


def test_html_loads_parser_script() -> None:
    html_text = _asset_text("gds_viewer.html")

    # Relative path: the asset tree must work from any static host or file://.
    assert '<script src="./gds_parser.js"></script>' in html_text


def test_html_loads_vendored_pixi_locally() -> None:
    html_text = _asset_text("gds_viewer.html")

    # No CDN dependency: PixiJS is vendored and loaded via a relative path.
    assert "https://cdn.jsdelivr.net/" not in html_text
    assert '<script src="./vendor/pixi.min.js"></script>' in html_text
    assert _asset_text("vendor/pixi.min.js").startswith("var ")


def test_server_serves_parser_script(tmp_path: Path) -> None:
    _write_simple_gds(tmp_path / "client.gds")
    from gdsviewer.viewer import create_gds_viewer_app

    app = create_gds_viewer_app(initial_gds_path=tmp_path / "client.gds")

    captured = {}

    def start_response(status, headers):
        captured["status"] = status
        captured["headers"] = dict(headers)

    body = b"".join(app({"REQUEST_METHOD": "GET", "PATH_INFO": "/gds_parser.js", "QUERY_STRING": ""}, start_response))

    assert captured["status"] == "200 OK"
    assert captured["headers"]["Content-Type"] == "application/javascript; charset=utf-8"
    text = body.decode("utf-8")
    assert "parseGds" in text
    assert "buildGdsViewModel" in text


def test_server_serves_vendored_pixi() -> None:
    from gdsviewer.viewer import create_gds_viewer_app

    app = create_gds_viewer_app()

    captured = {}

    def start_response(status, headers):
        captured["status"] = status
        captured["headers"] = dict(headers)

    body = b"".join(app({"REQUEST_METHOD": "GET", "PATH_INFO": "/vendor/pixi.min.js", "QUERY_STRING": ""}, start_response))

    # The relative ./vendor/pixi.min.js script tag must resolve under the thin
    # Python server too, so the CLI preload flow keeps working offline.
    assert captured["status"] == "200 OK"
    assert len(body) > 100_000


def test_client_parses_uploads_locally_without_server_apis() -> None:
    js_text = _asset_text("gds_viewer.js")

    assert "GdsParser.parseGds" in js_text
    assert "GdsParser.buildGdsViewModel" in js_text
    assert '"/api/load-gds"' not in js_text


@pytest.mark.parametrize("marker", ["parseLocalGds", "file.arrayBuffer()"])
def test_client_local_load_helpers_exist(marker: str) -> None:
    assert marker in _asset_text("gds_viewer.js")


@pytest.mark.parametrize(
    "marker",
    [
        "/api/preload",
        "loadPreloadedGds",
        "parseArrayBufferGds",
    ],
)
def test_client_preload_bootstrap_exists(marker: str) -> None:
    assert marker in _asset_text("gds_viewer.js")


def test_client_no_longer_fetches_initial_or_layer_data() -> None:
    js_text = _asset_text("gds_viewer.js")

    assert '"/api/initial-data"' not in js_text
    assert '"/api/layer-data"' not in js_text
