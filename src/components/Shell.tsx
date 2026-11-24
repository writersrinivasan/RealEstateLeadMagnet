"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ensureOk, useApp, DEFAULT_MODEL } from "./Providers";
import { Button } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", emoji: "📊", color: "#f0abfc" },
  { href: "/workflow", label: "Workflow Layers", emoji: "🧭", color: "#fbbf24" },
  { href: "/leads", label: "Lead Engine", emoji: "🛰️", color: "#38bdf8" },
  { href: "/funnel", label: "Lead Funnel", emoji: "🔻", color: "#34d399" },
  { href: "/voice", label: "AI Voice Calls", emoji: "📞", color: "#f472b6" },
  { href: "/assistant", label: "AI Assistant", emoji: "🤖", color: "#818cf8" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { settings, setSettingsOpen, mafOnline } = useApp();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-slate-950/60 p-4 backdrop-blur lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-orange-400 to-yellow-300 text-xl shadow-lg shadow-fuchsia-500/30">
            🏠
          </div>
          <div>
            <div className="font-bold text-white">LeadPilot AI</div>
            <div className="text-[11px] text-slate-400">Real-estate lead funnel</div>
          </div>
        </Link>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                style={active ? { boxShadow: `inset 3px 0 0 ${n.color}` } : undefined}
              >
                <span className="text-lg">{n.emoji}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
          <StatusRow ok={!!settings.groqKey} label={settings.groqKey ? "Groq key set (BYOK)" : "No Groq key"} />
          <StatusRow ok={mafOnline} label={mafOnline ? "MS Agent Framework online" : mafOnline === null ? "Checking agents…" : "MAF offline · fallback"} />
          <StatusRow ok label="LangGraph pipeline ready" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/70 px-5 py-3 backdrop-blur">
          <div className="flex gap-1 overflow-x-auto lg:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-2 py-1 text-lg hover:bg-white/10" title={n.label}>
                {n.emoji}
              </Link>
            ))}
          </div>
          <div className="hidden text-sm text-slate-400 lg:block">
            Agentic AI · <span className="text-sky-300">LangGraph</span> + <span className="text-pink-300">Microsoft Agent Framework</span> +{" "}
            <span className="text-orange-300">Groq</span>
          </div>
          <Button variant={settings.groqKey ? "ghost" : "primary"} onClick={() => setSettingsOpen(true)}>
            ⚙️ {settings.groqKey ? settings.model.split("/").pop() : "Add Groq key"}
          </Button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-5 lg:p-8">{children}</main>
      </div>
      <SettingsModal />
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-300">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400" : ok === null ? "bg-slate-500" : "bg-amber-400"}`} />
      {label}
    </div>
  );
}

function SettingsModal() {
  const { settings, setSettings, settingsOpen, setSettingsOpen, setLeads } = useApp();
  const [key, setKey] = useState(settings.groqKey);
  const [model, setModel] = useState(settings.model);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [lastOpen, setLastOpen] = useState(false);

  if (settingsOpen !== lastOpen) {
    setLastOpen(settingsOpen);
    if (settingsOpen) {
      setKey(settings.groqKey);
      setModel(settings.model);
      setStatus("");
    }
  }
  if (!settingsOpen) return null;

  async function test() {
    setStatus("Checking key…");
    try {
      const r = await ensureOk(await fetch("/api/models", { headers: { "x-groq-api-key": key } }));
      const d = (await r.json()) as { models: string[] };
      setModels(d.models);
      setStatus(`✅ Key works · ${d.models.length} models available`);
    } catch (e) {
      setStatus(`❌ ${(e as Error).message}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setSettingsOpen(false)}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-white">🔑 Bring Your Own Key</h3>
        <p className="mt-1 text-sm text-slate-400">
          Your Groq API key is saved only in this browser (localStorage) and sent per request to your own server. Get one free at{" "}
          <a className="text-orange-300 underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
            console.groq.com/keys
          </a>
          .
        </p>
        <label className="mt-5 block text-xs font-medium uppercase tracking-wider text-slate-400">Groq API key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="gsk_..."
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:ring-2 focus:ring-pink-500"
        />
        <label className="mt-4 block text-xs font-medium uppercase tracking-wider text-slate-400">Model</label>
        <div className="mt-1 flex gap-2">
          {models.length ? (
            <select value={model} onChange={(e) => setModel(e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
              {[model, ...models.filter((m) => m !== model)].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input value={model} onChange={(e) => setModel(e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-sm text-white" />
          )}
          <Button variant="ghost" onClick={test} disabled={!key}>
            Test & list
          </Button>
        </div>
        {status && <p className="mt-2 text-sm text-slate-300">{status}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setSettings({ groqKey: "", model: DEFAULT_MODEL }); setKey(""); }}>
              Forget key
            </Button>
            <Button variant="ghost" onClick={() => { if (confirm("Delete all leads and call history in this browser?")) setLeads(() => []); }}>
              Clear leads
            </Button>
          </div>
          <Button onClick={() => { setSettings({ groqKey: key.trim(), model: model.trim() || DEFAULT_MODEL }); setSettingsOpen(false); }}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
