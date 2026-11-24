import { callAgentService } from "@/lib/agentService";
import { missingKey, readByok } from "@/lib/llm";
import type { Lead } from "@/lib/types";

/** Real phone call via Twilio, driven by the Microsoft Agent Framework service. */
export async function POST(req: Request) {
  const byok = readByok(req);
  if (!byok.apiKey) return missingKey();
  const body = (await req.json()) as { lead: Lead; to: string };
  const r = await callAgentService<{ callSid: string; callId: string }>("/twilio/outbound", body, byok);
  if (!r) return Response.json({ error: "Agent service offline — start agent-service to place real calls." }, { status: 503 });
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json(r.data);
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("callId");
  const { AGENT_SERVICE_URL } = await import("@/lib/llm");
  try {
    const res = await fetch(`${AGENT_SERVICE_URL}/twilio/calls/${id}`, { cache: "no-store" });
    return Response.json(await res.json(), { status: res.status });
  } catch {
    return Response.json({ error: "Agent service offline" }, { status: 503 });
  }
}
