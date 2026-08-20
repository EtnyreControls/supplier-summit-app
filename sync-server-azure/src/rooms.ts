import { TLSocketRoom } from "@tldraw/sync-core";
import { createTLSchema, defaultShapeSchemas, TLRecord } from "@tldraw/tlschema";

// Same schema as the client (main-app's GrowthMachine/useSync call) — must
// match or clients and server disagree on the record shape. Add custom
// shapes/bindings here (and in the client) if the board ever needs them
// beyond tldraw's defaults.
const schema = createTLSchema({
  shapes: { ...defaultShapeSchemas },
});

// How long an empty room is kept around before its in-memory state is
// dropped. Short-lived on purpose: unlike the Cloudflare version, there's no
// persistent storage backing these rooms, so once a table's board is
// abandoned there is nothing worth keeping past the working session. A
// brief grace period just absorbs quick reconnects (page refresh, flaky
// wifi) without losing state.
const EMPTY_ROOM_TTL_MS = 60_000;

interface RoomEntry {
  room: TLSocketRoom<TLRecord, void>;
  emptySince: number | null;
}

const rooms = new Map<string, RoomEntry>();

function createRoom(): TLSocketRoom<TLRecord, void> {
  return new TLSocketRoom<TLRecord, void>({
    schema,
    onSessionRemoved: (room) => {
      if (room.getNumActiveSessions() === 0) {
        const entry = rooms.get(roomIdOf(room));
        if (entry) entry.emptySince = Date.now();
      }
    },
  });
}

// TLSocketRoom doesn't carry its own id, so we track it on the entry instead
// of trying to recover it from the room instance.
const roomIds = new WeakMap<TLSocketRoom<TLRecord, void>, string>();
function roomIdOf(room: TLSocketRoom<TLRecord, void>): string {
  return roomIds.get(room) ?? "";
}

export function getOrCreateRoom(roomId: string): TLSocketRoom<TLRecord, void> {
  const existing = rooms.get(roomId);
  if (existing) {
    existing.emptySince = null;
    return existing.room;
  }

  const room = createRoom();
  roomIds.set(room, roomId);
  rooms.set(roomId, { room, emptySince: null });
  return room;
}

// Periodic sweep instead of a per-room timer — simpler, and fine at this
// scale (at most a few dozen concurrently active tables).
setInterval(() => {
  const now = Date.now();
  for (const [roomId, entry] of rooms) {
    if (entry.emptySince !== null && now - entry.emptySince > EMPTY_ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
}, 10_000).unref();

export function activeRoomCount(): number {
  return rooms.size;
}
