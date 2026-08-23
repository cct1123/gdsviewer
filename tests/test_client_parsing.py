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

    assert '<script src="/gds_parser.js"></script>' in html_text


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


def test_client_parses_uploads_locally_without_server_apis() -> None:
    js_text = _asset_text("gds_viewer.js")

    assert "GdsParser.parseGds" in js_text
    assert "GdsParser.buildGdsViewModel" in js_text
    assert '"/api/load-gds"' not in js_text


@pytest.mark.parametrize("marker", ["parseLocalGds", "file.arrayBuffer()"])
def test_client_local_load_helpers_exist(marker: str) -> None:
    assert marker in _asset_text("gds_viewer.js")
