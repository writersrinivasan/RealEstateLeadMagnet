"use client";

import { useState } from "react";
import { STAGE_META } from "@/lib/layers";
import { FUNNEL_STAGES, type Lead } from "@/lib/types";

/** How many leads reached at least each stage. */
export function funnelCounts(leads: Lead[]) {
  const idx = (s: Lead["stage"]) => (s === "lost" ? 0 : FUNNEL_STAGES.indexOf(s));
  return FUNNEL_STAGES.map((s, i) => ({ stage: s, count: leads.filter((l) => idx(l.stage) >= i).length }));
}

export function FunnelInfographic({ leads }: { leads: Lead[] }) {
  const data = funnelCounts(leads);
  const top = Math.max(1, data[0].count);
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, rowH = 54, gap = 4;
  const widthOf = (c: number) => Math.max(0.36, c / top) * W;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${data.length * (rowH + gap)}`} className="w-full" role="img" aria-label="Lead funnel">
        {data.map((d, i) => {
          const w1 = widthOf(d.count);
          const w2 = i < data.length - 1 ? widthOf(data[i + 1].count) : w1 * 0.85;
          const y = i * (rowH + gap);
          const x1 = (W - w1) / 2, x2 = (W - w2) / 2;
          const m = STAGE_META[d.stage];
          const conv = i === 0 ? 100 : data[i - 1].count ? Math.round((d.count / data[i - 1].count) * 100) : 0;
          return (
            <g key={d.stage} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
              <path
                d={`M${x1} ${y} L${x1 + w1} ${y} L${x2 + w2} ${y + rowH} L${x2} ${y + rowH} Z`}
                fill={m.color}
                opacity={hover === null || hover === i ? 1 : 0.45}
                rx="4"
                style={{ transition: "opacity .2s" }}
              />
              <text x={W / 2} y={y + rowH / 2 - 4} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">
                {m.emoji} {m.label} · {d.count}
              </text>
              <text x={W / 2} y={y + rowH / 2 + 14} textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize="11">
                {i === 0 ? "all leads" : `${conv}% from previous stage`}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-xl">
          <div className="font-semibold">{STAGE_META[data[hover].stage].label}</div>
          <div>{data[hover].count} leads reached this stage</div>
          <div>{Math.round((data[hover].count / top) * 100)}% of all leads</div>
        </div>
      )}
    </div>
  );
}
