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

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleConnect(ws, roomId, sessionId);
  });
});

function handleConnect(ws: WebSocket, roomId: string, sessionId: string) {
  const room = getOrCreateRoom(roomId);
  // handleSocketConnect attaches its own message/close/error listeners
  // directly to the socket — no manual message forwarding needed (that's
  // only required on platforms that can't attach listeners directly, e.g.
  // Cloudflare's hibernation API). isReadonly isn't passed here, matching
  // the Cloudflare version: write access is gated client-side (Spectators'
  // editor is put in isReadonly mode, see main-app's text.tsx), not by the
  // sync server itself.
  room.handleSocketConnect({ sessionId, socket: ws });
}

server.listen(PORT, () => {
  console.log(`Growth Machine sync server listening on :${PORT}`);
});
