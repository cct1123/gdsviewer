from __future__ import annotations
import gzip
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Iterable
from urllib.parse import parse_qs
from uuid import uuid4
from wsgiref.simple_server import make_server

import numpy as np


DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024
DEFAULT_MAX_DOCUMENTS = 8


@dataclass(frozen=True)
class PolygonRecord:
    cell_id: str
    cell_name: str
    parent_cell_id: str | None
    depth: int
    layer: int
    datatype: int
    points: np.ndarray


def _reference_linear_transform(reference) -> np.ndarray:
    rotation = float(reference.rotation or 0.0)
    magnification = float(reference.magnification or 1.0)
    rotation_matrix = np.array(
        [
            [np.cos(rotation), -np.sin(rotation)],
            [np.sin(rotation), np.cos(rotation)],
        ],
        dtype=float,
    )
    if reference.x_reflection:
        rotation_matrix = rotation_matrix @ np.array([[1.0, 0.0], [0.0, -1.0]], dtype=float)
    return magnification * rotation_matrix


def _path_polygons(cell) -> Iterable:
    for path in getattr(cell, "paths", ()):
        yield from path.to_polygons()


def _iter_cell_polygons(cell) -> Iterable:
    yield from getattr(cell, "polygons", ())
    yield from _path_polygons(cell)


def _reference_target_cell(reference):
    target = getattr(reference, "cell", None)
    return target if hasattr(target, "name") else None


def _polygon_records_for_cell(
    cell,
    *,
    cell_id: str,
    parent_cell_id: str | None,
    depth: int,
    transform: np.ndarray,
    offset: np.ndarray,
) -> list[PolygonRecord]:
    records: list[PolygonRecord] = []
    for polygon in _iter_cell_polygons(cell):
        points = np.asarray(polygon.points, dtype=float)
        records.append(
            PolygonRecord(
                cell_id=cell_id,
                cell_name=cell.name,
                parent_cell_id=parent_cell_id,
                depth=depth,
                layer=int(polygon.layer),
                datatype=int(polygon.datatype),
                points=points @ transform.T + offset,
            )
        )
    return records


def _tree_roots(source) -> list[tuple[str, object]]:
    if isinstance(source, Iterable) and not hasattr(source, "references"):
        return [(f"root:{index}", cell) for index, cell in enumerate(source)]
    return [("root:0", source)]


def _visible_top_level_cells(library) -> list:
    top_level_cells = list(library.top_level())
    design_cells = [cell for cell in top_level_cells if not cell.name.startswith("$$$")]
    return design_cells or top_level_cells


def _select_gds_source(library, *, cell_name: str | None = None):
    if cell_name is not None:
        for cell in library.cells:
            if cell.name == cell_name:
                return cell
        available_cells = ", ".join(sorted(cell.name for cell in library.cells))
        raise ValueError(f"Cell '{cell_name}' was not found. Available cells: {available_cells}")
    return _visible_top_level_cells(library)


def extract_cell_tree(source, *, max_depth: int | None = None) -> dict[str, object]:
    nodes: dict[str, dict[str, object]] = {}
    visited_names: set[str] = set()
    root_names: list[str] = []

    def ensure_node(cell_name: str) -> dict[str, object]:
        return nodes.setdefault(cell_name, {"id": cell_name, "name": cell_name, "children": []})

    def walk(current_cell, depth: int) -> None:
        node = ensure_node(current_cell.name)
        if current_cell.name in visited_names:
            return
        visited_names.add(current_cell.name)
        if max_depth is not None and depth >= max_depth:
            return

        child_names_seen: set[str] = set()
        for reference in getattr(current_cell, "references", ()):
            child_cell = _reference_target_cell(reference)
            if child_cell is None:
                continue
            child_name = child_cell.name
            ensure_node(child_name)
            if child_name not in child_names_seen:
                node["children"].append(child_name)
                child_names_seen.add(child_name)
            walk(child_cell, depth + 1)

    for _, cell in _tree_roots(source):
        if cell.name not in root_names:
            root_names.append(cell.name)
        walk(cell, depth=0)
    return {"roots": root_names, "nodes": [nodes[name] for name in sorted(nodes)]}


