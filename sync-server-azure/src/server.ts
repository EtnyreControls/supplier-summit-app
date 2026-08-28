import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { activeRoomCount, getOrCreateRoom } from "./rooms.js";

const PORT = Number(process.env.PORT ?? 8080);

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: activeRoomCount() }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "", "http://placeholder");
  const match = url.pathname.match(/^\/api\/connect\/([^/]+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const roomId = decodeURIComponent(match[1]);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    socket.destroy();
    return;
  }
  // Set by main-app's useSync `uri` (?readOnly=true for Spectators).
  const isReadonly = url.searchParams.get("readOnly") === "true";

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleConnect(ws, roomId, sessionId, isReadonly);
  });
});

function handleConnect(ws: WebSocket, roomId: string, sessionId: string, isReadonly: boolean) {
  const room = getOrCreateRoom(roomId);
  // handleSocketConnect attaches its own message/close/error listeners
  // directly to the socket — no manual message forwarding needed (that's
  // only required on platforms that can't attach listeners directly, e.g.
  // Cloudflare's hibernation API).
  //
  // isReadonly now IS passed through (previously deliberately left unset,
  // gating write access client-side instead — see main-app's text.tsx). That
  // client-side-only enforcement was fighting sync-core's own internal
  // reactor, which force-writes instanceState.isReadonly from the
  // server-reported collaboration mode on every connect/reconnect: since
  // this server always reported "readwrite" for everyone, the client's
  // corrective write and the reactor's opposing write could never converge,
  // looping until tldraw's own reaction-depth guard threw "Reaction update
  // depth limit exceeded". Reporting the real value here removes the
  // conflict at the source instead of re-fighting it harder client-side.
  room.handleSocketConnect({ sessionId, socket: ws, isReadonly });
}

server.listen(PORT, () => {
  console.log(`Growth Machine sync server listening on :${PORT}`);
});
