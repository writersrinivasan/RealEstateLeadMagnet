"""LeadPilot agent service — Microsoft Agent Framework + FastAPI.

Endpoints used by the Next.js app:
  GET  /health
  POST /voice/turn        one turn of the AI voice qualification agent (browser voice calls)
  POST /voice/assess      post-call conversion assessment
  POST /twilio/outbound   (optional) place a REAL phone call through Twilio
  POST /twilio/voice      Twilio webhook: call answered
  POST /twilio/gather     Twilio webhook: prospect speech captured
  GET  /twilio/calls/{id} poll a real call's transcript / assessment

BYOK: the Groq key arrives in the `x-groq-api-key` header and is used only for the request
(or, for a live Twilio call, held in memory until that call ends).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import uuid
from html import escape

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import Response

from agents import ENGINE, assess_call, voice_turn

DEFAULT_MODEL = "llama-3.3-70b-versatile"
app = FastAPI(title="LeadPilot Agent Service (Microsoft Agent Framework)")


def _byok(key: str | None, model: str | None) -> tuple[str, str]:
    key = (key or os.getenv("GROQ_API_KEY") or "").strip()
    if not key:
        raise HTTPException(401, "Missing Groq API key (BYOK)")
    return key, (model or DEFAULT_MODEL).strip()


def _http_error(e: Exception) -> HTTPException:
    msg = str(e)
    status = 401 if ("401" in msg or "invalid_api_key" in msg.lower()) else 429 if "429" in msg else 502
    return HTTPException(status, f"{ENGINE}: {msg[:400]}")


@app.get("/health")
async def health():
    return {"status": "ok", "engine": ENGINE, "twilio": bool(os.getenv("TWILIO_ACCOUNT_SID"))}


@app.post("/voice/turn")
async def turn(body: dict, x_groq_api_key: str | None = Header(None), x_groq_model: str | None = Header(None)):
    key, model = _byok(x_groq_api_key, x_groq_model)
    try:
        return await voice_turn(body["lead"], body.get("transcript", []), key, model)
    except HTTPException:
        raise
    except Exception as e:
        raise _http_error(e)


@app.post("/voice/assess")
async def assess(body: dict, x_groq_api_key: str | None = Header(None), x_groq_model: str | None = Header(None)):
    key, model = _byok(x_groq_api_key, x_groq_model)
    try:
        return await assess_call(body["lead"], body.get("transcript", []), body.get("signals", []), key, model)
    except Exception as e:
        raise _http_error(e)


# ───────────────────────────── Optional: real phone calls via Twilio ─────────────────────────────
# Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER and PUBLIC_BASE_URL (e.g. an
# ngrok https URL that forwards to this service). Twilio does speech-to-text (<Gather>) and
# text-to-speech (<Say>); the Microsoft Agent Framework agent decides what to say.

CALLS: dict[str, dict] = {}
VOICE = os.getenv("TWILIO_VOICE", "Polly.Joanna")


def _twiml(say: str, call_id: str, hangup: bool = False) -> Response:
    base = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    if hangup:
        body = f'<Say voice="{VOICE}">{escape(say)}</Say><Hangup/>'
    else:
        body = (
            f'<Gather input="speech" speechTimeout="auto" action="{base}/twilio/gather?call_id={call_id}" method="POST">'
            f'<Say voice="{VOICE}">{escape(say)}</Say></Gather>'
            f'<Redirect method="POST">{base}/twilio/gather?call_id={call_id}&amp;silent=1</Redirect>'
        )
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><Response>{body}</Response>', media_type="application/xml")


async def _verify_twilio(req: Request) -> dict:
    """Reject webhook calls that are not signed by Twilio."""
    form = dict(await req.form())
    token = os.getenv("TWILIO_AUTH_TOKEN", "")
    base = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    url = base + req.url.path + (f"?{req.url.query}" if req.url.query else "")
    payload = url + "".join(f"{k}{form[k]}" for k in sorted(form))
    expected = base64.b64encode(hmac.new(token.encode(), payload.encode(), hashlib.sha1).digest()).decode()
    if not token or not hmac.compare_digest(expected, req.headers.get("X-Twilio-Signature", "")):
        raise HTTPException(403, "Invalid Twilio signature")
    return form


@app.post("/twilio/outbound")
async def outbound(body: dict, x_groq_api_key: str | None = Header(None), x_groq_model: str | None = Header(None)):
    key, model = _byok(x_groq_api_key, x_groq_model)
    sid, token, from_ = (os.getenv(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"))
    base = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    if not (sid and token and from_ and base):
        raise HTTPException(400, "Twilio not configured: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, PUBLIC_BASE_URL")
    call_id = uuid.uuid4().hex[:12]
    CALLS[call_id] = {"lead": body["lead"], "key": key, "model": model, "transcript": [], "signals": [],
                      "status": "dialing", "assessment": None}
    async with httpx.AsyncClient(timeout=20) as http:
        r = await http.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Calls.json",
            auth=(sid, token),
            data={"To": body["to"], "From": from_, "Url": f"{base}/twilio/voice?call_id={call_id}",
                  "StatusCallback": f"{base}/twilio/status?call_id={call_id}"},
        )
    if r.status_code >= 300:
        CALLS.pop(call_id, None)
        raise HTTPException(r.status_code, f"Twilio: {r.text[:300]}")
    return {"callId": call_id, "callSid": r.json().get("sid")}


async def _agent_says(call: dict) -> tuple[str, bool]:
    out = await voice_turn(call["lead"], call["transcript"], call["key"], call["model"])
    call["transcript"].append({"role": "agent", "text": out["reply"]})
    call["signals"].extend(out["signals"])
    return out["reply"], out["endCall"]


async def _finish(call: dict):
    call["status"] = "completed"
    if call["assessment"] is None and call["transcript"]:
        try:
            call["assessment"] = await assess_call(call["lead"], call["transcript"], call["signals"], call["key"], call["model"])
        except Exception as e:
            call["assessment"] = {"error": str(e)}
    call.pop("key", None)  # BYOK key is forgotten as soon as the call is over


@app.post("/twilio/voice")
async def twilio_voice(req: Request, call_id: str):
    await _verify_twilio(req)
    call = CALLS.get(call_id)
    if not call:
        return _twiml("Sorry, this call has expired. Goodbye.", call_id, hangup=True)
    call["status"] = "in-progress"
    say, _ = await _agent_says(call)
    return _twiml(say, call_id)


@app.post("/twilio/gather")
async def twilio_gather(req: Request, call_id: str, silent: int = 0):
    form = await _verify_twilio(req)
    call = CALLS.get(call_id)
    if not call or "key" not in call:
        return _twiml("Thanks for your time. Goodbye.", call_id, hangup=True)
    speech = (form.get("SpeechResult") or "").strip()
    call["transcript"].append({"role": "prospect", "text": speech or "(silence)"})
    say, end = await _agent_says(call)
    if end:
        await _finish(call)
        return _twiml(say, call_id, hangup=True)
    return _twiml(say, call_id)


@app.post("/twilio/status")
async def twilio_status(req: Request, call_id: str):
    form = await _verify_twilio(req)
    call = CALLS.get(call_id)
    if call and form.get("CallStatus") in {"completed", "busy", "failed", "no-answer", "canceled"}:
        if form.get("CallStatus") != "completed":
            call["status"] = str(form.get("CallStatus"))
            call.pop("key", None)
        elif "key" in call:
            await _finish(call)
    return {"ok": True}


@app.get("/twilio/calls/{call_id}")
async def twilio_call(call_id: str):
    call = CALLS.get(call_id)
    if not call:
        raise HTTPException(404, "Unknown call")
    return {k: v for k, v in call.items() if k not in {"key"}}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8000")))