def extract_polygons(source, *, max_depth: int | None = None) -> list[PolygonRecord]:
    records: list[PolygonRecord] = []
    visited_nodes: set[str] = set()

    def walk(
        current_cell,
        *,
        cell_id: str,
        parent_cell_id: str | None,
        transform: np.ndarray,
        offset: np.ndarray,
        depth: int,
    ) -> None:
        if cell_id in visited_nodes:
            return
        visited_nodes.add(cell_id)
        records.extend(
            _polygon_records_for_cell(
                current_cell,
                cell_id=cell_id,
                parent_cell_id=parent_cell_id,
                depth=depth,
                transform=transform,
                offset=offset,
            )
        )
        if max_depth is not None and depth >= max_depth:
            return

        for reference_index, reference in enumerate(getattr(current_cell, "references", ())):
            child_cell = _reference_target_cell(reference)
            if child_cell is None:
                continue
            ref_transform = _reference_linear_transform(reference)
            ref_origin = np.asarray(reference.origin, dtype=float)
            repetition = getattr(reference, "repetition", None)
            repetition_offsets = (
                repetition.get_offsets()
                if repetition is not None and repetition.size > 0
                else np.zeros((1, 2), dtype=float)
            )
            for repetition_index, repetition_offset in enumerate(repetition_offsets):
                walk(
                    child_cell,
                    cell_id=f"{cell_id}/{child_cell.name}[{reference_index}:{repetition_index}]",
                    parent_cell_id=cell_id,
                    transform=transform @ ref_transform,
                    offset=transform @ (ref_origin + repetition_offset) + offset,
                    depth=depth + 1,
                )

    for root_id, cell in _tree_roots(source):
        walk(
            cell,
            cell_id=root_id,
            parent_cell_id=None,
            transform=np.eye(2, dtype=float),
            offset=np.zeros(2, dtype=float),
            depth=0,
        )
    return records


def _round_float(value: float) -> float:
    return round(float(value), 3)


def _rounded_polygon_points(points: np.ndarray) -> list[float]:
    return np.round(points, 3).reshape(-1).tolist()


def _group_color(layer: int, datatype: int) -> str:
    palette = (
        "#ff6b6b",
        "#4dabf7",
        "#51cf66",
        "#ffd43b",
        "#845ef7",
        "#ff922b",
        "#f06595",
        "#20c997",
        "#339af0",
        "#94d82d",
        "#fcc419",
        "#5c7cfa",
        "#ff8787",
        "#74c0fc",
        "#69db7c",
        "#ffe066",
        "#b197fc",
        "#ffa94d",
        "#faa2c1",
        "#63e6be",
        "#a5d8ff",
        "#c0eb75",
        "#ffec99",
        "#d0bfff",
    )
    # Spread nearby layer/datatype combinations across the palette instead of
    # walking through adjacent pastel hues, which makes neighboring layers look too similar.
    return palette[(layer * 11 + datatype * 17) % len(palette)]


def _json_bytes(payload: object) -> bytes:
    return json.dumps(payload, separators=(",", ":")).encode("utf-8")


def _view_model_metadata(view_model: dict[str, object], *, document_id: str) -> dict[str, object]:
    return {
        "documentId": document_id,
        "title": view_model["title"],
        "cellName": view_model["cellName"],
        "bounds": view_model["bounds"],
        "cellTree": view_model["cellTree"],
        "cells": view_model["cells"],
        "layers": view_model["layers"],
    }


def _layer_payload(view_model: dict[str, object], layer_key: str) -> dict[str, object]:
    groups = [group for group in view_model["groups"] if group["layerKey"] == layer_key]
    template_ids = {group["templateId"] for group in groups}
    templates = [template for template in view_model["templates"] if template["id"] in template_ids]
    return {"layerKey": layer_key, "groups": groups, "templates": templates}


