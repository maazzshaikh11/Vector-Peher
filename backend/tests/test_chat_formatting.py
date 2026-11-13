"""FIX 1: structured-output system prompt rules + mocked-Groq SSE flow.

The system prompt must keep every grounding/citation rule AND carry hard
formatting rules (headings, blank lines, bullets, no long paragraphs,
comparisons as tables/lists, short intro then structured body) plus the
exact insufficient-information fallback sentence. Live Groq is unverified
(no key on this machine); the SSE test below uses a mocked Groq stream.
"""
import json

import app.api.routes_chat as routes_chat
from app.api.routes_chat import INSUFFICIENT_INFO, SYSTEM_PROMPT
from tests.conftest import insert_ready_document

FALLBACK = "I don't have enough information in the uploaded documents."


def test_fallback_sentence_is_exact():
    assert INSUFFICIENT_INFO == FALLBACK
    assert SYSTEM_PROMPT.count(FALLBACK) == 1


def test_system_prompt_keeps_grounding_rules():
    p = SYSTEM_PROMPT
    assert "ONLY the information provided in the retrieved document context" in p
    assert "Prioritize uploaded documents over general knowledge" in p
    assert "Never invent facts, quotations, page numbers or document references" in p
    assert "Use multiple documents when they contain relevant information" in p
    assert "Clearly distinguish information from different documents" in p
    assert "Cite the original filename and page number" in p
    assert "Do not pretend to have read content that was not retrieved" in p
    assert "When sources disagree, explain the disagreement and cite both sources" in p


def test_system_prompt_has_formatting_rules():
    p = SYSTEM_PROMPT
    assert "clear section headings" in p.lower()
    assert "every heading on its own line" in p
    assert "one blank line between sections" in p
    assert "bullet points whenever possible" in p
    assert "Never return one long paragraph" in p
    assert "comparisons in a structured format" in p.lower()
    assert "table" in p.lower()  # comparisons as a table or a list
    assert "short intro line" in p.lower()
    assert "Markdown" in p


def test_system_prompt_fallback_instruction():
    assert "respond exactly with" in SYSTEM_PROMPT
    assert f'"{FALLBACK}"' in SYSTEM_PROMPT


def _sse_events(response):
    events = []
    for line in response.text.splitlines():
        if line.startswith("data:"):
            events.append(json.loads(line[5:].strip()))
    return events


def test_chat_mocked_groq_streams_structured_markdown(client, db, monkeypatch):
    """Mocked-Groq live check: a structured markdown answer flows through
    SSE (sources -> tokens -> done) and is persisted verbatim."""
    doc = insert_ready_document(
        db,
        filename="structured-doc.pdf",
        pages=[
            "Quokka propulsion uses spring-loaded hind legs and elastic tendons to achieve long leaps across the outback.",
            "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen.",
            "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
        ],
    )

    structured = (
        "## Quokka Propulsion\n\n"
        "Quokkas move using spring-loaded hind legs.\n\n"
        "- Hind legs store elastic energy\n"
        "- Tendons release it for long leaps\n\n"
        "| Feature | Detail |\n"
        "| --- | --- |\n"
        "| Mechanism | Elastic tendons |\n\n"
        "Source: structured-doc.pdf, page 1."
    )

    async def fake_stream(messages, model, timeout=60.0):
        system = next(m["content"] for m in messages if m["role"] == "system")
        assert "one blank line between sections" in system
        assert "Never return one long paragraph" in system
        assert FALLBACK in system
        # Stream it in small chunks, as a real LLM would (partial markdown
        # mid-stream is expected; the frontend re-renders the whole string).
        for i in range(0, len(structured), 17):
            yield structured[i : i + 17]

    monkeypatch.setattr(routes_chat, "stream_chat", fake_stream)
    monkeypatch.setattr(routes_chat, "groq_configured", lambda: True)

    r = client.post("/api/chat", json={"question": "How does quokka propulsion work?", "top_k": 5})
    assert r.status_code == 200
    events = _sse_events(r)
    types = [e["type"] for e in events]
    assert types[0] == "sources"
    assert types[-1] == "done"
    answer = "".join(e["text"] for e in events if e["type"] == "token")
    assert answer == structured
    assert "## Quokka Propulsion" in answer
    assert "- Hind legs store elastic energy" in answer
    assert "| Feature | Detail |" in answer
    # No Groq error event was emitted.
    assert not any(e["type"] == "error" for e in events)

    # Persisted assistant message is the same structured markdown.
    session_id = events[-1]["session_id"]
    r = client.get(f"/api/chat/sessions/{session_id}")
    msgs = r.json()["messages"]
    assert len(msgs) == 2
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["content"] == structured
