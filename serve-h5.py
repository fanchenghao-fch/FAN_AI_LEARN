"""SPA static server for Taro H5 dist-h5 — supports HTML5 History fallback."""

import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 10086
DIST_DIR = os.path.join(os.path.dirname(__file__), "frontend", "dist-h5")


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def do_GET(self):
        path = self.path.split("?")[0]
        real = os.path.join(DIST_DIR, path.lstrip("/"))
        if (not os.path.exists(real) or os.path.isdir(real)) and "." not in path.split("/")[-1]:
            self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    os.chdir(DIST_DIR)
    httpd = http.server.HTTPServer(("0.0.0.0", PORT), SPAHandler)
    print(f"✅ Taro H5 → http://localhost:{PORT}")
    httpd.serve_forever()