def build_gds_view_model(source, *, title: str | None = None, max_depth: int | None = None) -> dict[str, object]:
    bounds_min: np.ndarray | None = None
    bounds_max: np.ndarray | None = None
    cell_nodes: dict[str, dict[str, object]] = {}
    root_names: list[str] = []
    visited_cell_names: set[str] = set()
    groups: list[dict[str, object]] = []
    layer_info: dict[str, dict[str, object]] = {}
    template_info: dict[tuple[str, int, int], dict[str, object]] = {}
    cell_template_cache: dict[str, dict[str, object]] = {}

    def ensure_cell_node(cell_name: str) -> dict[str, object]:
        return cell_nodes.setdefault(cell_name, {"id": cell_name, "name": cell_name, "children": []})

    def cell_templates(current_cell) -> dict[str, object]:
        cached = cell_template_cache.get(current_cell.name)
        if cached is not None:
            return cached

        grouped_templates: dict[tuple[int, int], dict[str, object]] = {}
        local_bounds_min: np.ndarray | None = None
        local_bounds_max: np.ndarray | None = None

        for polygon in _iter_cell_polygons(current_cell):
            points = np.asarray(polygon.points, dtype=float)
            if len(points) < 3:
                continue
            layer = int(polygon.layer)
            datatype = int(polygon.datatype)
            key = (layer, datatype)
            template = grouped_templates.get(key)
            if template is None:
                layer_key = f"L{layer}/D{datatype}"
                css_color = _group_color(layer, datatype)
                template = {
                    "id": f"{current_cell.name}::{layer}:{datatype}",
                    "cellName": current_cell.name,
                    "layer": layer,
                    "datatype": datatype,
                    "layerKey": layer_key,
                    "cssColor": css_color,
                    "polygonCount": 0,
                    "polygons": [],
                }
                grouped_templates[key] = template
                template_info[(current_cell.name, layer, datatype)] = template
                layer_info.setdefault(
                    layer_key,
                    {
                        "key": layer_key,
                        "label": layer_key,
                        "layer": layer,
                        "datatype": datatype,
                        "cssColor": css_color,
                    },
                )

            template["polygonCount"] += 1
            template["polygons"].append({"polygon": _rounded_polygon_points(points)})
            points_min = points.min(axis=0)
            points_max = points.max(axis=0)
            local_bounds_min = points_min if local_bounds_min is None else np.minimum(local_bounds_min, points_min)
            local_bounds_max = points_max if local_bounds_max is None else np.maximum(local_bounds_max, points_max)

        cached = {
            "templates": [grouped_templates[key] for key in sorted(grouped_templates)],
            "bounds_min": local_bounds_min,
            "bounds_max": local_bounds_max,
        }
        cell_template_cache[current_cell.name] = cached
        return cached

    def extend_bounds(points: np.ndarray) -> None:
        nonlocal bounds_min, bounds_max
        points_min = points.min(axis=0)
        points_max = points.max(axis=0)
        if bounds_min is None:
            bounds_min = points_min
            bounds_max = points_max
        else:
            bounds_min = np.minimum(bounds_min, points_min)
            bounds_max = np.maximum(bounds_max, points_max)

    def walk_tree(current_cell, depth: int) -> None:
        node = ensure_cell_node(current_cell.name)
        if current_cell.name in visited_cell_names:
            return
        visited_cell_names.add(current_cell.name)
        if max_depth is not None and depth >= max_depth:
            return

        child_names_seen: set[str] = set()
        for reference in getattr(current_cell, "references", ()):
            child_cell = _reference_target_cell(reference)
            if child_cell is None:
                continue
            child_name = child_cell.name
            ensure_cell_node(child_name)
            if child_name not in child_names_seen:
                node["children"].append(child_name)
                child_names_seen.add(child_name)
            walk_tree(child_cell, depth + 1)

    def walk_geometry(current_cell, *, cell_id: str, transform: np.ndarray, offset: np.ndarray, depth: int) -> None:
        template_bundle = cell_templates(current_cell)
        local_bounds_min = template_bundle["bounds_min"]
        local_bounds_max = template_bundle["bounds_max"]
        if local_bounds_min is not None and local_bounds_max is not None:
            corners = np.array(
                [
                    [local_bounds_min[0], local_bounds_min[1]],
                    [local_bounds_min[0], local_bounds_max[1]],
                    [local_bounds_max[0], local_bounds_min[1]],
                    [local_bounds_max[0], local_bounds_max[1]],
                ],
                dtype=float,
            )
            extend_bounds(corners @ transform.T + offset)

        transform_values = [float(transform[0, 0]), float(transform[0, 1]), float(transform[1, 0]), float(transform[1, 1])]
        offset_values = [float(offset[0]), float(offset[1])]
        for template in template_bundle["templates"]:
            groups.append(
                {
                    "id": f"{cell_id}::{template['layer']}:{template['datatype']}",
                    "cellId": cell_id,
                    "cellName": current_cell.name,
                    "layer": template["layer"],
                    "datatype": template["datatype"],
                    "layerKey": template["layerKey"],
                    "cssColor": template["cssColor"],
                    "count": template["polygonCount"],
                    "templateId": template["id"],
                    "transform": transform_values,
                    "offset": offset_values,
                }
            )

        if max_depth is not None and depth >= max_depth:
            return

        for reference_index, reference in enumerate(getattr(current_cell, "references", ())):
            child_cell = _reference_target_cell(reference)
            if child_cell is None:
                continue
            ref_transform = _reference_linear_transform(reference)
            ref_origin = np.asarray(reference.origin, dtype=float)
            repetition = getattr(reference, "repetition", None)
            repetition_offsets = (
                repetition.get_offsets()
                if repetition is not None and repetition.size > 0
                else np.zeros((1, 2), dtype=float)
            )
            for repetition_index, repetition_offset in enumerate(repetition_offsets):
                walk_geometry(
                    child_cell,
                    cell_id=f"{cell_id}/{child_cell.name}[{reference_index}:{repetition_index}]",
                    transform=transform @ ref_transform,
                    offset=transform @ (ref_origin + repetition_offset) + offset,
                    depth=depth + 1,
                )

    for root_id, cell in _tree_roots(source):
        if cell.name not in root_names:
            root_names.append(cell.name)
        walk_tree(cell, depth=0)
        walk_geometry(
            cell,
            cell_id=root_id,
            transform=np.eye(2, dtype=float),
            offset=np.zeros(2, dtype=float),
            depth=0,
        )

    bounds = (
        {
            "xmin": _round_float(bounds_min[0]),
            "ymin": _round_float(bounds_min[1]),
            "xmax": _round_float(bounds_max[0]),
            "ymax": _round_float(bounds_max[1]),
        }
        if bounds_min is not None and bounds_max is not None
        else {"xmin": -1.0, "ymin": -1.0, "xmax": 1.0, "ymax": 1.0}
    )
    cell_tree = {"roots": root_names, "nodes": [cell_nodes[name] for name in sorted(cell_nodes)]}
    return {
        "title": title or "GDS Viewer",
        "cellName": source.name if hasattr(source, "name") else "GDS Library",
        "bounds": bounds,
        "groups": groups,
        "templates": [template_info[key] for key in sorted(template_info)],
        "cellTree": cell_tree,
        "cells": cell_tree["nodes"],
        "layers": sorted(layer_info.values(), key=lambda item: (item["layer"], item["datatype"])),
    }


