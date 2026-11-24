// The colour system for every workflow layer. Each layer keeps its colour everywhere in the app.
export const LAYERS = [
  { id: "acquire", n: 1, name: "Lead Acquisition", short: "Acquire", emoji: "🛰️", color: "#38bdf8", grad: "from-sky-400 to-cyan-500", tech: "LangGraph · prospect / normalize", desc: "Prospector agent sources leads for your target market, or imports your CSV." },
  { id: "enrich", n: 2, name: "Enrichment", short: "Enrich", emoji: "🧬", color: "#a78bfa", grad: "from-violet-400 to-purple-500", tech: "LangGraph · enrich", desc: "AI infers motivation, intent strength, signals and likely objections." },
  { id: "score", n: 3, name: "Scoring", short: "Score", emoji: "🎯", color: "#fbbf24", grad: "from-amber-300 to-orange-500", tech: "LangGraph · score", desc: "Transparent 100-pt score: budget, timeline, financing, engagement, intent." },
  { id: "route", n: 4, name: "Routing & Nurture", short: "Route", emoji: "🔀", color: "#34d399", grad: "from-emerald-400 to-teal-500", tech: "LangGraph · route + outreach", desc: "Hot → AI call queue, warm → nurture, cold → drip; personalised outreach drafted." },
  { id: "voice", n: 5, name: "AI Voice Qualification", short: "Call", emoji: "📞", color: "#f472b6", grad: "from-pink-400 to-rose-500", tech: "Microsoft Agent Framework · Ava + tools", desc: "Voice agent calls the prospect, runs BANT discovery and books viewings." },
  { id: "convert", n: 6, name: "Conversion Intelligence", short: "Convert", emoji: "🏆", color: "#a3e635", grad: "from-lime-300 to-green-500", tech: "Microsoft Agent Framework · ConversionAnalyst", desc: "Analyst agent scores conversion probability and the next best action." },
  { id: "assist", n: 7, name: "AI Assistant (BYOK)", short: "Assist", emoji: "🤖", color: "#818cf8", grad: "from-indigo-400 to-blue-500", tech: "LangChain · Groq (your key)", desc: "Ask anything about your pipeline, scripts and strategy." },
] as const;

export const STAGE_META: Record<string, { label: string; color: string; emoji: string }> = {
  new: { label: "New", color: "#3987e5", emoji: "✨" },
  qualified: { label: "Qualified", color: "#9085e9", emoji: "🎯" },
  contacted: { label: "AI Called", color: "#d55181", emoji: "📞" },
  appointment: { label: "Viewing Booked", color: "#c98500", emoji: "🏡" },
  negotiation: { label: "Negotiation", color: "#d95926", emoji: "🤝" },
  client: { label: "Client", color: "#0ca30c", emoji: "🏆" },
  lost: { label: "Lost", color: "#6b7280", emoji: "🗃️" },
};

export const TEMP_META = {
  hot: { label: "Hot", emoji: "🔥", cls: "bg-rose-500/15 text-rose-300 ring-rose-400/40" },
  warm: { label: "Warm", emoji: "🌤️", cls: "bg-amber-500/15 text-amber-200 ring-amber-400/40" },
  cold: { label: "Cold", emoji: "❄️", cls: "bg-sky-500/15 text-sky-200 ring-sky-400/40" },
} as const;

// Validated categorical palette (dark surface) for charts — fixed order.
export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];
