"""Static dev server with caching disabled, so edited JS modules always reload."""

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", 5173))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"Serving on http://localhost:{PORT}/playground.html")
    ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
