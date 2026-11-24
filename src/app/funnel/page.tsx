"use client";

import Link from "next/link";
import { useState } from "react";
import { FunnelInfographic, funnelCounts } from "@/components/FunnelInfographic";
import { useApp } from "@/components/Providers";
import { Card, TempBadge } from "@/components/ui";
import { STAGE_META } from "@/lib/layers";
import { fmtMoney } from "@/lib/scoring";
import { FUNNEL_STAGES, type FunnelStage } from "@/lib/types";

const COLS: FunnelStage[] = [...FUNNEL_STAGES, "lost"];

export default function FunnelPage() {
  const { leads, updateLead, hydrated } = useApp();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<FunnelStage | null>(null);
  if (!hydrated) return null;

  const counts = funnelCounts(leads);
  const overall = counts[0].count ? Math.round((counts[counts.length - 1].count / counts[0].count) * 100) : 0;
  const leak = counts.slice(1).map((c, i) => ({ from: counts[i].stage, to: c.stage, drop: counts[i].count - c.count }))
    .sort((a, b) => b.drop - a.drop)[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">🔻 Lead funnel</h1>
        <p className="text-slate-400">Drag cards between stages. AI calls move leads automatically based on the conversion verdict.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" accent="#34d399">
          <FunnelInfographic leads={leads} />
        </Card>
        <div className="space-y-4">
          <Card accent="#0ca30c">
            <div className="text-xs uppercase tracking-wider text-slate-400">Lead → client conversion</div>
            <div className="mt-1 text-5xl font-bold text-white">{overall}%</div>
            <div className="text-sm text-slate-400">{counts.at(-1)!.count} of {counts[0].count} leads became clients</div>
          </Card>
          <Card accent="#d95926">
            <div className="text-xs uppercase tracking-wider text-slate-400">Biggest leak</div>
            {leak && leak.drop > 0 ? (
              <>
                <div className="mt-1 text-lg font-semibold text-white">
                  {STAGE_META[leak.from].emoji} {STAGE_META[leak.from].label} → {STAGE_META[leak.to].emoji} {STAGE_META[leak.to].label}
                </div>
                <div className="text-sm text-slate-400">{leak.drop} leads dropped here. {leak.to === "contacted" ? "Queue them for AI calls." : leak.to === "appointment" ? "Have Ava push for a viewing." : "Follow up with a personalised offer."}</div>
              </>
            ) : <div className="mt-1 text-slate-400">No leaks yet 🎉</div>}
          </Card>
          <Card accent="#9085e9">
            <div className="text-xs uppercase tracking-wider text-slate-400">Stage conversion</div>
            <div className="mt-2 space-y-1.5">
              {counts.slice(1).map((c, i) => {
                const pct = counts[i].count ? Math.round((c.count / counts[i].count) * 100) : 0;
                return (
                  <div key={c.stage} className="flex items-center gap-2 text-xs">
                    <span className="w-28 text-slate-300">{STAGE_META[c.stage].emoji} {STAGE_META[c.stage].label}</span>
                    <div className="h-2 flex-1 rounded-full bg-white/10"><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: STAGE_META[c.stage].color }} /></div>
                    <span className="w-9 text-right tabular-nums text-slate-400">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">
        {COLS.map((s) => {
          const m = STAGE_META[s];
          const items = leads.filter((l) => l.stage === s).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          return (
            <div
              key={s}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver(null)}
              onDrop={() => { if (drag) updateLead(drag, { stage: s }); setDrag(null); setOver(null); }}
              className={`w-64 shrink-0 rounded-2xl border p-3 transition ${over === s ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.03]"}`}
            >
              <div className="mb-3 flex items-center justify-between rounded-xl px-3 py-2" style={{ background: `${m.color}33` }}>
                <span className="text-sm font-semibold text-white">{m.emoji} {m.label}</span>
                <span className="rounded-full bg-black/30 px-2 text-xs text-white">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDrag(l.id)}
                    className="cursor-grab rounded-xl border border-white/10 bg-slate-900/80 p-3 text-xs shadow active:cursor-grabbing"
                    style={{ boxShadow: `inset 3px 0 0 ${m.color}` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-white">{l.name}</div>
                      <span className="font-bold tabular-nums text-white">{l.score}</span>
                    </div>
                    <div className="mt-0.5 text-slate-400">{l.intent} · {l.propertyType} · {fmtMoney(l.budgetMax)}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <TempBadge t={l.temperature} />
                      {l.call?.assessment && <span className="text-pink-300">📞 {l.call.assessment.conversionProbability}%</span>}
                    </div>
                    <div className="mt-2 flex gap-1">
                      <select
                        aria-label="Move to stage"
                        value={l.stage}
                        onChange={(e) => updateLead(l.id, { stage: e.target.value as FunnelStage })}
                        className="flex-1 rounded-md border border-white/10 bg-slate-950 px-1 py-0.5 text-[11px] text-slate-300"
                      >
                        {COLS.map((c) => <option key={c} value={c}>{STAGE_META[c].label}</option>)}
                      </select>
                      <Link href={`/voice?lead=${l.id}`} className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[11px] text-pink-200">📞</Link>
                    </div>
                  </div>
                ))}
                {!items.length && <div className="py-6 text-center text-xs text-slate-500">Drop leads here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
