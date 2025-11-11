# debug_ws.py  (put near where you create `app`)
class ASGIDebugWrapper:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # This runs for *every* ASGI message, including WebSockets
        if scope["type"] == "websocket":
            # Print the path and key headers (lowercase bytes tuples)
            hdrs = {k.decode(): v.decode() for k, v in scope.get("headers", []) if k in {b'upgrade', b'connection', b'sec-websocket-version', b'sec-websocket-key'}}
            print(f"[WS] incoming upgrade path={scope.get('path')} headers={hdrs}")
        return await self.app(scope, receive, send)




from fastapi import FastAPI
from .debug_ws import ASGIDebugWrapper

app = FastAPI()
# ... include routers etc ...
app = ASGIDebugWrapper(app)   # <= wrap at the very end



from fastapi import APIRouter, WebSocket
ws_debug_router = APIRouter()

@ws_debug_router.websocket("/ws-echo")
async def ws_echo(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_text()
            await ws.send_text(msg)
    except Exception:
        pass

app.include_router(ws_debug_router)



// Use your real host and prefix if any (e.g., /api/ws-echo)
const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
new WebSocket(`${scheme}://${location.host}/ws-echo`);


@app.on_event("startup")
async def dump_routes():
    print([(r.path, getattr(r, "methods", ["WS"])) for r in app.routes])
