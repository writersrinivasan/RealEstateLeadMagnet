import { callAgentService } from "@/lib/agentService";
import { groq, llmJson, missingKey, readByok } from "@/lib/llm";
import type { CallTurn, Lead, QualSignal } from "@/lib/types";
import { VOICE_AGENT_INSTRUCTIONS, leadBrief, transcriptText } from "@/lib/voicePrompts";

interface TurnResult {
  reply: string;
  signals: QualSignal[];
  endCall: boolean;
  engine: string;
}

/** One conversational turn of the AI voice qualification agent. */
export async function POST(req: Request) {
  const byok = readByok(req);
  if (!byok.apiKey) return missingKey();
  const { lead, transcript } = (await req.json()) as { lead: Lead; transcript: CallTurn[] };

  // Primary: Microsoft Agent Framework (Python) agent with tool calling.
  const maf = await callAgentService<TurnResult>("/voice/turn", { lead, transcript }, byok);
  if (maf?.ok) return Response.json(maf.data);
  if (maf && !maf.ok) return Response.json({ error: maf.error }, { status: maf.status });

  // Fallback: same agent persona through LangChain + Groq.
  try {
    const out = await llmJson<{ reply: string; signals?: QualSignal[]; endCall?: boolean }>(
      groq(byok.apiKey, byok.model, 0.6),
      `${VOICE_AGENT_INSTRUCTIONS}\n${leadBrief(lead)}`,
      `Call so far:\n${transcriptText(transcript) || "(call just connected — open the call: greet, introduce yourself, reference how they found us, ask permission to chat)"}
Return {"reply": your next spoken line, "signals": [{"dimension":"budget|authority|need|timeline|objection|appointment","detail":"what the prospect revealed in their LAST message","strength":1-5}] (empty if nothing new), "endCall": boolean}.`,
    );
    return Response.json({
      reply: out.reply,
      signals: Array.isArray(out.signals) ? out.signals : [],
      endCall: !!out.endCall,
      engine: "LangChain fallback · Groq",
    } satisfies TurnResult);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
