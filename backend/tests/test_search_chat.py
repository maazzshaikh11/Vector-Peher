"""Docling/pypdf extraction preserves page numbers; retrieval + chat."""
import json

from tests.conftest import insert_ready_document, make_sample_pdf


def test_extraction_preserves_pages(tmp_path):
    from app.services.document_processor.processor import extract_document

    pdf_path = tmp_path / "sample.pdf"
    pdf_path.write_bytes(make_sample_pdf())
    result = extract_document(str(pdf_path))
    assert result.page_count == 3
    assert len(result.pages) == 3
    assert [p.page_number for p in result.pages] == [1, 2, 3]
    assert "Quantum computing" in result.pages[0].text
    assert "Photosynthesis" in result.pages[1].text
    assert "mitochondria" in result.pages[2].text
    assert result.extractor in ("docling", "pypdf")


def test_search_returns_cited_results(client, db):
    doc = insert_ready_document(db)
    r = client.post("/api/search", json={"query": "quantum computing qubits", "top_k": 5})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) >= 1
    # The quantum chunk must rank in the results (other tests may have
    # inserted identical-content docs, so don't assume it is first).
    top = next(res for res in results if "Quantum computing" in res["content"])
    assert top["page_number"] == 1
    assert top["score"] > 0.2
    assert top["document_id"] in (str(doc.id),)
    assert top["chunk_id"]


def test_search_document_filter(client, db):
    doc1 = insert_ready_document(db, filename="doc-one.pdf")
    doc2 = insert_ready_document(db, filename="doc-two.pdf")
    r = client.post("/api/search", json={
        "query": "quantum computing", "document_ids": [str(doc2.id)], "top_k": 5,
    })
    assert r.status_code == 200
    assert all(res["document_id"] == str(doc2.id) for res in r.json()["results"])
    assert len(r.json()["results"]) >= 1


def test_search_empty_query_rejected(client):
    r = client.post("/api/search", json={"query": ""})
    assert r.status_code == 422


def _sse_events(response):
    events = []
    for line in response.text.splitlines():
        if line.startswith("data:"):
            events.append(json.loads(line[5:].strip()))
    return events


def test_chat_no_groq_key_returns_error_event(client, db):
    insert_ready_document(db)
    r = client.post("/api/chat", json={"question": "What is quantum computing?"})
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]
    events = _sse_events(r)
    assert events, "expected at least one SSE event"
    # Sources are emitted first, even when the LLM is down, so the client
    # can show citations alongside the honest error.
    assert events[0]["type"] == "sources"
    assert events[0]["sources"], "expected retrieved sources before the error"
    err = next(e for e in events if e["type"] == "error")
    assert "GROQ_API_KEY" in err["message"]
    assert not any(e["type"] == "token" for e in events), "no answer was fabricated"
    # The auto-created session is removed again: failed chats leave no
    # empty sessions behind.
    r = client.get("/api/chat/sessions")
    assert r.json() == []


def test_chat_mocked_groq_streams_tokens_sources_done_and_persists(client, db, monkeypatch):
    import app.api.routes_chat as routes_chat

    # Unique content so this doc — not identical-content docs from other
    # tests — is the top retrieval hit.
    doc = insert_ready_document(
        db,
        filename="chat-doc.pdf",
        pages=[
            "Qudit teleportation uses quantum entanglement to transfer qudit states between distant laboratories.",
            "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen.",
            "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
        ],
    )

    async def fake_stream(messages, model, timeout=60.0):
        assert any("Vector Brain" in m["content"] for m in messages)  # system prompt present
        assert any("Qudit teleportation" in m["content"] for m in messages)  # grounded context present
        for tok in ["Qudit ", "teleportation ", "uses ", "entanglement."]:
            yield tok

    monkeypatch.setattr(routes_chat, "stream_chat", fake_stream)
    monkeypatch.setattr(routes_chat, "groq_configured", lambda: True)

    r = client.post("/api/chat", json={"question": "What enables qudit teleportation?", "top_k": 5})
    assert r.status_code == 200
    events = _sse_events(r)
    types = [e["type"] for e in events]
    assert types[0] == "sources", "sources are emitted before tokens"
    assert "token" in types
    assert "".join(e["text"] for e in events if e["type"] == "token") == "Qudit teleportation uses entanglement."
    assert "sources" in types
    src_event = next(e for e in events if e["type"] == "sources")
    assert src_event["sources"], "expected sources"
    assert src_event["sources"][0]["filename"] == "chat-doc.pdf"
    assert src_event["sources"][0]["page_number"] == 1
    assert "chunk_id" in src_event["sources"][0] and "score" in src_event["sources"][0]
    assert types[-1] == "done"
    session_id = events[-1]["session_id"]

    # Messages persisted (user + completed assistant)
    r = client.get(f"/api/chat/sessions/{session_id}")
    assert r.status_code == 200
    msgs = r.json()["messages"]
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user" and msgs[0]["content"] == "What enables qudit teleportation?"
    assert msgs[1]["role"] == "assistant"
    assert "Qudit teleportation uses entanglement." in msgs[1]["content"]
    assert msgs[1]["sources"]


def test_chat_session_crud(client, db):
    r = client.post("/api/chat/sessions", json={"title": "My research"})
    assert r.status_code == 201
    sid = r.json()["id"]
    assert r.json()["title"] == "My research"

    r = client.get("/api/chat/sessions")
    assert r.status_code == 200
    assert any(s["id"] == sid for s in r.json())

    r = client.patch(f"/api/chat/sessions/{sid}", json={"title": "Renamed"})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"

    r = client.get(f"/api/chat/sessions/{sid}")
    assert r.status_code == 200
    assert r.json()["messages"] == []

    r = client.delete(f"/api/chat/sessions/{sid}")
    assert r.status_code == 200
    r = client.get(f"/api/chat/sessions/{sid}")
    assert r.status_code == 404


def test_chat_empty_question_rejected(client):
    r = client.post("/api/chat", json={"question": ""})
    assert r.status_code == 422


def test_chat_unknown_session_404(client):
    r = client.post("/api/chat", json={
        "question": "hi",
        "session_id": "00000000-0000-0000-0000-000000000000",
    })
    assert r.status_code == 404
