"use client";

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIES } from "@/lib/layers";

const tooltipStyle = {
  contentStyle: { background: "#0f172a", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, color: "#e2e8f0", fontSize: 12 },
  itemStyle: { color: "#e2e8f0" },
  cursor: { fill: "rgba(255,255,255,.05)" },
};

/** Single-series horizontal bar (counts per category). */
export function HBar({ data, color = SERIES[0], height = 240 }: { data: { name: string; value: number }[]; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#cbd5e1", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Bar isAnimationActive={false} dataKey="value" name="Leads" fill={color} radius={[0, 4, 4, 0]} barSize={14} label={{ position: "right", fill: "#cbd5e1", fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut with direct labels + legend (identity is never colour-alone). */
export function Donut({ data, height = 220 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: height, height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="#0b1020" strokeWidth={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-2xl font-bold text-white">{total}</div>
            <div className="text-[11px] text-slate-400">leads</div>
          </div>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ background: d.color }} />
            <span className="text-slate-200">{d.name}</span>
            <span className="tabular-nums text-slate-400">
              {d.value} · {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical bars for a score histogram. */
export function VBar({ data, height = 200 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16 }}>
        <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
        <Tooltip {...tooltipStyle} />
        <Bar isAnimationActive={false} dataKey="value" name="Leads" radius={[4, 4, 0, 0]} barSize={28} label={{ position: "top", fill: "#cbd5e1", fontSize: 11 }}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
