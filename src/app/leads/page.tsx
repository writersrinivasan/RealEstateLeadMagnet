"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import { ensureOk, useApp } from "@/components/Providers";
import { Button, Card, Meter, SectionTitle, TempBadge } from "@/components/ui";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";
import { LAYERS, SERIES } from "@/lib/layers";
import { fmtMoney } from "@/lib/scoring";
import type { Criteria, Lead, PipelineLog } from "@/lib/types";

const NODE_LAYER: Record<string, string> = { normalize: "acquire", prospect: "acquire", enrich: "enrich", score: "score", route: "route", outreach: "route" };
const ORDER = ["acquire", "enrich", "score", "route"];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((x) => x.trim())) rows.push(cur);
      cur = [];
    } else field += c;
  }
  cur.push(field);
  if (cur.some((x) => x.trim())) rows.push(cur);
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export default function LeadsPage() {
  const { api, settings, setSettingsOpen, setLeads } = useApp();
  const [c, setC] = useState<Criteria>({ city: "Austin, TX", intent: "mixed", propertyType: "Single-family home", budgetMin: 400000, budgetMax: 900000, count: 8 });
  const [imported, setImported] = useState<Record<string, string>[]>([]);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [result, setResult] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run() {
    if (!settings.groqKey) return setSettingsOpen(true);
    setRunning(true); setError(""); setLogs([]); setResult([]); setDone([]); setAdded(false); setActive("acquire");
    try {
      const r = await ensureOk(await api("/api/leads/run", { method: "POST", body: JSON.stringify({ criteria: c, imported }) }));
      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          const ev = JSON.parse(p.slice(6));
          if (ev.type === "node") {
            const layer = NODE_LAYER[ev.node];
            setLogs((l) => [...l, ...ev.log]);
            setDone((d) => Array.from(new Set([...d, layer])));
            const next = ORDER[ORDER.indexOf(layer) + 1];
            setActive(ev.node === "outreach" ? null : ev.node === "route" ? "route" : next ?? null);
          } else if (ev.type === "done") setResult(ev.leads);
          else if (ev.type === "error") throw new Error(ev.error);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
      setActive(null);
    }
  }

  function addToPipeline(replace: boolean) {
    setLeads((ls) => (replace ? result : [...result, ...ls.filter((l) => !result.some((r) => r.id === l.id))]));
    setAdded(true);
  }

  const input = "w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">🛰️ Lead Engine</h1>
        <p className="text-slate-400">Run the LangGraph multi-agent pipeline: acquire → enrich → score → route → outreach.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card accent={LAYERS[0].color} className="lg:col-span-1">
          <SectionTitle emoji="🎯" title="Target market" />
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400">City / market</label>
              <input className={input} value={c.city} onChange={(e) => setC({ ...c, city: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Intent</label>
                <select className={input} value={c.intent} onChange={(e) => setC({ ...c, intent: e.target.value as Criteria["intent"] })}>
                  {["mixed", "buy", "sell", "invest", "rent"].map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400"># leads (max 12)</label>
                <input type="number" min={1} max={12} className={input} value={c.count} onChange={(e) => setC({ ...c, count: +e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">Property type</label>
              <input className={input} value={c.propertyType} onChange={(e) => setC({ ...c, propertyType: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Budget min ($)</label>
                <input type="number" className={input} value={c.budgetMin} onChange={(e) => setC({ ...c, budgetMin: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-slate-400">Budget max ($)</label>
                <input type="number" className={input} value={c.budgetMax} onChange={(e) => setC({ ...c, budgetMax: +e.target.value })} />
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-400">
              <div className="mb-2 font-medium text-slate-300">📥 Import your own leads (CSV, optional)</div>
              <p>Columns: name, phone, email, city, neighborhood, intent, propertyType, budgetMin, budgetMax, timelineMonths, financing, source, engagement, notes</p>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImported(parseCsv(await f.text()));
              }} />
              <div className="mt-2 flex items-center gap-2">
                <Button variant="ghost" onClick={() => fileRef.current?.click()}>Choose CSV</Button>
                {imported.length > 0 && (
                  <>
                    <span className="text-sky-300">{imported.length} rows</span>
                    <button className="text-slate-500 underline" onClick={() => { setImported([]); if (fileRef.current) fileRef.current.value = ""; }}>clear</button>
                  </>
                )}
              </div>
              <p className="mt-2">Without a CSV the prospector agent generates realistic <b>fictional demo</b> prospects for this market.</p>
            </div>

            <Button onClick={run} disabled={running} className="w-full">
              {running ? "⏳ Agents working…" : imported.length ? `▶ Process ${imported.length} imported leads` : "▶ Run lead pipeline"}
            </Button>
            {error && <p className="rounded-lg bg-rose-500/15 p-2 text-sm text-rose-200">⚠️ {error}</p>}
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <SectionTitle emoji="⚙️" title="Live LangGraph execution" sub="Each node lights up as it streams back" />
            <WorkflowDiagram compact active={active} done={done} />
            <div className="scrollbar-thin mt-4 h-40 overflow-y-auto rounded-xl bg-black/40 p-3 font-mono text-xs">
              {logs.length === 0 && <div className="text-slate-500">Waiting for a run…</div>}
              {logs.map((l, i) => {
                const layer = LAYERS.find((x) => x.id === NODE_LAYER[l.node]);
                return (
                  <div key={i} className="py-0.5">
                    <span className="text-slate-500">{new Date(l.at).toLocaleTimeString()}</span>{" "}
                    <span style={{ color: layer?.color }}>[{l.node}]</span> <span className="text-slate-200">{l.message}</span>
                  </div>
                );
              })}
              {running && <div className="animate-pulse text-pink-300">▍</div>}
            </div>
          </Card>

          {result.length > 0 && (
            <Card accent={LAYERS[3].color}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <SectionTitle emoji="📋" title={`${result.length} scored leads`} sub="Click a row to see why it scored that way" />
                <div className="flex gap-2">
                  {added ? (
                    <Link href="/funnel" className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/40">✅ Added — open funnel →</Link>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={() => addToPipeline(true)}>Replace pipeline</Button>
                      <Button variant="success" onClick={() => addToPipeline(false)}>➕ Add to pipeline</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                    <tr><th className="py-2">Lead</th><th>Source</th><th>Intent</th><th>Budget</th><th>Timeline</th><th>Score</th><th>Temp</th><th>Route</th></tr>
                  </thead>
                  <tbody>
                    {result.map((l) => (
                      <Fragment key={l.id}>
                        <tr className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]" onClick={() => setOpen(open === l.id ? null : l.id)}>
                          <td className="py-2.5"><div className="font-medium text-white">{l.name}</div><div className="text-xs text-slate-400">{l.neighborhood}</div></td>
                          <td className="text-slate-300">{l.source}</td>
                          <td className="capitalize text-slate-300">{l.intent}</td>
                          <td className="text-slate-300">{fmtMoney(l.budgetMin)}–{fmtMoney(l.budgetMax)}</td>
                          <td className="text-slate-300">{l.timelineMonths} mo</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-14 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-500" style={{ width: `${l.score}%` }} /></div>
                              <span className="font-semibold tabular-nums text-white">{l.score}</span>
                            </div>
                          </td>
                          <td><TempBadge t={l.temperature} /></td>
                          <td className="text-slate-300">{l.route === "call" ? "📞 Call" : l.route === "nurture" ? "🌱 Nurture" : "💧 Drip"}</td>
                        </tr>
                        {open === l.id && (
                          <tr className="bg-white/[0.02]">
                            <td colSpan={8} className="p-4">
                              <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                  <Meter label="💵 Budget fit" value={l.breakdown!.budget} max={25} color={SERIES[0]} />
                                  <Meter label="⏱️ Timeline" value={l.breakdown!.timeline} max={25} color={SERIES[1]} />
                                  <Meter label="🏦 Financing" value={l.breakdown!.financing} max={20} color={SERIES[2]} />
                                  <Meter label="👀 Engagement" value={l.breakdown!.engagement} max={15} color={SERIES[3]} />
                                  <Meter label="🧠 Intent" value={l.breakdown!.intent} max={15} color={SERIES[4]} />
                                </div>
                                <div className="text-xs text-slate-300">
                                  <div className="mb-1 font-semibold text-violet-300">🧬 Enrichment</div>
                                  <p><b>Motivation:</b> {l.motivation || "—"}</p>
                                  <p className="mt-1"><b>Signals:</b> {(l.signals ?? []).join(" · ") || "—"}</p>
                                  <p className="mt-1"><b>Likely objections:</b> {(l.likelyObjections ?? []).join(" · ") || "—"}</p>
                                  <p className="mt-1 text-slate-400">{l.notes}</p>
                                </div>
                                <div className="text-xs">
                                  <div className="mb-1 font-semibold text-emerald-300">✉️ Drafted outreach</div>
                                  <p className="rounded-lg bg-emerald-500/10 p-2 text-slate-200">{l.outreach || "Cold lead → automated drip campaign."}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
