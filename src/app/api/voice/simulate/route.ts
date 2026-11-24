import { groq, llmJson, missingKey, readByok } from "@/lib/llm";
import type { CallTurn, Lead } from "@/lib/types";
import { leadBrief, transcriptText } from "@/lib/voicePrompts";

/** Demo mode: an LLM role-plays the prospect so you can watch a full call end to end. */
export async function POST(req: Request) {
  const byok = readByok(req);
  if (!byok.apiKey) return missingKey();
  const { lead, transcript } = (await req.json()) as { lead: Lead; transcript: CallTurn[] };
  try {
    const out = await llmJson<{ reply: string }>(
      groq(byok.apiKey, byok.model, 0.9),
      `Role-play this real-estate prospect answering a phone call from an agent. Stay in character, be realistic (busy, sometimes hesitant, raise a genuine objection if it fits), 1-2 short sentences. ${leadBrief(lead)}`,
      `Call so far:\n${transcriptText(transcript)}\nReturn {"reply": the prospect's next spoken line}.`,
    );
    return Response.json({ reply: out.reply });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
