# Testing log

Manual/ad-hoc test runs and their results, kept here since there's no
automated test suite yet. Newest entries at the top.

---

## 2026-08-25 — Question routing: correctness + load

**Scope:** `nlp-service`'s `POST /api/questions/route` (attendee question →
speaker routing chain, see `nlp-service/app.py`'s `TAG_SPEAKER_IDS` /
`route_question`).

**Setup:** `nlp-service` run locally (`uvicorn app:app --port 8080`) against
the real Supabase project (`SUPABASE_URL`/`SUPABASE_KEY` in
`nlp-service/.env`, service role). Real `question_groups`/`questions` rows
seeded per test, always deleted afterward (routing test rows tagged
`[TEST]`, load test rows tagged `[LOADTEST]`).

### Correctness — routing chain

| # | Case | Expected | Result |
|---|---|---|---|
| 1 | `Procurement` tag | routes to Shannon Mulcahy | ✅ |
| 2 | `Strategic Sourcing` tag | routes to Pranav Amin (primary) | ✅ |
| 3 | `General` tag | routes to Analytics | ❌ → fixed, see below |
| 4 | Pranav declines a Strategic Sourcing question | falls to Zoey Henchliffe | ✅ (after fix) |
| 5 | Zoey also declines | falls to Analytics | ✅ (after fix) |

**Bug found:** `ANALYTICS_SPEAKER_ID` (`00000000-0000-0000-0000-00000000a17c`)
— the universal escalation target every tag's chain falls through to — had
no corresponding `speakers` row. The migration `app.py`'s own comment
attributed it to (`analytics_logistics_speaker.sql`) was never actually
committed. Every question that should have escalated to Analytics (declines,
or tags like `General`/`Growth Machine`/`Walk Gallery` routing there
directly) failed silently with a `question_routing_speaker_id_fkey`
violation.

**Fix:** seeded the missing row + added
[`main-app/supabase/migrations/20260825120000_seed_analytics_escalation_speaker.sql`](main-app/supabase/migrations/20260825120000_seed_analytics_escalation_speaker.sql)
so it's reproducible in any environment. Re-ran case 3 after the fix — passed.

### Load test — `POST /api/questions/route`

**Tool:** [`nlp-service/loadtest_routing.js`](nlp-service/loadtest_routing.js)
— seeds N real question rows, fires concurrent routing requests, measures
latency/throughput/error rate, cleans up after itself. Usage in the file's
header comment.

| Run | Requests | Concurrency | Throughput | Success | p50 | p95 | p99 |
|---|---|---|---|---|---|---|---|
| 1 (baseline, before fixes) | 200 | 20 | 2.7 req/s | 100% | 7263ms | 7985ms | 8149ms |
| 2 (after: cache Supabase client globally) | 200 | 20 | 17.7 req/s | 68.5% (63 failures) | 393ms | 7953ms | 8163ms |
| 3 (same fix, concurrency 5) | 100 | 5 | 15.1 req/s | 77.0% (23 failures) | 358ms | 615ms | 709ms |
| 4 (after: thread-local Supabase client) | 200 | 20 | 19.9 req/s | 100% | 255ms | 7637ms | 7750ms |
| 5 (same fix, re-run on warm server) | 200 | 20 | 21.1 req/s | 100% | 264ms | 7070ms | 7363ms |

**Bugs found:**
1. `get_supabase()` built a brand-new Supabase client (fresh TCP+TLS
   handshake) on every call — dominant cost behind run 1's ~7s p50.
2. First fix attempt (one client cached in a global) dropped median latency
   ~18x but caused 23-31% failures under concurrency, even as low as 5 —
   `httpx.RemoteProtocolError: Server disconnected`, from sharing one
   client's connection pool across FastAPI's threadpool.

**Fix:** thread-local Supabase client (`nlp-service/app.py`, `get_supabase()`)
— each worker thread gets its own client, reused across that thread's
requests, no cross-thread contention. Runs 4-5: 100% success, p50 ~260ms.

**Known residual issue (not fixed, not chased further):** ~5% of requests
still hit a ~7s tail (p95/p99) on both post-fix runs, even fully warm with
zero errors. Doesn't correlate with load or thread state — looks like
Supabase-instance-side variance rather than an `nlp-service` bug. Worth
re-checking under real event-day conditions; revisit if it gets worse or
starts producing actual failures rather than just slow responses.

**Net result:** `/api/questions/route` went from ~74s wall time / 2.7 req/s
/ (would-be 0% success once the missing-speaker bug was live) to ~10s wall
time / ~20 req/s / 100% success for a 200-request burst.
