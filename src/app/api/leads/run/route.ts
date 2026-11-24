import { buildLeadGraph } from "@/lib/graph/leadGraph";
import { groq, missingKey, readByok } from "@/lib/llm";
import type { Criteria, Lead } from "@/lib/types";

export const maxDuration = 120;

/** Runs the LangGraph pipeline and streams every node update as Server-Sent Events. */
export async function POST(req: Request) {
  const { apiKey, model } = readByok(req);
  if (!apiKey) return missingKey();
  const body = (await req.json()) as { criteria: Criteria; imported?: Partial<Lead>[] };
  const criteria = { ...body.criteria, count: Math.min(12, Math.max(1, Number(body.criteria.count) || 8)) };
  const graph = buildLeadGraph(groq(apiKey, model, 0.7));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        let leads: Lead[] = [];
        const updates = await graph.stream(
          { criteria, imported: (body.imported ?? []).slice(0, 50) },
          { streamMode: "updates" },
        );
        for await (const chunk of updates) {
          for (const [node, update] of Object.entries(chunk as Record<string, { leads?: Lead[]; log?: unknown[] }>)) {
            if (update?.leads) leads = update.leads;
            send({ type: "node", node, log: update?.log ?? [], leadCount: leads.length });
          }
        }
        send({ type: "done", leads });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
