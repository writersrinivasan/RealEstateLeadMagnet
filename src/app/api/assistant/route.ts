import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { groq, missingKey, readByok } from "@/lib/llm";

/** Streaming AI assistant (BYOK Groq) with the current pipeline as context. */
export async function POST(req: Request) {
  const { apiKey, model } = readByok(req);
  if (!apiKey) return missingKey();
  const { messages, context } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    context: string;
  };

  const llm = groq(apiKey, model, 0.5);
  const history = [
    new SystemMessage(
      `You are LeadPilot, an AI assistant for a real-estate team. You help with lead generation strategy, funnel optimisation, follow-up scripts, objection handling and interpreting AI call results. Be concise, practical, use short bullet points and markdown. Current pipeline snapshot (JSON):\n${context}`,
    ),
    ...messages.slice(-12).map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content))),
  ];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of await llm.stream(history)) {
          if (typeof chunk.content === "string" && chunk.content) controller.enqueue(enc.encode(chunk.content));
        }
      } catch (e) {
        controller.enqueue(enc.encode(`\n\n⚠️ ${e instanceof Error ? e.message : String(e)}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
