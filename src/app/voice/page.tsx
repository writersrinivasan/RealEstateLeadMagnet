"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ensureOk, useApp } from "@/components/Providers";
import { Button, Card, Gauge, Meter, SectionTitle, TempBadge } from "@/components/ui";
import { LAYERS, STAGE_META } from "@/lib/layers";
import { fmtMoney } from "@/lib/scoring";
import type { CallAssessment, CallTurn, Lead, QualSignal } from "@/lib/types";

type Mode = "simulate" | "voice" | "text";
type Status = "idle" | "ringing" | "thinking" | "agent" | "prospect" | "listening" | "assessing" | "ended";
const MAX_AGENT_TURNS = 12;

/* ───────────── browser speech helpers ───────────── */
function pickVoices() {
  const vs = typeof window !== "undefined" ? window.speechSynthesis?.getVoices() ?? [] : [];
  const en = vs.filter((v) => v.lang.startsWith("en"));
  const agent = en.find((v) => /samantha|female|zira|aria|jenny|google us english/i.test(v.name)) ?? en[0];
  const prospect = en.find((v) => v !== agent && /daniel|alex|male|guy|david|fred|google uk english male/i.test(v.name)) ?? en.find((v) => v !== agent) ?? agent;
  return { agent, prospect };
}

function speak(text: string, who: "agent" | "prospect", enabled: boolean): Promise<void> {
  if (!enabled || typeof window === "undefined" || !window.speechSynthesis) {
    return new Promise((r) => setTimeout(r, Math.min(2500, 400 + text.length * 25)));
  }
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoices()[who];
    if (v) u.voice = v;
    u.rate = who === "agent" ? 1.05 : 1;
    u.pitch = who === "agent" ? 1.1 : 0.9;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

type SR = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
function getSR(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function listen(srRef: React.RefObject<SR | null>): Promise<string> {
  const Ctor = getSR();
  if (!Ctor) return Promise.resolve("");
  return new Promise((resolve) => {
    const sr = new Ctor();
    srRef.current = sr;
    sr.lang = "en-US";
    sr.interimResults = false;
    sr.maxAlternatives = 1;
    let text = "";
    sr.onresult = (e) => { text = Array.from(e.results).map((r) => r[0].transcript).join(" "); };
    sr.onerror = () => resolve(text);
    sr.onend = () => resolve(text);
    sr.start();
  });
}

/* ───────────── live BANT from tool-call signals ───────────── */
function liveBant(signals: QualSignal[]) {
  const dim = (d: QualSignal["dimension"]) => Math.min(10, signals.filter((s) => s.dimension === d).reduce((a, s) => a + s.strength * 2, 0));
  return { budget: dim("budget"), authority: dim("authority"), need: dim("need"), timeline: dim("timeline"), objections: signals.filter((s) => s.dimension === "objection").length, appointment: signals.some((s) => s.dimension === "appointment") };
}

const DIM_EMOJI: Record<string, string> = { budget: "💵", authority: "👥", need: "🏡", timeline: "⏱️", objection: "⚠️", appointment: "📅" };

function VoicePage() {
  const { leads, api, settings, setSettingsOpen, updateLead, mafOnline, hydrated } = useApp();
  const params = useSearchParams();
  const [leadId, setLeadId] = useState<string | null>(params.get("lead"));
  const lead = leads.find((l) => l.id === leadId) ?? null;

  const [mode, setMode] = useState<Mode>("simulate");
  const [audio, setAudio] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<CallTurn[]>([]);
  const [signals, setSignals] = useState<QualSignal[]>([]);
  const [engine, setEngine] = useState("");
  const [assessment, setAssessment] = useState<CallAssessment | null>(null);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [phone, setPhone] = useState("");
  const [realCall, setRealCall] = useState<{ id: string; status: string } | null>(null);

  const tRef = useRef<CallTurn[]>([]);
  const sRef = useRef<QualSignal[]>([]);
  const engRef = useRef("");
  const live = useRef(false);
  const srRef = useRef<SR | null>(null);
  const typedResolver = useRef<((t: string) => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [transcript, status]);
  useEffect(() => {
    if (!["thinking", "agent", "prospect", "listening"].includes(status)) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);
  useEffect(() => () => { live.current = false; window.speechSynthesis?.cancel(); srRef.current?.stop(); }, []);

  const push = (turn: CallTurn) => { tRef.current = [...tRef.current, turn]; setTranscript(tRef.current); };

  async function prospectReply(l: Lead): Promise<string> {
    if (mode === "simulate") {
      setStatus("thinking");
      const r = await ensureOk(await api("/api/voice/simulate", { method: "POST", body: JSON.stringify({ lead: l, transcript: tRef.current }) }));
      const { reply } = await r.json();
      if (!live.current) return "";
      setStatus("prospect");
      push({ role: "prospect", text: reply });
      await speak(reply, "prospect", audio);
      return reply;
    }
    setStatus("listening");
    const text = mode === "voice" ? await listen(srRef) : await new Promise<string>((res) => { typedResolver.current = res; });
    if (!live.current) return "";
    const said = text.trim() || "(no response)";
    push({ role: "prospect", text: said });
    return said;
  }

  async function runCall(l: Lead) {
    let agentTurns = 0;
    try {
      while (live.current) {
        setStatus("thinking");
        const r = await ensureOk(await api("/api/voice/turn", { method: "POST", body: JSON.stringify({ lead: l, transcript: tRef.current }) }));
        const out = (await r.json()) as { reply: string; signals: QualSignal[]; endCall: boolean; engine: string };
        if (!live.current) break;
        setEngine(out.engine);
        engRef.current = out.engine;
        sRef.current = [...sRef.current, ...out.signals];
        setSignals(sRef.current);
        push({ role: "agent", text: out.reply });
        setStatus("agent");
        await speak(out.reply, "agent", audio);
        agentTurns++;
        if (out.endCall || agentTurns >= MAX_AGENT_TURNS || !live.current) break;
        await prospectReply(l);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    if (tRef.current.length > 1) await finish(l);
    else { live.current = false; setStatus("ended"); }
  }

  async function finish(l: Lead) {
    live.current = false;
    window.speechSynthesis?.cancel();
    srRef.current?.stop();
    setStatus("assessing");
    try {
      const r = await ensureOk(await api("/api/voice/assess", { method: "POST", body: JSON.stringify({ lead: l, transcript: tRef.current, signals: sRef.current }) }));
      const a = (await r.json()) as CallAssessment;
      setAssessment(a);
      updateLead(l.id, {
        stage: a.recommendedStage,
        call: { at: new Date().toISOString(), transcript: tRef.current, signals: sRef.current, assessment: a, engine: engRef.current || a.engine || "" },
      });
    } catch (e) {
      setError((e as Error).message);
    }
    setStatus("ended");
  }

  function start() {
    if (!lead) return;
    if (!settings.groqKey) return setSettingsOpen(true);
    if (mode === "voice" && !getSR()) return setError("Speech recognition isn't supported in this browser — use Chrome/Edge, or pick 'Type replies'.");
    tRef.current = []; sRef.current = [];
    setTranscript([]); setSignals([]); setAssessment(null); setError(""); setEngine(""); setSeconds(0);
    live.current = true;
    setStatus("ringing");
    setTimeout(() => live.current && runCall(lead), 1600);
  }

  function hangUp() {
    if (!lead) return;
    live.current = false;
    window.speechSynthesis?.cancel();
    srRef.current?.stop();
    typedResolver.current?.("");
    typedResolver.current = null;
  }

  function sendTyped() {
    if (!typed.trim() || !typedResolver.current) return;
    typedResolver.current(typed);
    typedResolver.current = null;
    setTyped("");
  }

  async function placeRealCall() {
    if (!lead || !phone) return;
    setError("");
    try {
      const r = await ensureOk(await api("/api/voice/outbound", { method: "POST", body: JSON.stringify({ lead, to: phone }) }));
      const { callId } = await r.json();
      setRealCall({ id: callId, status: "dialing" });
      tRef.current = []; setTranscript([]); setAssessment(null); setSignals([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (!realCall || ["completed", "failed", "busy", "no-answer", "canceled"].includes(realCall.status) || !lead) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/voice/outbound?callId=${realCall.id}`);
      if (!r.ok) return;
      const d = await r.json();
      setTranscript(d.transcript ?? []);
      setSignals(d.signals ?? []);
      setRealCall({ id: realCall.id, status: d.status });
      if (d.assessment && !d.assessment.error) {
        setAssessment(d.assessment);
        updateLead(lead.id, { stage: d.assessment.recommendedStage, call: { at: new Date().toISOString(), transcript: d.transcript, signals: d.signals, assessment: d.assessment, engine: "Microsoft Agent Framework · Twilio" } });
      }
    }, 3000);
    return () => clearInterval(t);
  }, [realCall, lead, updateLead]);

  if (!hydrated) return null;
  const inCall = !["idle", "ended"].includes(status);
  const bant = liveBant(signals);
  const sorted = [...leads].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const shown = assessment ?? (status === "ended" ? null : lead?.call?.assessment ?? null);
  const shownTranscript = transcript.length ? transcript : !inCall && lead?.call ? lead.call.transcript : transcript;
  const color = LAYERS[4].color;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">📞 AI Voice Qualification</h1>
        <p className="text-slate-400">
          Ava (Microsoft Agent Framework) calls the prospect, runs BANT discovery with tool calls, and the ConversionAnalyst predicts if they will become a client.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="max-h-[720px] overflow-hidden p-3">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Call queue</div>
          <div className="scrollbar-thin max-h-[660px] space-y-1.5 overflow-y-auto pr-1">
            {sorted.map((l) => (
              <button
                key={l.id}
                disabled={inCall}
                onClick={() => { setLeadId(l.id); setTranscript([]); setAssessment(null); setSignals([]); setStatus("idle"); setRealCall(null); }}
                className={`w-full rounded-xl p-2.5 text-left text-xs transition disabled:opacity-50 ${l.id === leadId ? "bg-pink-500/20 ring-1 ring-pink-400/50" : "hover:bg-white/5"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{l.name}</span>
                  <span className="tabular-nums text-slate-300">{l.score}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-400">
                  <TempBadge t={l.temperature} />
                  {l.call?.assessment ? <span className="text-pink-300">✔ {l.call.assessment.conversionProbability}%</span> : <span>{l.intent}</span>}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {!lead ? (
          <Card className="grid min-h-[400px] place-items-center text-center">
            <div>
              <div className="text-6xl">☎️</div>
              <p className="mt-3 text-slate-300">Pick a lead from the call queue to start an AI call.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
              <Card accent={color} className="flex flex-col">
                <div className="flex flex-wrap items-center gap-4">
                  <div className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 text-2xl text-white ${status === "ringing" ? "pulse-ring" : ""}`} style={{ color }}>
                    <span className="relative text-white">{status === "ringing" ? "📲" : "👤"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-white">{lead.name}</div>
                    <div className="text-xs text-slate-400">{lead.phone} · {lead.intent} · {lead.propertyType} · {fmtMoney(lead.budgetMin)}–{fmtMoney(lead.budgetMax)} · {lead.timelineMonths} mo</div>
                    <div className="mt-1 text-xs">
                      <span className="text-pink-300">{statusLabel(status)}</span>
                      {inCall && <span className="ml-2 tabular-nums text-slate-400">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>}
                      {engine && <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">⚙️ {engine}</span>}
                    </div>
                  </div>
                  <Waveform status={status} />
                </div>

                <div ref={scrollRef} className="scrollbar-thin mt-4 h-80 space-y-3 overflow-y-auto rounded-xl bg-black/30 p-4">
                  {shownTranscript.length === 0 && status === "idle" && (
                    <div className="grid h-full place-items-center text-center text-sm text-slate-500"><p>Press <b className="mx-1 text-pink-300">Start AI call</b> — Ava will open the conversation.</p></div>
                  )}
                  {shownTranscript.map((t, i) => (
                    <div key={i} className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${t.role === "agent" ? "rounded-tl-sm bg-gradient-to-br from-pink-500/30 to-fuchsia-500/20 text-pink-50" : "rounded-tr-sm bg-sky-500/20 text-sky-50"}`}>
                        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">{t.role === "agent" ? "🤖 Ava (AI agent)" : `👤 ${lead.name.split(" ")[0]}`}</div>
                        {t.text}
                      </div>
                    </div>
                  ))}
                  {(status === "thinking" || status === "assessing") && <div className="animate-pulse text-xs text-slate-400">{status === "assessing" ? "🏆 ConversionAnalyst is scoring this call…" : "… thinking"}</div>}
                </div>

                {mode === "text" && status === "listening" && (
                  <div className="mt-3 flex gap-2">
                    <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTyped()} placeholder="Reply as the prospect…" className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400" />
                    <Button variant="ghost" onClick={sendTyped}>Send</Button>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!inCall ? (
                    <Button onClick={start} className="px-6">📞 Start AI call</Button>
                  ) : (
                    <Button variant="danger" onClick={hangUp} disabled={status === "assessing"}>⏹ Hang up & assess</Button>
                  )}
                  <div className="flex rounded-xl bg-white/5 p-1 text-xs ring-1 ring-white/10">
                    {([["simulate", "🎭 AI plays prospect"], ["voice", "🎙️ I speak (mic)"], ["text", "⌨️ Type replies"]] as const).map(([m, label]) => (
                      <button key={m} disabled={inCall} onClick={() => setMode(m)} className={`rounded-lg px-2.5 py-1.5 transition ${mode === m ? "bg-pink-500 text-white" : "text-slate-300 hover:text-white"}`}>{label}</button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} disabled={inCall} /> 🔊 Voice audio
                  </label>
                </div>
                {error && <p className="mt-3 rounded-lg bg-rose-500/15 p-2 text-sm text-rose-200">⚠️ {error}</p>}
              </Card>

              <Card accent={LAYERS[2].color}>
                <SectionTitle emoji="📡" title="Live qualification" sub="From Ava's record_signal tool calls" />
                <div className="space-y-3">
                  <Meter label="💵 Budget" value={bant.budget} max={10} color="#3987e5" />
                  <Meter label="👥 Authority" value={bant.authority} max={10} color="#9085e9" />
                  <Meter label="🏡 Need" value={bant.need} max={10} color="#199e70" />
                  <Meter label="⏱️ Timeline" value={bant.timeline} max={10} color="#c98500" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white/5 p-2"><div className="text-xl">⚠️</div><div className="font-bold text-white">{bant.objections}</div><div className="text-slate-400">objections</div></div>
                  <div className="rounded-xl bg-white/5 p-2"><div className="text-xl">{bant.appointment ? "✅" : "📅"}</div><div className="font-bold text-white">{bant.appointment ? "Booked" : "Not yet"}</div><div className="text-slate-400">appointment</div></div>
                </div>
                <div className="scrollbar-thin mt-4 max-h-40 space-y-1 overflow-y-auto">
                  {signals.map((s, i) => (
                    <div key={i} className="rounded-lg bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                      {DIM_EMOJI[s.dimension]} <b className="capitalize">{s.dimension}</b> · {s.detail} <span className="text-amber-300">{"★".repeat(s.strength)}</span>
                    </div>
                  ))}
                  {!signals.length && <div className="text-xs text-slate-500">Signals appear here as Ava learns about the prospect.</div>}
                </div>
              </Card>
            </div>

            {shown && <AssessmentPanel a={shown} lead={lead} />}

            <Card accent="#ef4444">
              <SectionTitle emoji="☎️" title="Real phone call (optional)" sub="Twilio dials the number; Microsoft Agent Framework drives the conversation. Requires agent-service with Twilio env vars + a public URL." />
              <div className="flex flex-wrap items-center gap-3">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15125550142 (number you are allowed to call)" className="w-72 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" />
                <Button variant="ghost" onClick={placeRealCall} disabled={!mafOnline || !phone || inCall}>📲 Place real call</Button>
                {!mafOnline && <span className="text-xs text-amber-300">Agent service offline — see README to start it.</span>}
                {realCall && <span className="text-xs text-slate-300">Call {realCall.id}: <b>{realCall.status}</b></span>}
              </div>
              <p className="mt-2 text-xs text-slate-500">Only call people who have consented to be contacted, and follow local calling rules (e.g. TCPA, DNC lists). Ava discloses that it is an AI assistant when asked.</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function statusLabel(s: Status) {
  return { idle: "Ready", ringing: "📳 Ringing…", thinking: "💭 Agent thinking", agent: "🗣️ Ava speaking", prospect: "🗣️ Prospect speaking", listening: "👂 Listening to prospect", assessing: "🏆 Assessing call", ended: "✅ Call ended" }[s];
}

function Waveform({ status }: { status: Status }) {
  const on = status === "agent" || status === "prospect" || status === "listening";
  const c = status === "agent" ? "bg-pink-400" : status === "listening" ? "bg-emerald-400" : "bg-sky-400";
  return (
    <div className="flex h-10 items-center gap-1" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className={`w-1 rounded-full ${on ? `${c} wave-bar` : "bg-white/15"}`} style={{ height: on ? 8 + ((i * 7) % 28) : 6, animationDelay: `${(i % 7) * 0.09}s` }} />
      ))}
    </div>
  );
}

function AssessmentPanel({ a, lead }: { a: CallAssessment; lead: Lead }) {
  const st = STAGE_META[a.recommendedStage] ?? STAGE_META.contacted;
  return (
    <Card accent={LAYERS[5].color}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle emoji="🏆" title={`Conversion verdict — ${a.verdict}`} sub={a.engine ? `by ConversionAnalyst · ${a.engine}` : undefined} />
        <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: `${st.color}55`, boxShadow: `inset 0 0 0 1px ${st.color}` }}>
          {st.emoji} {lead.name.split(" ")[0]} moved to “{st.label}”
        </span>
      </div>
      <div className="grid items-center gap-6 md:grid-cols-[auto_auto_1fr]">
        <Gauge value={a.conversionProbability} label="Conversion probability" />
        <Gauge value={a.sentiment} label="Prospect sentiment" size={150} />
        <div className="space-y-2.5">
          <Meter label="💵 Budget" value={a.bant.budget} max={10} color="#3987e5" />
          <Meter label="👥 Authority" value={a.bant.authority} max={10} color="#9085e9" />
          <Meter label="🏡 Need" value={a.bant.need} max={10} color="#199e70" />
          <Meter label="⏱️ Timeline" value={a.bant.timeline} max={10} color="#c98500" />
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">✅ Buying signals</div>
          <div className="flex flex-wrap gap-1.5">{a.buyingSignals.map((s) => <span key={s} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-100 ring-1 ring-emerald-400/30">{s}</span>)}{!a.buyingSignals.length && <span className="text-xs text-slate-500">none</span>}</div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-300">⚠️ Objections</div>
          <div className="flex flex-wrap gap-1.5">{a.objections.map((s) => <span key={s} className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs text-rose-100 ring-1 ring-rose-400/30">{s}</span>)}{!a.objections.length && <span className="text-xs text-slate-500">none</span>}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-lime-400/20 to-emerald-500/10 p-3 ring-1 ring-lime-300/30">
          <div className="text-xs font-semibold uppercase tracking-wider text-lime-200">🚀 Next best action</div>
          <p className="mt-1 text-sm text-white">{a.nextBestAction}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-300">{a.summary}</p>
    </Card>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VoicePage />
    </Suspense>
  );
}
