import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/** BYOK: the Groq key only ever arrives per request in a header; it is never stored server-side. */
export function readByok(req: Request) {
  const apiKey = req.headers.get("x-groq-api-key")?.trim() || process.env.GROQ_API_KEY || "";
  const model = req.headers.get("x-groq-model")?.trim() || DEFAULT_MODEL;
  return { apiKey, model };
}

export function missingKey() {
  return Response.json(
    { error: "No Groq API key. Open ⚙️ Settings and paste your own Groq key (BYOK)." },
    { status: 401 },
  );
}

export function groq(apiKey: string, model: string, temperature = 0.4) {
  return new ChatGroq({
    apiKey,
    model,
    temperature,
    ...(process.env.GROQ_BASE_URL ? { baseUrl: process.env.GROQ_BASE_URL } : {}),
  });
}

/** Ask the model for a JSON object and parse it leniently. */
export async function llmJson<T = unknown>(
  model: ChatGroq,
  system: string,
  user: string,
): Promise<T> {
  const res = await model.invoke(
    [new SystemMessage(system + "\nRespond with a single valid JSON object only."), new HumanMessage(user)],
    { response_format: { type: "json_object" } },
  );
  return parseJson<T>(typeof res.content === "string" ? res.content : JSON.stringify(res.content));
}

export function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Model did not return JSON");
  }
}

export const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://127.0.0.1:8000";
