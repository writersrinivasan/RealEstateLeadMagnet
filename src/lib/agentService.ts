import { AGENT_SERVICE_URL } from "./llm";

/**
 * Call the Python Microsoft Agent Framework service. Returns null when the
 * service is unreachable so the caller can fall back to LangChain + Groq.
 */
export async function callAgentService<T>(
  path: string,
  body: unknown,
  byok: { apiKey: string; model: string },
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string } | null> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-groq-api-key": byok.apiKey, "x-groq-model": byok.model },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return null; // service offline
  }
  if (!res.ok) {
    const text = await res.text();
    let error = text;
    try {
      error = JSON.parse(text).detail ?? text;
    } catch {}
    return { ok: false, status: res.status, error: String(error) };
  }
  return { ok: true, data: (await res.json()) as T };
}
