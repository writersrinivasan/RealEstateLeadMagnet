# 🏠 LeadPilot AI — Agentic Real-Estate Lead Funnel

A colourful Next.js app that **finds real-estate leads, qualifies them with an AI voice agent, and predicts which ones will convert into clients**.

| Layer | What happens | Runs on |
|---|---|---|
| 1 🛰️ Lead Acquisition | Prospector agent sources leads for your market, or imports your CSV | **LangGraph** (`prospect` / `normalize`) |
| 2 🧬 Enrichment | Motivation, intent strength, signals, likely objections | **LangGraph** (`enrich`) |
| 3 🎯 Scoring | Transparent 100-pt score (budget, timeline, financing, engagement, intent) | **LangGraph** (`score`) |
| 4 🔀 Routing & Nurture | Hot → AI call queue · warm → nurture · cold → drip, plus personalised outreach | **LangGraph** (`route`, `outreach`) |
| 5 📞 AI Voice Qualification | "Ava" calls the prospect, runs BANT discovery with tool calls, books viewings | **Microsoft Agent Framework** |
| 6 🏆 Conversion Intelligence | Conversion probability, BANT 0-10, objections, next best action, auto funnel move | **Microsoft Agent Framework** |
| 7 🤖 AI Assistant | Chat about your live pipeline, scripts and strategy | LangChain + **Groq (BYOK)** |

## Quick start

```bash
npm install
npm run setup:agents     # creates agent-service/.venv (needs uv; Python 3.11+)
npm run dev:agents       # terminal 1 → Microsoft Agent Framework service on :8000
npm run dev              # terminal 2 → http://localhost:3000
```

Open the app → **⚙️ Add Groq key** → paste your key from <https://console.groq.com/keys> → **Test & list** to pick a model.

> The Python service is optional: if it's offline, the voice and assessment agents automatically fall back to the same prompts through LangChain + Groq (the UI shows which engine answered).

## BYOK (bring your own key)

- The Groq key is stored **only in your browser** (`localStorage`) and sent per request as the `x-groq-api-key` header.
- Next.js route handlers and the Python service use it for that request only; nothing is written to disk or logs.
- For a real phone call the key is held in memory until the call ends, then discarded.

## Pages

- **Dashboard** — KPIs, funnel infographic, temperature donut, score drivers, sources, call queue.
- **Workflow Layers** — the 7 layers, the LangGraph StateGraph, and the system architecture diagram.
- **Lead Engine** — run the LangGraph pipeline and watch each node light up live (SSE); import `samples/leads.csv`.
- **Lead Funnel** — drag-and-drop kanban, stage conversion, biggest leak.
- **AI Voice Calls** — three modes:
  - 🎭 *AI plays prospect* — watch a full simulated call (both sides spoken with browser TTS)
  - 🎙️ *I speak* — you role-play the prospect through your mic (Chrome/Edge speech recognition)
  - ⌨️ *Type replies*
  - ☎️ *Real phone call* via Twilio (optional, below)
- **AI Assistant** — streaming chat with your pipeline as context.

## Real phone calls (optional, Twilio)

Set these before `npm run dev:agents` (see `agent-service/.env.example`):

```bash
export TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+1...
export PUBLIC_BASE_URL=https://<your-tunnel>.ngrok.app   # e.g. `ngrok http 8000`
```

Twilio handles speech-to-text (`<Gather>`) and text-to-speech (`<Say>`); the Microsoft Agent Framework agent decides what to say. Webhooks are verified with Twilio's request signature. **Only call people who have consented, and follow TCPA / Do-Not-Call rules.**

## Project layout

```
src/lib/graph/leadGraph.ts     LangGraph StateGraph (prospect → enrich → score → route → outreach)
src/lib/scoring.ts             deterministic lead score
src/app/api/*                  route handlers (SSE pipeline, voice proxy + fallback, assistant, BYOK model list)
agent-service/agents.py        Microsoft Agent Framework agents (Ava w/ tools, ConversionAnalyst) on Groq
agent-service/main.py          FastAPI: /voice/turn, /voice/assess, Twilio webhooks
```

## Notes

- Without a CSV, the prospector generates **fictional demo prospects** (555 numbers, example.com emails). For real leads, import your CRM / portal / open-house exports as CSV, or add a data-source node to the graph.
- Leads and call history live in your browser's `localStorage`. "Clear leads" is in ⚙️ Settings.
