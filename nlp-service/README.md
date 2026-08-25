# NLP service (Azure)

FastAPI service that clusters/summarizes feedback (`app.py`) and groups +
routes attendee questions to speakers. Called by `main-app` server-side via
`NLP_SERVICE_URL` (see `main-app/src/lib/supabase/submit-question.ts`,
`decide-routing.ts`, and the `/api/feedback/topics*` / `/api/questions/groups/refresh`
routes).

## Local dev

```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

Needs `SUPABASE_URL` and `SUPABASE_KEY` in `nlp-service/.env` (separate from
`main-app`'s `NEXT_PUBLIC_SUPABASE_*` vars — same project, service-role key
so it can write `question_groups`/`question_routing`/`feedback_topics*`
directly). Point `main-app/.env`'s `NLP_SERVICE_URL` at
`http://localhost:8080` to test against it (this is already the default
when the var is unset). Port 8080 is arbitrary — chosen to match
`sync-server-azure`'s port for consistency, not because of any actual
collision risk (each Container App gets its own external URL regardless of
internal target port).

## Deploy to Azure Container Apps

Run from this directory. These touch your actual Azure subscription, so run
them yourself rather than handing off:

Actual resource group and ACR already exist in this subscription
(confirmed via the Portal, not guessed): resource group
`app-etnyre-supplier-prod_group`, environment
`managedEnvironment-appetnyresuppli-b2e7`, registry
`growthmachine-are9ehaxdce5cnaa.azurecr.io` — reuse all three rather than
creating new ones.

```bash
# Build & push the image (from this directory)
az acr build --registry growthmachine-are9ehaxdce5cnaa --image nlp-service:latest .

# Deploy
az containerapp create \
  --name nlp-service \
  --resource-group app-etnyre-supplier-prod_group \
  --environment managedEnvironment-appetnyresuppli-b2e7 \
  --image growthmachine-are9ehaxdce5cnaa.azurecr.io/nlp-service:latest \
  --target-port 8080 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 1 \
  --cpu 1 --memory 2Gi
```

`--cpu 1 --memory 2Gi` is the practical floor — this image loads several
transformer models (BART summarizer, two sentence-transformers embedding
models) into memory, unlike the lightweight Node sync server, so going
lower risks OOM kills. Bump to `--cpu 2 --memory 4Gi` if you see restarts.

`--min-replicas 0` scales to zero (and to $0 billed) when idle, which fits
this service's actual usage — only needed during the summit itself, not
continuously. Trade-off: the first request after being idle is slow
(20-60s+) while models load into memory, and `submit-question.ts`/
`decide-routing.ts` swallow that as a silent best-effort failure rather
than surfacing it — the manual "Regroup" button in analytics covers
retrying. Set `--min-replicas 1` instead if that cold-start risk matters
more than the idle cost during the event window.

Set the Supabase creds as secrets rather than baking them into the image:

```bash
az containerapp update --name nlp-service --resource-group app-etnyre-supplier-prod_group \
  --set-env-vars SUPABASE_URL=secretref:supabase-url SUPABASE_KEY=secretref:supabase-key \
  --secrets supabase-url=<your-supabase-url> supabase-key=<your-service-role-key>
```

`az containerapp create` prints the app's URL, e.g.
`https://nlp-service.<region>.azurecontainerapps.io`. Put it in `main-app`'s
environment config (Vercel project settings, or wherever `main-app` is
deployed — not `main-app/.env`, which is local-only and gitignored):

```
NLP_SERVICE_URL=https://nlp-service.<region>.azurecontainerapps.io
```

## Continuous deploy

`.github/workflows/nlpservice-AutoDeployTrigger.yml` rebuilds and redeploys
on every push to `main` that touches `nlp-service/**`, mirroring
`growthmachinesync-AutoDeployTrigger-*.yml`. It reuses the same GitHub
secrets already set up for `growthmachinesync`
(`GROWTHMACHINESYNC_AZURE_CLIENT_ID`/`_TENANT_ID`/`_SUBSCRIPTION_ID` and
`GROWTHMACHINESYNC_REGISTRY_USERNAME`/`_PASSWORD`) rather than needing a
second set — that identity already has `Contributor` on this whole
resource group (not just the one Container App) and `AcrPush` on this
registry, confirmed via its Azure role assignments, so no new secrets or
permission grants are needed. No action needed here if those already
work for `growthmachinesync`.

## Health check

`GET /healthz` returns `{"ok": true}` — point Container Apps' health probe
at this path.

## Cold start / model downloads

Models download from Hugging Face on first use rather than at build time,
so the first request after a deploy or restart will be slow and needs
outbound internet access from the container. If cold start becomes a
problem, consider baking the models into the image at build time or
attaching a persistent volume for the Hugging Face cache
(`~/.cache/huggingface`).
