"""Optional proof of a trusted edge hop, checked before HTTP and Socket.IO routing."""
import logging
import secrets
import time

from starlette.responses import PlainTextResponse


class EdgeOriginMiddleware:
    def __init__(self, app, *, mode, shared_key):
        if mode not in {"off", "observe", "enforce"}:
            raise ValueError("Invalid SNAR edge mode")
        if mode != "off" and (not shared_key.isascii() or len(shared_key.strip()) < 32):
            raise ValueError("SNAR edge mode requires an ASCII edge key of at least 32 characters")
        self.app = app
        self.mode = mode
        self.key = shared_key.encode("ascii") if mode != "off" else b""
        self.last_notice = {}
        self.unreported = {}

    async def __call__(self, scope, receive, send):
        if scope["type"] not in {"http", "websocket"} or self.mode == "off":
            return await self.app(scope, receive, send)
        headers = scope["headers"]
        proof = [value for name, value in headers if name.lower() == b"x-snar-edge-key"]
        scope = dict(scope, headers=[h for h in headers if h[0].lower() != b"x-snar-edge-key"])
        # Render's own liveness probe reaches the origin directly.
        probe = (scope["type"] == "http" and scope["method"] in {"GET", "HEAD"}
                 and scope["path"] == "/api/health")
        if not probe and not (len(proof) == 1 and secrets.compare_digest(proof[0], self.key)):
            kind = scope["type"]
            now = time.monotonic()
            self.unreported[kind] = self.unreported.get(kind, 0) + 1
            if kind not in self.last_notice or now - self.last_notice[kind] >= 60:
                logging.getLogger("snar.security").warning(
                    "edge_proof_missing mode=%s transport=%s count=%d",
                    self.mode, kind, self.unreported.pop(kind),
                )
                self.last_notice[kind] = now
            if self.mode == "enforce":
                if kind == "websocket":
                    return await send({"type": "websocket.close", "code": 1008})
                return await PlainTextResponse("Forbidden", status_code=403,
                                               headers={"Cache-Control": "no-store"})(scope, receive, send)
        return await self.app(scope, receive, send)
