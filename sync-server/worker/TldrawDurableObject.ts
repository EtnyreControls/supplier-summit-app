import {
  DurableObjectSqliteSyncWrapper,
  type SessionStateSnapshot,
  SQLiteSyncStorage,
  TLSocketRoom,
} from "@tldraw/sync-core";
import { createTLSchema, defaultShapeSchemas, TLRecord } from "@tldraw/tlschema";
import { DurableObject } from "cloudflare:workers";
import { AutoRouter, error, IRequest } from "itty-router";

// Add custom shapes/bindings here if the board ever needs them beyond
// tldraw's defaults (it doesn't today).
const schema = createTLSchema({
  shapes: { ...defaultShapeSchemas },
});

interface SocketAttachment {
  sessionId: string;
  snapshot: SessionStateSnapshot | null;
}

/**
 * One Durable Object per room (one per table's board — see worker.ts's
 * `idFromName(tableId)`). Room state persists to the DO's own SQLite
 * storage automatically; when every client disconnects the DO hibernates
 * (freeing memory) while Cloudflare keeps the WebSocket connections alive
 * at the platform layer, so reconnects resume without dropping state.
 *
 * Copied close to verbatim from tldraw's official Cloudflare sync template
 * (github.com/tldraw/tldraw-sync-cloudflare) — this part is tightly coupled
 * to the installed @tldraw/sync-core version, not something to improvise on.
 */
export class TldrawDurableObject extends DurableObject {
  private room: TLSocketRoom<TLRecord, void> | null = null;
  /** Map sessionId → ws so onSessionSnapshot can serialize to the right socket. */
  private readonly sessionIdToWs = new Map<string, WebSocket>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Respond to ping messages at the platform level without waking the DO.
    // The TLSyncClient sends {"type":"ping"} every 5s; without this, each
    // ping would wake the DO from hibernation.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}'),
    );
  }

  private getOrCreateRoom(): TLSocketRoom<TLRecord, void> {
    if (!this.room) {
      const sql = new DurableObjectSqliteSyncWrapper(this.ctx.storage);
      const storage = new SQLiteSyncStorage<TLRecord>({ sql });

      this.room = new TLSocketRoom<TLRecord, void>({
        schema,
        storage,
        // Disable idle timeout since Cloudflare handles keep-alive via auto-response.
        // Without this, sessions would be pruned after 20s of no "real" messages
        // even though the client is still connected and being auto-ponged.
        clientTimeout: Infinity,
        onSessionSnapshot: (sessionId, snapshot) => {
          const ws = this.sessionIdToWs.get(sessionId);
          if (ws) ws.serializeAttachment({ sessionId, snapshot });
        },
      });

      // Resume any sessions that survived hibernation.
      for (const ws of this.ctx.getWebSockets()) {
        const attachment = ws.deserializeAttachment() as SocketAttachment | null;
        if (!attachment?.sessionId) continue;

        if (attachment.snapshot) {
          this.room.handleSocketResume({
            sessionId: attachment.sessionId,
            socket: ws,
            snapshot: attachment.snapshot,
          });
        }
      }
    }
    return this.room;
  }

  private readonly router = AutoRouter({ catch: (e) => error(e) }).get(
    "/api/connect/:roomId",
    (request) => this.handleConnect(request),
  );

  // Entry point for all requests to the Durable Object.
  fetch(request: Request): Response | Promise<Response> {
    return this.router.fetch(request);
  }

  async handleConnect(request: IRequest) {
    const sessionId = request.query.sessionId as string;
    if (!sessionId) return error(400, "Missing sessionId");

    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
    // Use hibernation API instead of serverWebSocket.accept().
    this.ctx.acceptWebSocket(serverWebSocket);

    // Store sessionId in attachment immediately so we can identify this socket
    // after hibernation, before the connect handshake completes.
    const attachment: SocketAttachment = { sessionId, snapshot: null };
    serverWebSocket.serializeAttachment(attachment);

    // Connect to the room. The first webSocketMessage from the client will
    // complete the handshake and trigger debounced snapshot storage.
    this.getOrCreateRoom().handleSocketConnect({ sessionId, socket: serverWebSocket });

    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  // --- WebSocket Hibernation API handlers ---

  private getSessionId(ws: WebSocket): string | null {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    return attachment?.sessionId ?? null;
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const sessionId = this.getSessionId(ws);
    if (!sessionId) return;

    this.sessionIdToWs.set(sessionId, ws);
    this.getOrCreateRoom().handleSocketMessage(sessionId, message);
  }

  override async webSocketClose(ws: WebSocket) {
    this.handleWebSocketEnd(ws, "handleSocketClose");
  }

  override async webSocketError(ws: WebSocket) {
    this.handleWebSocketEnd(ws, "handleSocketError");
  }

  private handleWebSocketEnd(ws: WebSocket, method: "handleSocketClose" | "handleSocketError") {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (!attachment?.sessionId) return;

    this.sessionIdToWs.delete(attachment.sessionId);

    const room = this.getOrCreateRoom();

    // If the DO was hibernating, this session was never re-added to the room
    // (ctx.getWebSockets() doesn't include the disconnecting socket). Resume it
    // briefly so the room can broadcast presence removal to other clients.
    if (attachment.snapshot && !room.getSessionSnapshot(attachment.sessionId)) {
      room.handleSocketResume({
        sessionId: attachment.sessionId,
        socket: ws,
        snapshot: attachment.snapshot,
      });
    }

    room[method](attachment.sessionId);
  }
}
