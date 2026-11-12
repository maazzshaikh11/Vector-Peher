"""Groq streaming client (answers ONLY — never embeddings).

Uses the official groq SDK when available; falls back to a plain httpx call
to the OpenAI-compatible endpoint. The API key comes from GROQ_API_KEY only
and is never logged.
"""
import asyncio
import os

GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqNotConfigured(Exception):
    pass


class GroqRateLimited(Exception):
    pass


class GroqProviderError(Exception):
    pass


def groq_configured() -> bool:
    return bool(os.environ.get("GROQ_API_KEY", "").strip())


async def stream_chat(messages: list[dict], model: str, timeout: float = 60.0):
    """Async generator yielding text tokens from Groq (streaming)."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise GroqNotConfigured("Groq API key is not configured on the server.")

    def _run_with_sdk():
        from groq import Groq

        client = Groq(api_key=api_key, timeout=timeout)
        stream = client.chat.completions.create(
            model=model, messages=messages, stream=True
        )
        tokens = []
        for event in stream:
            if event.choices:
                delta = event.choices[0].delta.content
                if delta:
                    tokens.append(delta)
        return tokens

    try:
        tokens = await asyncio.to_thread(_run_with_sdk)
    except ImportError:
        tokens = await _run_with_httpx(messages, model, api_key, timeout)
    except Exception as exc:
        raise _map_error(exc) from exc
    for tok in tokens:
        yield tok


async def _run_with_httpx(messages, model, api_key, timeout):
    import httpx

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                GROQ_BASE_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": model, "messages": messages, "stream": True},
            ) as resp:
                if resp.status_code == 429:
                    raise GroqRateLimited("Groq rate limit reached. Please wait and retry.")
                if resp.status_code >= 400:
                    raise GroqProviderError(f"Groq returned HTTP {resp.status_code}.")
                tokens = []
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    import json

                    try:
                        data = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    choices = data.get("choices") or []
                    if choices:
                        delta = (choices[0].get("delta") or {}).get("content")
                        if delta:
                            tokens.append(delta)
                return tokens
    except (GroqRateLimited, GroqProviderError):
        raise
    except Exception as exc:
        raise _map_error(exc) from exc


def _map_error(exc: Exception) -> Exception:
    name = type(exc).__name__
    msg = str(exc)
    if name == "RateLimitError" or "rate limit" in msg.lower() or "429" in msg:
        return GroqRateLimited("Groq rate limit reached. Please wait a moment and retry.")
    if name in ("APITimeoutError", "APIConnectionError") or "timed out" in msg.lower():
        return GroqProviderError("The AI provider timed out. Please retry.")
    return GroqProviderError("The AI provider returned an unexpected error. Please retry.")
