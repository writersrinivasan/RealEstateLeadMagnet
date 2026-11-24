import { callAgentService } from "@/lib/agentService";
import { groq, llmJson, missingKey, readByok } from "@/lib/llm";
import type { CallAssessment, CallTurn, Lead, QualSignal } from "@/lib/types";
import { ASSESSOR_INSTRUCTIONS, leadBrief, transcriptText } from "@/lib/voicePrompts";

const clamp = (n: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(n) || 0));

function sanitize(a: Partial<CallAssessment>, engine: string): CallAssessment {
  const stages = ["qualified", "contacted", "appointment", "negotiation", "client", "lost"];
  return {
    conversionProbability: clamp(a.conversionProbability, 0, 100),
    verdict: a.verdict || "Needs review",
    bant: {
      budget: clamp(a.bant?.budget, 0, 10),
      authority: clamp(a.bant?.authority, 0, 10),
      need: clamp(a.bant?.need, 0, 10),
      timeline: clamp(a.bant?.timeline, 0, 10),
    },
    sentiment: clamp(a.sentiment, 0, 100),
    objections: a.objections ?? [],
    buyingSignals: a.buyingSignals ?? [],
    nextBestAction: a.nextBestAction || "",
    recommendedStage: (stages.includes(String(a.recommendedStage)) ? a.recommendedStage : "contacted") as CallAssessment["recommendedStage"],
    summary: a.summary || "",
    engine,
  };
}

/** Post-call conversion assessment: will this lead become a client? */
export async function POST(req: Request) {
  const byok = readByok(req);
  if (!byok.apiKey) return missingKey();
  const body = (await req.json()) as { lead: Lead; transcript: CallTurn[]; signals: QualSignal[] };

  const maf = await callAgentService<CallAssessment>("/voice/assess", body, byok);
  if (maf?.ok) return Response.json(sanitize(maf.data, maf.data.engine || "Microsoft Agent Framework"));
  if (maf && !maf.ok) return Response.json({ error: maf.error }, { status: maf.status });

  try {
    const out = await llmJson<Partial<CallAssessment>>(
      groq(byok.apiKey, byok.model, 0.2),
      ASSESSOR_INSTRUCTIONS,
      `${leadBrief(body.lead)}\nSignals captured live: ${JSON.stringify(body.signals)}\nTranscript:\n${transcriptText(body.transcript)}`,
    );
    return Response.json(sanitize(out, "LangChain fallback · Groq"));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
