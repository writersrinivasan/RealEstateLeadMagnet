"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoLeads } from "@/lib/demo";
import type { Lead } from "@/lib/types";

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

interface Settings {
  groqKey: string;
  model: string;
}

interface Ctx {
  settings: Settings;
  setSettings: (s: Settings) => void;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  leads: Lead[];
  setLeads: (fn: (l: Lead[]) => Lead[]) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  mafOnline: boolean | null;
  hydrated: boolean;
  /** fetch wrapper that attaches the BYOK headers */
  api: (path: string, init?: RequestInit) => Promise<Response>;
}

const AppCtx = createContext<Ctx | null>(null);
const SKEY = "leadpilot.settings";
const LKEY = "leadpilot.leads";

export function Providers({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>({ groqKey: "", model: DEFAULT_MODEL });
  const [leads, setLeadsState] = useState<Lead[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mafOnline, setMaf] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (it isn't available during SSR).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const s = localStorage.getItem(SKEY);
      if (s) setSettingsState({ model: DEFAULT_MODEL, ...JSON.parse(s) });
      const l = localStorage.getItem(LKEY);
      setLeadsState(l ? JSON.parse(l) : demoLeads());
    } catch {
      setLeadsState(demoLeads());
    }
    setHydrated(true);
    const ping = () =>
      fetch("/api/health")
        .then((r) => r.json())
        .then((d) => setMaf(!!d.maf))
        .catch(() => setMaf(false));
    ping();
    const t = setInterval(ping, 15000);
    return () => clearInterval(t);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) localStorage.setItem(LKEY, JSON.stringify(leads));
  }, [leads, hydrated]);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    localStorage.setItem(SKEY, JSON.stringify(s));
  }, []);

  const setLeads = useCallback((fn: (l: Lead[]) => Lead[]) => setLeadsState(fn), []);
  const updateLead = useCallback(
    (id: string, patch: Partial<Lead>) => setLeadsState((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    [],
  );

  const api = useCallback(
    (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set("Content-Type", "application/json");
      if (settings.groqKey) headers.set("x-groq-api-key", settings.groqKey);
      headers.set("x-groq-model", settings.model || DEFAULT_MODEL);
      return fetch(path, { ...init, headers });
    },
    [settings],
  );

  const value = useMemo(
    () => ({ settings, setSettings, settingsOpen, setSettingsOpen, leads, setLeads, updateLead, mafOnline, hydrated, api }),
    [settings, setSettings, settingsOpen, leads, setLeads, updateLead, mafOnline, hydrated, api],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside Providers");
  return c;
}

/** Throws a readable error from an API response. */
export async function ensureOk(r: Response) {
  if (r.ok) return r;
  let msg = `${r.status}`;
  try {
    msg = (await r.json()).error ?? msg;
  } catch {}
  throw new Error(msg);
}
