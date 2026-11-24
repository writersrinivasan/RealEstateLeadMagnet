import { AGENT_SERVICE_URL } from "@/lib/llm";

/** Is the Microsoft Agent Framework service reachable? */
export async function GET() {
  try {
    const r = await fetch(`${AGENT_SERVICE_URL}/health`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    return Response.json({ maf: r.ok, ...(r.ok ? await r.json() : {}) });
  } catch {
    return Response.json({ maf: false });
  }
}
