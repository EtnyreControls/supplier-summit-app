const NLP_SERVICE_URL = "http://localhost:8001";

export async function POST() {
  try {
    const res = await fetch(`${NLP_SERVICE_URL}/api/feedback/topics/refresh`, {
      method: "POST",
      cache: "no-store",
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json(
      { error: "nlp-service is unreachable at http://localhost:8001" },
      { status: 502 },
    );
  }
}
