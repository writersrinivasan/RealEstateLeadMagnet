import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ChatGroq } from "@langchain/groq";
import { llmJson } from "../llm";
import { scoreLead } from "../scoring";
import type { Criteria, Financing, Intent, Lead, PipelineLog } from "../types";
import { LEAD_SOURCES } from "../types";

/**
 * LangGraph lead pipeline
 *
 *   START ─┬─(imported leads?)─▶ normalize ─┐
 *          └─────────────────▶ prospect ───┴─▶ enrich ─▶ score ─▶ route ─▶ outreach ─▶ END
 */

const State = Annotation.Root({
  criteria: Annotation<Criteria>(),
  imported: Annotation<Partial<Lead>[]>({ reducer: (_a, b) => b, default: () => [] }),
  leads: Annotation<Lead[]>({ reducer: (_a, b) => b, default: () => [] }),
  log: Annotation<PipelineLog[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});
type S = typeof State.State;

const log = (node: string, message: string): PipelineLog[] => [
  { node, message, at: new Date().toISOString() },
];
const uid = () => Math.random().toString(36).slice(2, 10);
const INTENTS: Intent[] = ["buy", "sell", "rent", "invest"];
const FIN: Financing[] = ["cash", "pre-approved", "needs-mortgage", "unknown"];
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function normalizeLead(raw: Partial<Lead> & Record<string, unknown>, c: Criteria): Lead {
  const intent = INTENTS.includes(raw.intent as Intent) ? (raw.intent as Intent) : c.intent === "mixed" ? "buy" : c.intent;
  return {
    id: String(raw.id || uid()),
    name: String(raw.name || "Unknown Prospect"),
    phone: String(raw.phone || ""),
    email: String(raw.email || ""),
    city: String(raw.city || c.city),
    neighborhood: String(raw.neighborhood || ""),
    intent,
    propertyType: String(raw.propertyType || c.propertyType),
    budgetMin: num(raw.budgetMin, c.budgetMin),
    budgetMax: num(raw.budgetMax, c.budgetMax),
    timelineMonths: num(raw.timelineMonths, 6),
    financing: FIN.includes(raw.financing as Financing) ? (raw.financing as Financing) : "unknown",
    source: String(raw.source || "Website"),
    engagement: Math.min(10, Math.max(0, num(raw.engagement, 3))),
    notes: String(raw.notes || ""),
    stage: "new",
    createdAt: new Date().toISOString(),
  };
}

export function buildLeadGraph(model: ChatGroq) {
  // 1a. Imported CSV leads -> clean records
  async function normalize(s: S): Promise<Partial<S>> {
    const leads = s.imported.map((r) => normalizeLead(r as Lead & Record<string, unknown>, s.criteria));
    return { leads, log: log("normalize", `Normalized ${leads.length} imported leads`) };
  }

  // 1b. Prospector agent -> realistic demo prospects for the target market
  async function prospect(s: S): Promise<Partial<S>> {
    const c = s.criteria;
    const out = await llmJson<{ leads: Record<string, unknown>[] }>(
      model,
      `You are a real-estate lead prospecting agent. Produce realistic, clearly fictional demo prospects (fake names, 555 phone numbers, example.com emails) for an agent's target market. Vary sources among: ${LEAD_SOURCES.join(", ")}. Vary quality: some hot, some lukewarm, some cold.`,
      `Target market: ${c.city}; intent: ${c.intent}; property type: ${c.propertyType}; budget ${c.budgetMin}-${c.budgetMax} USD.
Return {"leads":[...]} with exactly ${c.count} items. Each item: name, phone, email, neighborhood (real neighborhood in ${c.city}), intent (buy|sell|rent|invest), propertyType, budgetMin (number), budgetMax (number), timelineMonths (number), financing (cash|pre-approved|needs-mortgage|unknown), source, engagement (0-10, number of touches like site visits, email opens), notes (one sentence of what they did/said).`,
    );
    const leads = (out.leads || []).slice(0, c.count).map((r) => normalizeLead(r, c));
    return { leads, log: log("prospect", `Prospector agent sourced ${leads.length} prospects in ${c.city}`) };
  }

  // 2. Enrichment agent -> motivation, intent strength, signals, likely objections
  async function enrich(s: S): Promise<Partial<S>> {
    const brief = s.leads.map((l) => ({
      id: l.id, intent: l.intent, type: l.propertyType, budget: [l.budgetMin, l.budgetMax],
      timelineMonths: l.timelineMonths, financing: l.financing, source: l.source, engagement: l.engagement, notes: l.notes,
    }));
    const out = await llmJson<{ items: { id: string; motivation: string; intentStrength: number; signals: string[]; likelyObjections: string[] }[] }>(
      model,
      "You are a real-estate lead enrichment analyst. Infer each prospect's motivation and buying/selling intent from behaviour.",
      `Leads: ${JSON.stringify(brief)}
Return {"items":[{"id","motivation"(short phrase),"intentStrength"(0-10),"signals"(2-3 short intent signals),"likelyObjections"(1-2 short)}]} — one per lead, same ids.`,
    );
    const byId = new Map((out.items || []).map((i) => [String(i.id), i]));
    const leads = s.leads.map((l) => {
      const e = byId.get(l.id);
      return e
        ? { ...l, motivation: e.motivation, intentStrength: num(e.intentStrength, 5), signals: e.signals ?? [], likelyObjections: e.likelyObjections ?? [] }
        : { ...l, intentStrength: 5 };
    });
    return { leads, log: log("enrich", `Enriched ${byId.size}/${leads.length} leads with motivation & intent signals`) };
  }

  // 3. Scoring (deterministic, explainable)
  async function score(s: S): Promise<Partial<S>> {
    const leads = s.leads
      .map((l) => ({ ...l, ...scoreLead(l, s.criteria) }))
      .map((l) => ({ ...l, stage: l.temperature === "cold" ? l.stage : ("qualified" as const) }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const hot = leads.filter((l) => l.temperature === "hot").length;
    return { leads, log: log("score", `Scored ${leads.length} leads · ${hot} hot`) };
  }

  // 4. Router: hot → AI voice call queue, warm → nurture, cold → drip
  async function route(s: S): Promise<Partial<S>> {
    const counts = { call: 0, nurture: 0, drip: 0 };
    s.leads.forEach((l) => l.route && counts[l.route]++);
    return {
      log: log("route", `Routed → 📞 call queue ${counts.call} · 🌱 nurture ${counts.nurture} · 💧 drip ${counts.drip}`),
    };
  }

  // 5. Outreach copywriter for hot + warm leads
  async function outreach(s: S): Promise<Partial<S>> {
    const targets = s.leads.filter((l) => l.route !== "drip");
    if (!targets.length) return { log: log("outreach", "No hot/warm leads to write outreach for") };
    const out = await llmJson<{ items: { id: string; message: string }[] }>(
      model,
      "You are a top-producing real-estate agent's copywriter. Write warm, specific, 2-sentence first-touch SMS messages. No emojis spam, no pressure.",
      `Leads: ${JSON.stringify(targets.map((l) => ({ id: l.id, name: l.name, intent: l.intent, type: l.propertyType, area: l.neighborhood, motivation: l.motivation, route: l.route })))}
Return {"items":[{"id","message"}]}.`,
    );
    const byId = new Map((out.items || []).map((i) => [String(i.id), i.message]));
    const leads = s.leads.map((l) => (byId.has(l.id) ? { ...l, outreach: byId.get(l.id) } : l));
    return { leads, log: log("outreach", `Drafted ${byId.size} personalised outreach messages`) };
  }

  return new StateGraph(State)
    .addNode("normalize", normalize)
    .addNode("prospect", prospect)
    .addNode("enrich", enrich)
    .addNode("score", score)
    .addNode("route", route)
    .addNode("outreach", outreach)
    .addConditionalEdges(START, (s: S) => (s.imported.length ? "normalize" : "prospect"), ["normalize", "prospect"])
    .addEdge("normalize", "enrich")
    .addEdge("prospect", "enrich")
    .addEdge("enrich", "score")
    .addEdge("score", "route")
    .addEdge("route", "outreach")
    .addEdge("outreach", END)
    .compile();
}
