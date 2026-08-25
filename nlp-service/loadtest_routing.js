// Load test for POST /api/questions/route (nlp-service).
//
// Simulates a burst of attendees submitting questions in a short window
// (e.g. right after a talk ends) — inserts N real question_groups/questions
// rows, fires concurrent routing requests at nlp-service, measures
// latency/throughput/error rate, then deletes everything it created.
//
// Usage: run nlp-service locally first (it needs SUPABASE_URL/KEY in
// nlp-service/.env — see nlp-service/README.md), then, from main-app (this
// script needs @supabase/supabase-js from main-app's node_modules, so it
// won't resolve run from nlp-service directly):
//
//   cp ../nlp-service/loadtest_routing.js .
//   node loadtest_routing.js [totalRequests] [concurrency]
//   node loadtest_routing.js 200 20
//   rm loadtest_routing.js

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const TOTAL = parseInt(process.argv[2] || "200", 10);
const CONCURRENCY = parseInt(process.argv[3] || "20", 10);
const NLP_URL = process.env.NLP_SERVICE_URL || "http://localhost:8080";

const envPath = path.join(__dirname, "..", "main-app", ".env");
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// A valid FK for submitter_id — RLS is bypassed via the service-role client,
// so any real user works; reused rather than creating throwaway users.
const SUBMITTER_ID = "7fd2d155-0077-4b5d-bb60-5351a8af99a8";

const TOPICS = ["General", "Procurement", "Strategic Sourcing", "Growth Machine"];

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function seedQuestions(n) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const topic = TOPICS[i % TOPICS.length];
    rows.push({ topic, composed_question: `[LOADTEST ${i}] question under ${topic}`, status: "pending", checked: false });
  }
  // Batch-insert groups, then questions referencing each group 1:1
  // (route_question expects one pending question per group here, mirroring
  // a real singleton submission).
  const { data: groups, error: gErr } = await supabase.from("question_groups").insert(rows).select("group_id, topic, composed_question");
  if (gErr) throw gErr;

  const qRows = groups.map((g) => ({
    topic: g.topic,
    submission_info: g.composed_question,
    submitter_id: SUBMITTER_ID,
    group_id: g.group_id,
    status: "pending",
    checked: false,
    is_anonymous: false,
  }));
  const { data: questions, error: qErr } = await supabase.from("questions").insert(qRows).select("question_id, group_id, topic, submission_info");
  if (qErr) throw qErr;
  return questions;
}

async function cleanup(questions) {
  const questionIds = questions.map((q) => q.question_id);
  const groupIds = [...new Set(questions.map((q) => q.group_id))];
  await supabase.from("question_routing").delete().in("question_id", questionIds);
  await supabase.from("questions").delete().in("question_id", questionIds);
  await supabase.from("question_groups").delete().in("group_id", groupIds);
}

async function routeOne(q) {
  const start = Date.now();
  try {
    const res = await fetch(`${NLP_URL}/api/questions/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: q.question_id, question_text: q.submission_info }),
    });
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => null);
    return { ok: res.ok && body?.status === "routed", httpStatus: res.status, routeStatus: body?.status, elapsed };
  } catch (err) {
    return { ok: false, httpStatus: 0, routeStatus: "network_error", elapsed: Date.now() - start, error: String(err) };
  }
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runner));
  return results;
}

(async () => {
  console.log(`Seeding ${TOTAL} test questions...`);
  const questions = await seedQuestions(TOTAL);
  console.log(`Seeded. Firing ${TOTAL} requests at ${NLP_URL}/api/questions/route with concurrency=${CONCURRENCY}...`);

  const wallStart = Date.now();
  const results = await runWithConcurrency(questions, routeOne, CONCURRENCY);
  const wallElapsed = Date.now() - wallStart;

  const latencies = results.map((r) => r.elapsed).sort((a, b) => a - b);
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);

  const failureBreakdown = {};
  for (const f of failures) {
    const key = f.routeStatus || `http_${f.httpStatus}`;
    failureBreakdown[key] = (failureBreakdown[key] || 0) + 1;
  }

  console.log("\n=== Load test results ===");
  console.log(`Total requests:     ${TOTAL}`);
  console.log(`Concurrency:        ${CONCURRENCY}`);
  console.log(`Wall time:          ${(wallElapsed / 1000).toFixed(2)}s`);
  console.log(`Throughput:         ${(TOTAL / (wallElapsed / 1000)).toFixed(1)} req/s`);
  console.log(`Success:            ${successes.length} (${((successes.length / TOTAL) * 100).toFixed(1)}%)`);
  console.log(`Failure:            ${failures.length}`);
  if (Object.keys(failureBreakdown).length) console.log(`Failure breakdown:  ${JSON.stringify(failureBreakdown)}`);
  console.log(`Latency min/p50/p95/p99/max (ms): ${latencies[0]} / ${percentile(latencies, 50)} / ${percentile(latencies, 95)} / ${percentile(latencies, 99)} / ${latencies[latencies.length - 1]}`);

  console.log("\nCleaning up test data...");
  await cleanup(questions);
  console.log("Done.");
})().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
