const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL ?? "http://localhost:8080";

export async function GET() {
  try {
    const res = await fetch(`${NLP_SERVICE_URL}/api/feedback/topics`, {
      cache: "no-store",
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json(
      { error: `nlp-service is unreachable at ${NLP_SERVICE_URL}` },
      { status: 502 },
    );
  }
}
