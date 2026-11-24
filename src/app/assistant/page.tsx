"use client";

import { useEffect, useRef, useState } from "react";
import { funnelCounts } from "@/components/FunnelInfographic";
import { ensureOk, useApp } from "@/components/Providers";
import { Button, Card } from "@/components/ui";
import type { Lead } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "📊 Analyse my funnel — where am I losing leads?",
  "🔥 Which 3 leads should I call first today, and why?",
  "🗣️ Write a call script for handling the 'interest rates are too high' objection",
  "✉️ Draft a 5-touch nurture sequence for my warm buyer leads",
  "📈 Give me 5 lead-generation ideas for expired and FSBO listings",
];

function pipelineContext(leads: Lead[]) {
  return JSON.stringify({
    funnel: funnelCounts(leads),
    leads: leads.slice(0, 25).map((l) => ({
      name: l.name, intent: l.intent, type: l.propertyType, area: l.neighborhood, budget: [l.budgetMin, l.budgetMax],
      timelineMonths: l.timelineMonths, financing: l.financing, source: l.source, score: l.score, temperature: l.temperature,
      stage: l.stage, motivation: l.motivation,
      call: l.call?.assessment && { conversion: l.call.assessment.conversionProbability, verdict: l.call.assessment.verdict, objections: l.call.assessment.objections, next: l.call.assessment.nextBestAction },
    })),
  });
}

/** Tiny, safe markdown renderer (headings, bullets, bold, code). */
function Md({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p.startsWith("**") ? <b key={i} className="text-white">{p.slice(2, -2)}</b> : p.startsWith("`") ? <code key={i} className="rounded bg-black/40 px-1">{p.slice(1, -1)}</code> : p,
    );
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (/^#{1,4}\s/.test(line)) return <div key={i} className="pt-1 font-semibold text-indigo-200">{inline(line.replace(/^#+\s/, ""))}</div>;
        if (/^\s*([-*•]|\d+\.)\s/.test(line)) return <div key={i} className="flex gap-2 pl-2"><span className="text-indigo-300">•</span><span>{inline(line.replace(/^\s*([-*•]|\d+\.)\s/, ""))}</span></div>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

export default function AssistantPage() {
  const { api, leads, settings, setSettingsOpen } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, which React rejects as an effect cleanup.
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    if (!settings.groqKey) return setSettingsOpen(true);
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const r = await ensureOk(await api("/api/assistant", { method: "POST", body: JSON.stringify({ messages: next, context: pipelineContext(leads) }) }));
      const reader = r.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white">🤖 AI Assistant</h1>
        <p className="text-slate-400">LeadPilot knows your live pipeline. Powered by Groq with your own key ({settings.model}).</p>
      </div>
      <Card accent="#818cf8" className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          {msgs.length === 0 && (
            <div className="grid h-full place-items-center">
              <div className="max-w-xl text-center">
                <div className="text-5xl">🤖✨</div>
                <p className="mt-3 text-slate-300">Ask about strategy, scripts, or your leads. Try one:</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full bg-indigo-500/15 px-3 py-1.5 text-xs text-indigo-100 ring-1 ring-indigo-400/30 hover:bg-indigo-500/25">{s}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-gradient-to-br from-fuchsia-500/40 to-pink-500/30 text-white" : "bg-white/5 text-slate-200 ring-1 ring-white/10"}`}>
                {m.role === "assistant" ? (m.content ? <Md text={m.content} /> : <span className="animate-pulse">…</span>) : m.content}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask LeadPilot anything…" className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-400" />
          <Button type="submit" disabled={busy || !input.trim()}>Send ➤</Button>
        </form>
      </Card>
    </div>
  );
}
