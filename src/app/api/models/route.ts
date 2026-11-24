import { missingKey, readByok } from "@/lib/llm";

/** Validate a BYOK Groq key and list the chat models it can use. */
export async function GET(req: Request) {
  const { apiKey } = readByok(req);
  if (!apiKey) return missingKey();
  const r = await fetch(`${process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!r.ok) return Response.json({ error: `Groq rejected the key (${r.status})` }, { status: r.status });
  const data = (await r.json()) as { data: { id: string; active?: boolean }[] };
  const models = data.data
    .filter((m) => m.active !== false && !/whisper|tts|guard|playai|orpheus|prompt-guard/i.test(m.id))
    .map((m) => m.id)
    .sort();
  return Response.json({ models });
}
