#!/usr/bin/env python3
"""Simple HTTPS static file server for the client_server bundle.

Usage example:
    python3 serve_https.py --cert cert.pem --key key.pem --port 8443

The script mirrors `python -m http.server` but adds TLS support so the
client can request microphone access from browsers on the same network.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import pathlib
import ssl
import sys
from typing import Tuple

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8443
DEFAULT_DIRECTORY = pathlib.Path(__file__).parent


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Serve client files over HTTPS")
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"Interface to bind (default: {DEFAULT_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to listen on (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--directory",
        type=pathlib.Path,
        default=DEFAULT_DIRECTORY,
        help="Directory to serve (default: this script's folder)",
    )
    parser.add_argument(
        "--cert",
        required=True,
        help="Path to the TLS certificate (PEM)",
    )
    parser.add_argument(
        "--key",
        required=True,
        help="Path to the TLS private key (PEM)",
    )
    return parser


def create_ssl_context(cert_path: str, key_path: str) -> ssl.SSLContext:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=cert_path, keyfile=key_path)
    # Drop TLS versions that modern browsers reject.
    context.options |= ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1
    return context


def serve(host: str, port: int, directory: pathlib.Path, context: ssl.SSLContext) -> Tuple[str, int]:
    handler_cls = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    server = http.server.ThreadingHTTPServer((host, port), handler_cls)
    server.socket = context.wrap_socket(server.socket, server_side=True)
    try:
        print(f"Serving HTTPS on https://{host}:{port}/ (dir: {directory})")
        server.serve_forever()
    finally:
        server.server_close()
    return host, port


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    directory = args.directory.resolve()
    if not directory.exists():
        parser.error(f"Directory does not exist: {directory}")

    context = create_ssl_context(args.cert, args.key)

    try:
        serve(args.host, args.port, directory, context)
    except OSError as exc:
        print(f"Failed to start HTTPS server: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
