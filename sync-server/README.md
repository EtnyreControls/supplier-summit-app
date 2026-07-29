# Growth Machine sync server

Cloudflare Worker that gives the Growth Machine board (`main-app`'s
`GrowthMachine` component) real-time multiplayer sync via
[`@tldraw/sync-core`](https://tldraw.dev/docs/sync). One Durable Object
instance per room — the client picks the room id (currently derived from
`?table=` on `/growth-machine/board`, see `main-app`).

Adapted from tldraw's official template
(https://github.com/tldraw/tldraw-sync-cloudflare), trimmed to shape/drawing
sync only — no image/video upload support yet (that needs an R2 bucket and
CORS-handling upload routes; can be added later by pulling `assetUploads.ts`
and the R2 binding back in from the template).

## Deploy

Run these from this directory (`sync-server/`). They touch your actual
Cloudflare account, so they're for you to run, not something to hand off:

```bash
npm install
npx wrangler login
npx wrangler deploy
```

`wrangler deploy` prints the worker's URL, e.g.
`https://growth-machine-sync.<your-subdomain>.workers.dev`. Take that URL,
swap `https://` for `wss://`, and put it in `main-app/.env` as:

```bash
NEXT_PUBLIC_TLDRAW_SYNC_URL="wss://growth-machine-sync.<your-subdomain>.workers.dev"
```

No R2 bucket or other setup needed for this version — just the Durable
Object binding already in `wrangler.toml`.

## Local dev

```bash
npm run dev
```

Runs the worker locally via `wrangler dev` (defaults to
`http://localhost:8787`). Point `NEXT_PUBLIC_TLDRAW_SYNC_URL` at
`ws://localhost:8787` to test against it from `main-app`.

## Changing the schema

If the board ever needs custom shapes/bindings beyond tldraw's defaults,
add them to the `createTLSchema(...)` call in `worker/TldrawDurableObject.ts`
— and make sure the client (`main-app`'s `useSync` call) passes the same
shape/binding set, or clients and server will disagree on the schema.
