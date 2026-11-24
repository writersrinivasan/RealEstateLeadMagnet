"use client";

import Link from "next/link";
import { Donut, HBar, VBar } from "@/components/Charts";
import { FunnelInfographic } from "@/components/FunnelInfographic";
import { useApp } from "@/components/Providers";
import { Card, Meter, SectionTitle, Stat, TempBadge } from "@/components/ui";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";
import { LAYERS, SERIES } from "@/lib/layers";
import { fmtMoney } from "@/lib/scoring";

export default function Dashboard() {
  const { leads, hydrated } = useApp();
  if (!hydrated) return <div className="text-slate-400">Loading…</div>;

  const hot = leads.filter((l) => l.temperature === "hot");
  const called = leads.filter((l) => l.call);
  const assessed = called.filter((l) => l.call?.assessment);
  const avgConv = assessed.length
    ? Math.round(assessed.reduce((a, l) => a + (l.call!.assessment!.conversionProbability || 0), 0) / assessed.length)
    : 0;
  const clients = leads.filter((l) => l.stage === "client").length;
  const pipelineValue = leads.filter((l) => l.stage !== "lost" && l.intent !== "rent").reduce((a, l) => a + l.budgetMax, 0);

  const bySource = Object.entries(
    leads.reduce<Record<string, number>>((a, l) => ((a[l.source] = (a[l.source] || 0) + 1), a), {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const temp = [
    { name: "🔥 Hot", value: leads.filter((l) => l.temperature === "hot").length, color: "#e66767" },
    { name: "🌤️ Warm", value: leads.filter((l) => l.temperature === "warm").length, color: "#c98500" },
    { name: "❄️ Cold", value: leads.filter((l) => l.temperature === "cold").length, color: "#3987e5" },
  ];

  const buckets = [0, 20, 40, 60, 80].map((lo, i) => ({
    name: `${lo}-${lo + 19 + (lo === 80 ? 1 : 0)}`,
    value: leads.filter((l) => (l.score ?? 0) >= lo && (l.score ?? 0) < lo + 20 + (lo === 80 ? 1 : 0)).length,
    color: ["#3987e5", "#9085e9", "#c98500", "#d95926", "#e66767"][i],
  }));

  const n = Math.max(1, leads.length);
  const avg = (k: "budget" | "timeline" | "financing" | "engagement" | "intent") =>
    Math.round(leads.reduce((a, l) => a + (l.breakdown?.[k] ?? 0), 0) / n);

  const intents = (["buy", "sell", "invest", "rent"] as const).map((k) => ({
    name: { buy: "🏡 Buyers", sell: "🪧 Sellers", invest: "📈 Investors", rent: "🔑 Renters" }[k],
    value: leads.filter((l) => l.intent === k).length,
  }));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/30 via-indigo-600/20 to-cyan-500/20 p-6 md:p-8">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-orange-400/30 blur-3xl" />
        <div className="relative">
          <div className="text-sm font-medium text-pink-200">Agentic real-estate lead funnel</div>
          <h1 className="mt-1 text-3xl font-bold text-white md:text-4xl">
            Find leads → qualify with AI calls →{" "}
            <span className="bg-gradient-to-r from-yellow-200 via-orange-300 to-pink-300 bg-clip-text text-transparent">convert to clients</span>
          </h1>
          <p className="mt-2 max-w-2xl text-slate-300">
            A LangGraph pipeline sources, enriches, scores and routes leads. A Microsoft Agent Framework voice agent calls the hot ones and predicts who will convert.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/leads" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">🛰️ Generate leads</Link>
            <Link href="/voice" className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-400">📞 Start AI call</Link>
            <Link href="/workflow" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/15">🧭 See the workflow</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total leads" value={leads.length} emoji="🛰️" color={LAYERS[0].color} sub="in your pipeline" />
        <Stat label="Hot leads" value={hot.length} emoji="🔥" color="#f43f5e" sub="score ≥ 70 → call queue" />
        <Stat label="AI calls" value={called.length} emoji="📞" color={LAYERS[4].color} sub={`${assessed.length} assessed`} />
        <Stat label="Avg conversion" value={`${avgConv}%`} emoji="🎯" color={LAYERS[2].color} sub="predicted after calls" />
        <Stat label="Clients" value={clients} emoji="🏆" color={LAYERS[5].color} sub={`${Math.round((clients / n) * 100)}% win rate`} />
        <Stat label="Pipeline value" value={fmtMoney(pipelineValue)} emoji="💰" color={LAYERS[3].color} sub="sum of max budgets" />
      </div>

      <Card>
        <SectionTitle emoji="🧭" title="Workflow at a glance" sub="Every layer has its own colour across the app" />
        <WorkflowDiagram compact />
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" accent="#34d399">
          <SectionTitle emoji="🔻" title="Lead funnel" sub="Leads that reached each stage, with stage-to-stage conversion" />
          <FunnelInfographic leads={leads} />
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card accent="#f43f5e">
            <SectionTitle emoji="🌡️" title="Lead temperature" />
            <Donut data={temp} height={170} />
          </Card>
          <Card accent={LAYERS[2].color}>
            <SectionTitle emoji="🎯" title="What drives the score" sub="Average points per factor" />
            <div className="space-y-3">
              <Meter label="💵 Budget fit" value={avg("budget")} max={25} color={SERIES[0]} />
              <Meter label="⏱️ Timeline" value={avg("timeline")} max={25} color={SERIES[1]} />
              <Meter label="🏦 Financing" value={avg("financing")} max={20} color={SERIES[2]} />
              <Meter label="👀 Engagement" value={avg("engagement")} max={15} color={SERIES[3]} />
              <Meter label="🧠 Intent (AI)" value={avg("intent")} max={15} color={SERIES[4]} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card accent={LAYERS[0].color}>
          <SectionTitle emoji="📡" title="Lead sources" />
          <HBar data={bySource} color={SERIES[0]} />
        </Card>
        <Card accent={LAYERS[1].color}>
          <SectionTitle emoji="📶" title="Score distribution" />
          <VBar data={buckets} />
        </Card>
        <Card accent={LAYERS[3].color}>
          <SectionTitle emoji="🧩" title="Intent mix" />
          <HBar data={intents} color={SERIES[2]} height={200} />
        </Card>
      </div>

      <Card accent={LAYERS[4].color}>
        <SectionTitle emoji="🔥" title="Call queue — hottest leads" sub="Routed to the AI voice agent by the LangGraph router" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2">Lead</th><th>Intent</th><th>Budget</th><th>Score</th><th>Temp</th><th>Call result</th><th />
              </tr>
            </thead>
            <tbody>
              {[...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 6).map((l) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="py-2.5">
                    <div className="font-medium text-white">{l.name}</div>
                    <div className="text-xs text-slate-400">{l.neighborhood}, {l.city}</div>
                  </td>
                  <td className="capitalize text-slate-300">{l.intent}</td>
                  <td className="text-slate-300">{fmtMoney(l.budgetMin)}–{fmtMoney(l.budgetMax)}</td>
                  <td className="font-semibold tabular-nums text-white">{l.score ?? "—"}</td>
                  <td><TempBadge t={l.temperature} /></td>
                  <td className="text-slate-300">
                    {l.call?.assessment ? `${l.call.assessment.conversionProbability}% · ${l.call.assessment.verdict}` : <span className="text-slate-500">not called</span>}
                  </td>
                  <td className="text-right">
                    <Link href={`/voice?lead=${l.id}`} className="rounded-lg bg-pink-500/20 px-3 py-1 text-xs font-semibold text-pink-200 ring-1 ring-pink-400/40 hover:bg-pink-500/30">
                      📞 Call
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
