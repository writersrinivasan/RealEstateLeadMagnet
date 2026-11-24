"""Microsoft Agent Framework agents: the voice qualification agent and the conversion analyst.

Both run on Groq through its OpenAI-compatible Chat Completions endpoint, using the
caller's own key (BYOK). Nothing about the key is stored.
"""

from __future__ import annotations

import json
import os
import re
from typing import Annotated, Literal

from agent_framework import Agent, Message, tool
from agent_framework.openai import OpenAIChatCompletionClient

from prompts import ASSESSOR_INSTRUCTIONS, VOICE_AGENT_INSTRUCTIONS, lead_brief, transcript_text

GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
ENGINE = "Microsoft Agent Framework"


def groq_client(api_key: str, model: str) -> OpenAIChatCompletionClient:
    return OpenAIChatCompletionClient(model=model, api_key=api_key, base_url=GROQ_BASE_URL)


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            raise ValueError("Model did not return JSON")
        return json.loads(m.group(0))


def _to_messages(transcript: list[dict]) -> list[Message]:
    if not transcript:
        return [Message("user", ["(The call just connected. Open the call: greet, introduce yourself as Ava, "
                                 "reference how they found us, and ask if now is a good time.)"])]
    return [Message("assistant" if t["role"] == "agent" else "user", [t["text"]]) for t in transcript]


async def voice_turn(lead: dict, transcript: list[dict], api_key: str, model: str) -> dict:
    """Run one turn of the voice agent. Tools collect BANT signals into per-call state."""
    signals: list[dict] = []
    state = {"end": False}

    @tool(description="Record a qualification fact the prospect just revealed.")
    def record_signal(
        dimension: Annotated[
            Literal["budget", "authority", "need", "timeline", "objection", "appointment"], "BANT dimension"
        ],
        detail: Annotated[str, "Short fact, e.g. 'pre-approved up to $650k'"],
        strength: Annotated[int, "How strongly this indicates conversion, 1-5"] = 3,
    ) -> str:
        signals.append({"dimension": dimension, "detail": detail, "strength": max(1, min(5, int(strength)))})
        return "recorded"

    @tool(description="End the phone call once the conversation is complete.")
    def end_call(reason: Annotated[str, "Why the call is ending"]) -> str:
        state["end"] = True
        return "call will end after your closing line"

    instructions = f"{VOICE_AGENT_INSTRUCTIONS}\n\n{lead_brief(lead)}"
    client = groq_client(api_key, model)
    messages = _to_messages(transcript)
    try:
        agent = Agent(client, instructions, name="Ava-VoiceQualifier", tools=[record_signal, end_call])
        res = await agent.run(messages, options={"temperature": 0.6})
    except Exception as e:  # some models emit malformed tool calls — retry without tools
        if "401" in str(e) or "invalid_api_key" in str(e).lower():
            raise
        agent = Agent(client, instructions.split("Tools:")[0], name="Ava-VoiceQualifier")
        res = await agent.run(messages, options={"temperature": 0.6})

    reply = (res.text or "").strip() or "Sorry, could you say that again?"
    return {"reply": reply, "signals": signals, "endCall": state["end"], "engine": f"{ENGINE} · tool calling"}


async def assess_call(lead: dict, transcript: list[dict], signals: list[dict], api_key: str, model: str) -> dict:
    """Conversion analyst agent: scores how likely this lead converts into a client."""
    agent = Agent(groq_client(api_key, model), ASSESSOR_INSTRUCTIONS, name="ConversionAnalyst")
    prompt = (
        f"{lead_brief(lead)}\nSignals captured live by the voice agent: {json.dumps(signals)}\n"
        f"Transcript:\n{transcript_text(transcript)}"
    )
    res = await agent.run(prompt, options={"temperature": 0.2, "response_format": {"type": "json_object"}})
    data = _parse_json(res.text or "{}")
    data["engine"] = ENGINE
    return data