def load_gds_cell(gds_path: str | Path, *, cell_name: str | None = None):
    import gdstk

    library = gdstk.read_gds(str(gds_path))
    source = _select_gds_source(library, cell_name=cell_name)
    if isinstance(source, list):
        if not source and library.cells:
            return library.cells[0]
        if not source:
            raise ValueError(f"No cells were found in '{gds_path}'.")
        if len(source) == 1:
            return source[0]
        names = ", ".join(sorted(cell.name for cell in source))
        raise ValueError(f"Multiple top-level cells found in '{gds_path}'. Pass cell_name to choose one: {names}")
    return source


@lru_cache(maxsize=8)
def _load_gds_view_model_cached(
    gds_path_str: str,
    cell_name: str | None,
    title: str | None,
    max_depth: int | None,
    stat_mtime_ns: int,
    stat_size: int,
) -> dict[str, object]:
    del stat_mtime_ns, stat_size
    import gdstk

    library = gdstk.read_gds(gds_path_str)
    source = _select_gds_source(library, cell_name=cell_name)
    if isinstance(source, list) and not source and library.cells:
        source = [library.cells[0]]
    elif isinstance(source, list) and not source:
        raise ValueError(f"No cells were found in '{gds_path_str}'.")
    return build_gds_view_model(source, title=title or f"GDS Viewer: {Path(gds_path_str).name}", max_depth=max_depth)


