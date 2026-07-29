import { AutoRouter, error, IRequest } from "itty-router";

// Make sure the Durable Object class is available to the Cloudflare runtime.
export { TldrawDurableObject } from "./TldrawDurableObject";

/**
 * Routing only — the actual sync logic lives in TldrawDurableObject. One DO
 * instance per `roomId` (one per table's board, per how the client picks
 * its room id — see GrowthMachine's useSync call in main-app).
 */
const router = AutoRouter<IRequest, [env: Env, ctx: ExecutionContext]>({
  catch: (e) => {
    console.error(e);
    return error(e);
  },
}).get("/api/connect/:roomId", (request, env) => {
  const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId);
  const room = env.TLDRAW_DURABLE_OBJECT.get(id);
  return room.fetch(request.url, { headers: request.headers, body: request.body });
});

router.all("*", () => new Response("Not found", { status: 404 }));

export default {
  fetch: router.fetch,
};
