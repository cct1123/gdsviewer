"""Command-line entry point for the GDS viewer."""

from __future__ import annotations

import argparse
import threading
import webbrowser
from pathlib import Path

from .viewer import serve_gds_viewer


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Open a GDSII layout in a browser viewer.")
    parser.add_argument("gds_path", nargs="?", type=Path, help="Optional GDSII file to preload.")
    parser.add_argument("--cell", dest="cell_name", help="Top-level cell to display.")
    parser.add_argument("--title", help="Viewer title.")
    parser.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8765, help="Server port (default: 8765).")
    parser.add_argument("--max-depth", type=int, help="Maximum cell-reference depth to expand.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser automatically.")
    return parser


def main(argv: list[str] | None = None) -> None:
    args = _parser().parse_args(argv)
    if args.gds_path is not None and not args.gds_path.is_file():
        raise SystemExit(f"GDS file not found: {args.gds_path}")

    url = f"http://{args.host}:{args.port}/"
    if not args.no_browser:
        timer = threading.Timer(0.75, webbrowser.open, args=(url,))
        timer.daemon = True
        timer.start()

    print(f"Starting GDS viewer at {url}")
    if args.gds_path is None:
        print("Use the file picker or drag a .gds file into the page.")
    serve_gds_viewer(
        host=args.host,
        port=args.port,
        initial_gds_path=args.gds_path,
        initial_cell_name=args.cell_name,
        initial_title=args.title,
        max_depth=args.max_depth,
    )


if __name__ == "__main__":
    main()