def load_gds_view_model(
    gds_path: str | Path,
    *,
    cell_name: str | None = None,
    title: str | None = None,
    max_depth: int | None = None,
) -> dict[str, object]:
    path = Path(gds_path)
    stat = path.stat()
    return _load_gds_view_model_cached(str(path), cell_name, title, max_depth, stat.st_mtime_ns, stat.st_size)


def _asset_text(name: str) -> str:
    return Path(__file__).with_name(name).read_text(encoding="utf-8")


def create_gds_viewer_app(
    *,
    initial_gds_path: str | Path | None = None,
    initial_cell_name: str | None = None,
    initial_title: str | None = None,
    max_depth: int | None = None,
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
    max_documents: int = DEFAULT_MAX_DOCUMENTS,
):
    if max_upload_bytes <= 0:
        raise ValueError("max_upload_bytes must be greater than zero.")
    if max_documents <= 0:
        raise ValueError("max_documents must be greater than zero.")

    html_text = _asset_text("gds_viewer.html")
    js_text = _asset_text("gds_viewer.js")
    parser_text = _asset_text("gds_parser.js")
    document_store: dict[str, dict[str, object]] = {}

    def store_document(document_id: str, view_model: dict[str, object]) -> None:
        document_store[document_id] = view_model
        while len(document_store) > max_documents:
            del document_store[next(iter(document_store))]

    initial_document_id = None
    if initial_gds_path is not None:
        initial_model = load_gds_view_model(
            initial_gds_path,
            cell_name=initial_cell_name,
            title=initial_title,
            max_depth=max_depth,
        )
        initial_document_id = f"doc-{uuid4().hex}"
        store_document(initial_document_id, initial_model)

    def respond(environ, start_response, status: str, body: bytes, content_type: str) -> list[bytes]:
        accepts_gzip = "gzip" in (environ.get("HTTP_ACCEPT_ENCODING", "") or "").lower()
        should_gzip = accepts_gzip and content_type.startswith("application/json") and len(body) >= 64 * 1024
        if should_gzip:
            body = gzip.compress(body, compresslevel=5)
        headers = [
            ("Content-Type", content_type),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
        ]
        if should_gzip:
            headers.append(("Content-Encoding", "gzip"))
        start_response(status, headers)
        return [body]

    def app(environ, start_response):
        method = environ.get("REQUEST_METHOD", "GET").upper()
        path = environ.get("PATH_INFO", "/")
        query = parse_qs(environ.get("QUERY_STRING", ""), keep_blank_values=True)

        if method == "GET" and path == "/":
            return respond(environ, start_response, "200 OK", html_text.encode("utf-8"), "text/html; charset=utf-8")

        if method == "GET" and path == "/gds_viewer.js":
            return respond(
                environ,
                start_response,
                "200 OK",
                js_text.encode("utf-8"),
                "application/javascript; charset=utf-8",
            )

        if method == "GET" and path == "/gds_parser.js":
            return respond(
                environ,
                start_response,
                "200 OK",
                parser_text.encode("utf-8"),
                "application/javascript; charset=utf-8",
            )

        if method == "GET" and path == "/api/initial-data":
            payload = {"view_model": None, "initial_layer": None}
            initial_model = document_store.get(initial_document_id) if initial_document_id is not None else None
            if initial_model is not None and initial_document_id is not None:
                metadata = _view_model_metadata(initial_model, document_id=initial_document_id)
                initial_layer = _layer_payload(initial_model, metadata["layers"][0]["key"]) if metadata["layers"] else None
                payload = {"view_model": metadata, "initial_layer": initial_layer}
            return respond(
                environ,
                start_response,
                "200 OK",
                _json_bytes(payload),
                "application/json; charset=utf-8",
            )

        if method == "POST" and path == "/api/load-gds":
            try:
                content_length = int(environ.get("CONTENT_LENGTH") or "0")
                if content_length < 0:
                    raise ValueError
            except (TypeError, ValueError):
                return respond(
                    environ,
                    start_response,
                    "400 Bad Request",
                    _json_bytes({"error": "Invalid Content-Length header."}),
                    "application/json; charset=utf-8",
                )
            if content_length > max_upload_bytes:
                return respond(
                    environ,
                    start_response,
                    "413 Payload Too Large",
                    _json_bytes({"error": f"Upload exceeds the {max_upload_bytes}-byte limit."}),
                    "application/json; charset=utf-8",
                )
            raw_body = environ["wsgi.input"].read(content_length)
            if not raw_body:
                return respond(
                    environ,
                    start_response,
                    "400 Bad Request",
                    _json_bytes({"error": "Request body is empty."}),
                    "application/json; charset=utf-8",
                )

            filename = query.get("filename", ["uploaded.gds"])[0]
            cell_name = query.get("cell_name", [None])[0] or None
            title = query.get("title", [None])[0] or f"GDS Viewer: {Path(filename).name}"
            suffix = Path(filename).suffix or ".gds"
            try:
                with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(raw_body)
                    temp_path = Path(tmp.name)
                view_model = load_gds_view_model(temp_path, cell_name=cell_name, title=title, max_depth=max_depth)
                document_id = f"doc-{uuid4().hex}"
                store_document(document_id, view_model)
            except Exception as exc:
                return respond(
                    environ,
                    start_response,
                    "400 Bad Request",
                    _json_bytes({"error": str(exc)}),
                    "application/json; charset=utf-8",
                )
            finally:
                if "temp_path" in locals():
                    temp_path.unlink(missing_ok=True)

            metadata = _view_model_metadata(view_model, document_id=document_id)
            initial_layer = _layer_payload(view_model, metadata["layers"][0]["key"]) if metadata["layers"] else None
            return respond(
                environ,
                start_response,
                "200 OK",
                _json_bytes({"view_model": metadata, "initial_layer": initial_layer}),
                "application/json; charset=utf-8",
            )

        if method == "GET" and path == "/api/layer-data":
            document_id = query.get("document_id", [""])[0]
            layer_key = query.get("layer_key", [""])[0]
            view_model = document_store.get(document_id)
            if view_model is None:
                return respond(
                    environ,
                    start_response,
                    "404 Not Found",
                    _json_bytes({"error": f"Unknown document id: {document_id}"}),
                    "application/json; charset=utf-8",
                )
            if not layer_key:
                return respond(
                    environ,
                    start_response,
                    "400 Bad Request",
                    _json_bytes({"error": "Missing required layer_key parameter."}),
                    "application/json; charset=utf-8",
                )
            return respond(
                environ,
                start_response,
                "200 OK",
                _json_bytes(_layer_payload(view_model, layer_key)),
                "application/json; charset=utf-8",
            )

        return respond(
            environ,
            start_response,
            "404 Not Found",
            _json_bytes({"error": f"Not found: {path}"}),
            "application/json; charset=utf-8",
        )

    return app


def serve_gds_viewer(
    *,
    host: str = "127.0.0.1",
    port: int = 8765,
    initial_gds_path: str | Path | None = None,
    initial_cell_name: str | None = None,
    initial_title: str | None = None,
    max_depth: int | None = None,
) -> None:
    app = create_gds_viewer_app(
        initial_gds_path=initial_gds_path,
        initial_cell_name=initial_cell_name,
        initial_title=initial_title,
        max_depth=max_depth,
    )
    with make_server(host, port, app) as server:
        print(f"GDS viewer server listening on http://{host}:{port}/", flush=True)
        server.serve_forever()


__all__ = [
    "PolygonRecord",
    "build_gds_view_model",
    "create_gds_viewer_app",
    "extract_cell_tree",
    "extract_polygons",
    "load_gds_cell",
    "load_gds_view_model",
    "serve_gds_viewer",
]
