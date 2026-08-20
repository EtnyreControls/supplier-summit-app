# Growth Machine sync server (Azure)

Plain Node WebSocket server that gives the Growth Machine board (`main-app`'s
`GrowthMachine` component) real-time multiplayer sync via
[`@tldraw/sync-core`](https://tldraw.dev/docs/sync) — an Azure-hosted
replacement for the Cloudflare Durable Object version in `../sync-server`.

## How it differs from the Cloudflare version

- One `TLSocketRoom` per table, held in a plain in-memory `Map` (see
  `src/rooms.ts`) instead of one Durable Object per room. No hibernation —
  the process just stays running and keeps everything in memory.
- No persistent storage backing live rooms. This is intentional: the only
  thing that needs to survive is the *finished* board, and that's already
  saved to Supabase on Submit (`submitGrowthMachineBoard` /
  `submit_growth_machine_board()`, unchanged by this migration). Empty
  rooms are dropped from memory after a short grace period
  (`EMPTY_ROOM_TTL_MS` in `src/rooms.ts`) to absorb quick reconnects.
- `ws` attaches directly to `TLSocketRoom.handleSocketConnect` — no manual
  message-forwarding/session-resume plumbing, since that machinery in the
  Cloudflare version exists only to survive Durable Object hibernation,
  which doesn't apply here.
- Single instance by default. If you ever need more than one replica for
  reliability/scale, you'll need sticky sessions (so all of a table's
  clients land on the same instance) — not required to ship this.

## Local dev

```bash
npm install
npm run dev
```

Runs on `http://localhost:8080` (`ws://localhost:8080` for the sync
endpoint). Point `NEXT_PUBLIC_TLDRAW_SYNC_URL` at
`ws://localhost:8080` in `main-app/.env` to test against it.

## Deploy to Azure Container Apps

Run from this directory. These touch your actual Azure subscription, so
run them yourself rather than handing off:

```bash
# One-time: resource group + Container Apps environment
az group create --name growth-machine-rg --location eastus
az containerapp env create --name growth-machine-env --resource-group growth-machine-rg --location eastus

# Build & push the image (requires an Azure Container Registry)
az acr create --name growthmachineacr --resource-group growth-machine-rg --sku Basic
az acr build --registry growthmachineacr --image growth-machine-sync:latest .

# Deploy — --ingress external + --target-port enables WebSocket traffic
az containerapp create \
  --name growth-machine-sync \
  --resource-group growth-machine-rg \
  --environment growth-machine-env \
  --image growthmachineacr.azurecr.io/growth-machine-sync:latest \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1
```

`--min-replicas 1 --max-replicas 1` keeps this at a single instance —
matches the in-memory, no-sticky-sessions design above. Raise both together
(and add session affinity) only if you actually need more capacity.

`az containerapp create` prints the app's URL, e.g.
`https://growth-machine-sync.<region>.azurecontainerapps.io`. Swap
`https://` for `wss://` and put it in `main-app/.env`:

```bash
NEXT_PUBLIC_TLDRAW_SYNC_URL="wss://growth-machine-sync.<region>.azurecontainerapps.io"
```

No other client changes needed — `main-app`'s `useSync` call already talks
to `${syncServerUrl}/api/connect/${roomId}`, which this server implements
identically to the Cloudflare version.

### License key

Set your tldraw license key as a Container Apps secret/env var rather than
baking it into the image:

```bash
az containerapp update --name growth-machine-sync --resource-group growth-machine-rg \
  --set-env-vars TLDRAW_LICENSE_KEY=secretref:tldraw-license-key \
  --secrets tldraw-license-key=<your-key>
```

(The license key is enforced client-side by the `Tldraw`/`Editor` component
in `main-app`, not by this sync server — this just gets it into the
container's environment if/when the server needs it too.)

## Health check

`GET /healthz` returns `{"ok": true, "rooms": <active room count>}` —
point Container Apps' health probe at this path.

## Changing the schema

If the board ever needs custom shapes/bindings beyond tldraw's defaults,
add them to the `createTLSchema(...)` call in `src/rooms.ts` — and make
sure the client (`main-app`'s `useSync` call) passes the same
shape/binding set, or clients and server will disagree on the schema.
