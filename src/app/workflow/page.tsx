import { Card, LayerTag, SectionTitle } from "@/components/ui";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";
import { LAYERS } from "@/lib/layers";

const L = Object.fromEntries(LAYERS.map((l) => [l.id, l]));

function Node({ x, y, w = 130, label, sub, color }: { x: number; y: number; w?: number; label: string; sub?: string; color: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={52} rx={12} fill={`${color}26`} stroke={color} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sub ? 22 : 31)} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600">{label}</text>
      {sub && <text x={x + w / 2} y={y + 39} textAnchor="middle" fill={color} fontSize="10">{sub}</text>}
    </g>
  );
}
const Arrow = ({ d, color = "#64748b", label, lx, ly }: { d: string; color?: string; label?: string; lx?: number; ly?: number }) => (
  <g>
    <path d={d} fill="none" stroke={color} strokeWidth={1.6} className="flow-line" markerEnd="url(#arr)" />
    {label && <text x={lx} y={ly} fill="#cbd5e1" fontSize="10" textAnchor="middle">{label}</text>}
  </g>
);

export default function WorkflowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">🧭 Workflow layers</h1>
        <p className="text-slate-400">How a stranger becomes a client — every layer, which agent runs it, and where your key goes.</p>
      </div>

      <Card>
        <SectionTitle emoji="🌈" title="The 7 layers" sub="Colour = layer, everywhere in the app" />
        <WorkflowDiagram />
      </Card>

      <Card accent={L.acquire.color}>
        <SectionTitle emoji="🕸️" title="LangGraph StateGraph — lead pipeline" sub="src/lib/graph/leadGraph.ts · streamed node-by-node to the Lead Engine page" />
        <div className="overflow-x-auto">
          <svg viewBox="0 0 1040 230" className="min-w-[860px]">
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            <Node x={10} y={89} w={80} label="START" color="#94a3b8" />
            <Node x={150} y={20} label="normalize" sub="CSV import" color={L.acquire.color} />
            <Node x={150} y={158} label="prospect" sub="LLM prospector" color={L.acquire.color} />
            <Node x={340} y={89} label="enrich" sub="LLM analyst" color={L.enrich.color} />
            <Node x={520} y={89} label="score" sub="rule engine" color={L.score.color} />
            <Node x={700} y={89} label="route" sub="hot / warm / cold" color={L.route.color} />
            <Node x={880} y={89} w={140} label="outreach" sub="LLM copywriter" color={L.route.color} />
            <Arrow d="M90 105 C120 105 120 46 148 46" label="imported?" lx={112} ly={66} />
            <Arrow d="M90 125 C120 125 120 184 148 184" label="else" lx={112} ly={168} />
            <Arrow d="M280 46 C310 46 310 105 338 105" />
            <Arrow d="M280 184 C310 184 310 125 338 125" />
            <Arrow d="M470 115 L518 115" />
            <Arrow d="M650 115 L698 115" />
            <Arrow d="M830 115 L878 115" />
            <text x={950} y={170} fill="#94a3b8" fontSize="11" textAnchor="middle">→ END</text>
            <text x={765} y={175} fill={L.voice.color} fontSize="11" textAnchor="middle">🔥 hot → 📞 AI call queue</text>
            <text x={765} y={192} fill={L.route.color} fontSize="11" textAnchor="middle">🌤️ warm → nurture</text>
            <text x={765} y={209} fill="#7dd3fc" fontSize="11" textAnchor="middle">❄️ cold → drip</text>
          </svg>
        </div>
      </Card>

      <Card accent={L.voice.color}>
        <SectionTitle emoji="🏗️" title="System architecture" sub="Where each framework runs and how the BYOK key flows" />
        <div className="overflow-x-auto">
          <svg viewBox="0 -40 1040 370" className="min-w-[860px]">
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            <rect x={10} y={20} width={200} height={290} rx={16} fill="#f0abfc14" stroke="#f0abfc66" />
            <text x={110} y={45} textAnchor="middle" fill="#f0abfc" fontSize="13" fontWeight="700">🖥️ Browser</text>
            <Node x={30} y={65} w={160} label="Next.js UI" sub="dashboards & infographics" color="#f0abfc" />
            <Node x={30} y={140} w={160} label="🔑 Groq key" sub="localStorage only (BYOK)" color="#fb923c" />
            <Node x={30} y={215} w={160} label="🎙️ Web Speech" sub="mic STT + voice TTS" color={L.voice.color} />

            <rect x={270} y={20} width={330} height={290} rx={16} fill="#38bdf814" stroke="#38bdf866" />
            <text x={435} y={45} textAnchor="middle" fill="#38bdf8" fontSize="13" fontWeight="700">⚡ Next.js server (route handlers)</text>
            <Node x={290} y={65} w={140} label="/api/leads/run" sub="LangGraph · SSE" color={L.acquire.color} />
            <Node x={445} y={65} w={140} label="/api/assistant" sub="LangChain stream" color={L.assist.color} />
            <Node x={290} y={150} w={140} label="/api/voice/turn" sub="proxy → MAF" color={L.voice.color} />
            <Node x={445} y={150} w={140} label="/api/voice/assess" sub="proxy → MAF" color={L.convert.color} />
            <Node x={290} y={235} w={295} label="fallback: same agents via LangChain + Groq" sub="used when the Python service is offline" color="#94a3b8" />

            <rect x={660} y={20} width={230} height={290} rx={16} fill="#f472b614" stroke="#f472b666" />
            <text x={775} y={45} textAnchor="middle" fill="#f472b6" fontSize="13" fontWeight="700">🐍 Microsoft Agent Framework</text>
            <Node x={680} y={65} w={190} label="Ava · voice agent" sub="tools: record_signal, end_call" color={L.voice.color} />
            <Node x={680} y={150} w={190} label="ConversionAnalyst" sub="JSON verdict + next action" color={L.convert.color} />
            <Node x={680} y={235} w={190} label="Twilio webhooks" sub="optional real phone calls" color="#ef4444" />

            <Node x={920} y={110} w={110} label="Groq" sub="LPU inference" color="#fb923c" />
            <Arrow d="M190 166 C230 166 240 91 288 91" color="#fb923c" label="x-groq-api-key" lx={238} ly={120} />
            <Arrow d="M360 150 L360 133 L650 133 C668 133 664 105 678 105" color={L.voice.color} />
            <Arrow d="M585 176 L678 176" color={L.convert.color} />
            <Arrow d="M870 91 C900 91 900 130 918 132" color="#fb923c" />
            <Arrow d="M870 176 C900 176 900 145 918 142" color="#fb923c" />
            <Arrow d="M585 85 C630 85 630 -22 680 -22 L930 -22 C975 -22 975 60 975 108" color="#fb923c" />
          </svg>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card accent={L.score.color}>
          <SectionTitle emoji="🎯" title="Scoring rubric (100 pts)" sub="Deterministic and explainable — src/lib/scoring.ts" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              {[
                ["💵 Budget fit", "25", "overlap of lead budget with your target range"],
                ["⏱️ Timeline", "25", "≤3 mo 25 · ≤6 mo 18 · ≤12 mo 10 · later 4"],
                ["🏦 Financing", "20", "cash 20 · pre-approved 18 · needs mortgage 8"],
                ["👀 Engagement", "15", "site visits, opens, showings (0-10)"],
                ["🧠 Intent (AI)", "15", "LLM-inferred intent strength (0-10)"],
              ].map(([a, b, c]) => (
                <tr key={a}><td className="py-2 text-white">{a}</td><td className="font-semibold text-amber-300">{b}</td><td className="text-slate-400">{c}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-wrap gap-2">
            <LayerTag color="#f43f5e">🔥 ≥ 70 Hot</LayerTag>
            <LayerTag color="#f59e0b">🌤️ 45–69 Warm</LayerTag>
            <LayerTag color="#38bdf8">❄️ &lt; 45 Cold</LayerTag>
          </div>
        </Card>
        <Card accent={L.convert.color}>
          <SectionTitle emoji="📞" title="Voice call lifecycle" sub="Layer 5 → 6" />
          <ol className="space-y-2.5 text-sm">
            {[
              ["🟣", "Ava opens the call, references how the lead found you, asks permission."],
              ["🟡", "BANT discovery — one question per turn; tool calls log each signal live."],
              ["🟠", "Objection handling (rates, timing, commission) with empathy."],
              ["🟢", "Books a viewing / consult, then calls end_call."],
              ["🏆", "ConversionAnalyst returns probability, BANT 0-10, objections, next best action and moves the lead in the funnel."],
            ].map(([e, t]) => (
              <li key={t} className="flex gap-3"><span>{e}</span><span className="text-slate-300">{t}</span></li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
