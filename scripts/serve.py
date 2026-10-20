#!/usr/bin/env python3
"""Serve the static practice room only on this computer."""
import argparse
import functools
import http.server
from pathlib import Path
import threading
import webbrowser

root = Path(__file__).resolve().parents[1] / "dist"
parser = argparse.ArgumentParser(description="何切300 本地练习网站")
parser.add_argument("--port", type=int, default=8765)
parser.add_argument("--no-open", action="store_true")
args = parser.parse_args()

class LocalServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
url = f"http://127.0.0.1:{args.port}"
try:
    server = LocalServer(("127.0.0.1", args.port), handler)
except OSError as exc:
    raise SystemExit(f"无法启动：{exc}\n如网站已在运行，请直接打开 {url}。")
print(f"何切练习室：{url}\n按 Ctrl+C 停止。", flush=True)
if not args.no_open:
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
