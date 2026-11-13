"""FIX 2: semantic cache — hit on paraphrase, miss on unrelated, scope
separation, invalidation on document delete, no storing of error/empty
answers. Groq is mocked in every test; no real key is needed.

Questions use distinctive vocabulary (zorblax / quokka-adjacent invented
terms) so no cached entry from another test file can match them.
"""
import json

import app.api.routes_chat as routes_chat
from app.models.models import QueryCache
from tests.conftest import insert_ready_document

ANSWER = (
    "## Zorblax Flux\n\n"
    "The zorblax flux resonator stabilises plasma flow.\n\n"
    "- Resonator coils tune the flux\n"
    "- Plasma stays laminar at low flux\n\n"
    "Source: cache-doc.pdf, page 1."
)

PAGES = [
    "The zorblax flux resonator stabilises plasma flow in the reactor core using tuned resonator coils.",
    "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen.",
    "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
]


def _sse_events(response):
    events = []
    for line in response.text.splitlines():
        if line.startswith("data:"):
            events.append(json.loads(line[5:].strip()))
    return events


def _chat(client, question, **extra):
    return client.post("/api/chat", json={"question": question, **extra})


def _mock_groq(monkeypatch, calls):
    async def fake_stream(messages, model, timeout=60.0):
        calls.append(1)
        for i in range(0, len(ANSWER), 50):
            yield ANSWER[i : i + 50]

    monkeypatch.setattr(routes_chat, "stream_chat", fake_stream)
    monkeypatch.setattr(routes_chat, "groq_configured", lambda: True)


def _answer_of(events):
    return "".join(e["text"] for e in events if e["type"] == "token")


def test_paraphrase_hits_cache_and_groq_not_called_again(client, db, monkeypatch):
    doc = insert_ready_document(db, filename="cache-doc.pdf", pages=PAGES)
    calls = []
    _mock_groq(monkeypatch, calls)

    q1 = "What does the zorblax flux resonator do?"
    r = _chat(client, q1)
    assert r.status_code == 200
    events = _sse_events(r)
    assert not any(e["type"] == "cached" for e in events)
    assert _answer_of(events) == ANSWER
    assert len(calls) == 1
    assert db.query(QueryCache).count() >= 1

    # Identical question: must hit. Near-identical paraphrase (one extra
    # word) must also hit at threshold 0.85 in both embedding modes.
    for q in (q1, "What does the zorblax flux resonator do exactly?"):
        before = len(calls)
        r = _chat(client, q)
        assert r.status_code == 200
        events = _sse_events(r)
        assert [e["type"] for e in events][:2] == ["sources", "cached"]
        assert events[1] == {"type": "cached", "cached": True}
        assert _answer_of(events) == ANSWER
        assert events[-1]["type"] == "done"
        assert len(calls) == before, "Groq must not be called on a cache hit"

    # The cached exchange is persisted like a normal one.
    session_id = events[-1]["session_id"]
    r = client.get(f"/api/chat/sessions/{session_id}")
    msgs = r.json()["messages"]
    assert len(msgs) == 2
    assert msgs[1]["role"] == "assistant" and msgs[1]["content"] == ANSWER


def test_unrelated_question_misses_and_calls_groq(client, db, monkeypatch):
    pages = [
        "The veldt plasma coil stabilises reactor flow using tuned magnetic windings.",
        "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen.",
        "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
    ]
    insert_ready_document(db, filename="cache-doc.pdf", pages=pages)
    calls = []
    _mock_groq(monkeypatch, calls)

    r = _chat(client, "What does the veldt plasma coil do?")
    assert r.status_code == 200
    assert len(calls) == 1

    r = _chat(client, "How does photosynthesis convert sunlight into glucose?")
    assert r.status_code == 200
    events = _sse_events(r)
    assert not any(e["type"] == "cached" for e in events)
    assert len(calls) == 2
    assert _answer_of(events) == ANSWER


def test_cache_invalidated_when_document_deleted(client, db, monkeypatch):
    pages = [
        "The marlin tide engine converts tidal currents into electricity using oscillating hydrofoils.",
        "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen.",
        "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
    ]
    doc = insert_ready_document(db, filename="cache-doc.pdf", pages=pages)
    calls = []
    _mock_groq(monkeypatch, calls)

    q = "What does the marlin tide engine do?"
    r = _chat(client, q)
    assert r.status_code == 200
    assert len(calls) == 1
    assert db.query(QueryCache).filter(QueryCache.question == q).count() >= 1

    # Deleting the cited document must invalidate the cached entry.
    r = client.delete(f"/api/documents/{doc.id}")
    assert r.status_code == 200
    assert db.query(QueryCache).filter(QueryCache.question == q).count() == 0

    r = _chat(client, q)
    assert r.status_code == 200
    events = _sse_events(r)
    assert not any(e["type"] == "cached" for e in events)
    assert len(calls) == 2, "deleted-doc cache entry must not be served"


def test_no_groq_key_answer_is_not_stored(client, db):
    """Error/empty answers are never cached: a no-Groq-key chat stores no
    query_cache row (and the failing chat leaves no session either)."""
    pages = [
        "The brindle solar sail harnesses photon pressure to propel deep-space probes.",
        "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen.",
        "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
    ]
    insert_ready_document(db, filename="cache-doc.pdf", pages=pages)
    before = db.query(QueryCache).count()
    r = _chat(client, "What does the brindle solar sail do?")
    assert r.status_code == 200
    events = _sse_events(r)
    assert any(e["type"] == "error" for e in events)
    assert not any(e["type"] == "cached" for e in events)
    assert db.query(QueryCache).count() == before


def test_scope_separation(client, db, monkeypatch):
    doc1 = insert_ready_document(db, filename="cache-doc-a.pdf", pages=PAGES)
    doc2 = insert_ready_document(db, filename="cache-doc-b.pdf", pages=PAGES)
    calls = []
    _mock_groq(monkeypatch, calls)

    q = "What does the zorblax flux resonator do?"
    r = _chat(client, q, document_ids=[str(doc1.id)])
    assert r.status_code == 200
    assert len(calls) == 1
    assert not any(e["type"] == "cached" for e in _sse_events(r))

    # Same question, different document selection: must NOT hit doc1's entry.
    r = _chat(client, q, document_ids=[str(doc2.id)])
    assert r.status_code == 200
    events = _sse_events(r)
    assert not any(e["type"] == "cached" for e in events)
    assert len(calls) == 2

    # Same question, same selection as the first chat: must hit.
    r = _chat(client, q, document_ids=[str(doc1.id)])
    assert r.status_code == 200
    events = _sse_events(r)
    assert any(e["type"] == "cached" for e in events)
    assert len(calls) == 2
    assert _answer_of(events) == ANSWER
