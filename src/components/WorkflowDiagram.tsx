"use client";

import { LAYERS } from "@/lib/layers";

/**
 * Colourful horizontal flow of the 6 pipeline layers (+ assistant underneath).
 * `active` lights a layer up (used for the live LangGraph run).
 */
export function WorkflowDiagram({ active, done = [], compact = false }: { active?: string | null; done?: string[]; compact?: boolean }) {
  const flow = LAYERS.filter((l) => l.id !== "assist");
  const assist = LAYERS.find((l) => l.id === "assist")!;
  return (
    <div>
      <div className={`grid gap-3 ${compact ? "grid-cols-3 md:grid-cols-6" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"}`}>
        {flow.map((l, i) => {
          const isActive = active === l.id;
          const isDone = done.includes(l.id);
          return (
            <div key={l.id} className="relative">
              <div
                className={`relative h-full overflow-hidden rounded-2xl border p-3 transition-all duration-500 ${isActive ? "scale-[1.04] border-white/40" : "border-white/10"}`}
                style={{
                  background: `linear-gradient(160deg, ${l.color}${isActive || isDone ? "40" : "1f"}, transparent 75%)`,
                  boxShadow: isActive ? `0 0 30px ${l.color}80` : undefined,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-slate-950" style={{ background: l.color }}>
                    {isDone ? "✓" : l.n}
                  </span>
                  <span className={`text-2xl ${isActive ? "animate-bounce" : ""}`}>{l.emoji}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-white">{compact ? l.short : l.name}</div>
                {!compact && (
                  <>
                    <div className="mt-1 text-[11px] font-medium" style={{ color: l.color }}>
                      {l.tech}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{l.desc}</p>
                  </>
                )}
                {isActive && <div className="absolute inset-x-0 bottom-0 h-1 animate-pulse" style={{ background: l.color }} />}
              </div>
              {i < flow.length - 1 && (
                <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-slate-500 xl:block">▶</div>
              )}
            </div>
          );
        })}
      </div>
      {!compact && (
        <div
          className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 p-3"
          style={{ background: `linear-gradient(90deg, ${assist.color}26, transparent)` }}
        >
          <span className="text-2xl">{assist.emoji}</span>
          <div>
            <div className="text-sm font-semibold text-white">
              Layer {assist.n} · {assist.name}
            </div>
            <div className="text-xs text-slate-400">
              <span style={{ color: assist.color }}>{assist.tech}</span> — spans every layer: {assist.desc}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
