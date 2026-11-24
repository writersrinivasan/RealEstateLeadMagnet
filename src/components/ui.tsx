import { TEMP_META } from "@/lib/layers";
import type { Temperature } from "@/lib/types";

export function Card({ children, className = "", accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur ${className}`}
      style={accent ? { boxShadow: `inset 0 3px 0 0 ${accent}` } : undefined}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub, emoji }: { title: string; sub?: string; emoji?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">
        {emoji && <span className="mr-2">{emoji}</span>}
        {title}
      </h2>
      {sub && <p className="text-sm text-slate-400">{sub}</p>}
    </div>
  );
}

export function TempBadge({ t }: { t?: Temperature }) {
  if (!t) return <span className="text-xs text-slate-500">—</span>;
  const m = TEMP_META[t];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m.cls}`}>
      {m.emoji} {m.label}
    </span>
  );
}

export function LayerTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, color, emoji }: { label: string; value: string | number; sub?: string; color: string; emoji: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xl">{emoji}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: color }} />
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger" | "success";
  className?: string;
  type?: "button" | "submit";
}) {
  const v = {
    primary: "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/25 hover:brightness-110",
    ghost: "bg-white/5 text-slate-200 ring-1 ring-white/15 hover:bg-white/10",
    danger: "bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/25 hover:brightness-110",
    success: "bg-gradient-to-r from-emerald-500 to-lime-500 text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

/** Horizontal meter: value / max with a coloured fill and text label. */
export function Meter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Semicircle gauge for 0-100 values (conversion probability, sentiment). */
export function Gauge({ value, label, size = 180 }: { value: number; label: string; size?: number }) {
  const r = 70;
  const c = Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 70 ? "#22c55e" : v >= 45 ? "#f59e0b" : "#ef4444";
  const verdict = v >= 70 ? "Strong" : v >= 45 ? "Possible" : "Unlikely";
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 180 105" width={size} role="img" aria-label={`${label}: ${v}%`}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0" x2="1">
            <stop offset="0" stopColor="#ef4444" />
            <stop offset="0.5" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path d="M20 95 A70 70 0 0 1 160 95" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20 95 A70 70 0 0 1 160 95"
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="90" y="82" textAnchor="middle" className="fill-white" fontSize="30" fontWeight="700">
          {Math.round(v)}%
        </text>
      </svg>
      <div className="-mt-1 text-xs text-slate-400">{label}</div>
      <div className="text-sm font-semibold" style={{ color }}>
        {verdict}
      </div>
    </div>
  );
}
