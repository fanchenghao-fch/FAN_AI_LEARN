"""SPA static server — serves Taro H5 build with HTML5 History fallback."""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 10086
DIST_DIR = os.path.join(os.path.dirname(__file__), "frontend", "dist")


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0]
        file_path = os.path.join(DIST_DIR, path.lstrip("/"))

        if (
            not os.path.exists(file_path)
            or os.path.isdir(file_path)
        ) and not path.startswith("/api/"):
            self.path = "/index.html"

        return super().do_GET()


if __name__ == "__main__":
    os.chdir(DIST_DIR)
    server = http.server.HTTPServer(("0.0.0.0", PORT), SPAHandler)
    print(f"✅ 前端服务启动: http://localhost:{PORT}")
    server.serve_forever()
