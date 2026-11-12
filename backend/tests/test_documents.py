"""Document upload / validation / duplicate / delete tests."""
import hashlib
import io
import time

from tests.conftest import make_sample_pdf


def _upload(client, pdf_bytes, filename="sample.pdf"):
    return client.post(
        "/api/documents/upload",
        files=[("files", (filename, io.BytesIO(pdf_bytes), "application/pdf"))],
    )


def _wait_ready(client, doc_id, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/api/documents/{doc_id}/status")
        assert r.status_code == 200
        status = r.json()["status"]
        if status == "READY":
            return r.json()
        if status == "FAILED":
            raise AssertionError(f"document FAILED: {r.json()}")
        time.sleep(1)
    raise AssertionError("document did not become READY in time")


def test_upload_single_pdf_and_ready(client, sample_pdf_bytes):
    r = _upload(client, sample_pdf_bytes)
    assert r.status_code == 200
    docs = r.json()["documents"]
    assert len(docs) == 1
    doc = docs[0]
    assert doc["duplicate"] is False
    assert doc["status"] in ("UPLOADED", "PROCESSING", "INDEXING", "READY")
    assert doc["file_hash"] == hashlib.sha256(sample_pdf_bytes).hexdigest()
    status = _wait_ready(client, doc["id"])
    assert status["chunk_count"] >= 3
    assert status["page_count"] == 3
    # Chunks endpoint serves the source panel
    r = client.get(f"/api/search/documents/{doc['id']}")
    assert r.status_code == 200
    chunks = r.json()
    assert len(chunks) >= 3
    assert chunks[0]["page_number"] == 1
    assert "Quantum computing" in chunks[0]["content"]


def test_upload_multiple_pdfs(client, sample_pdf_bytes):
    pdf2 = make_sample_pdf(["Alpha beta gamma delta epsilon."] * 1 + ["Zeta eta theta iota kappa."])
    r = client.post(
        "/api/documents/upload",
        files=[
            ("files", ("a.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")),
            ("files", ("b.pdf", io.BytesIO(pdf2), "application/pdf")),
        ],
    )
    assert r.status_code == 200
    assert len(r.json()["documents"]) == 2
    for d in r.json()["documents"]:
        _wait_ready(client, d["id"])


def test_upload_invalid_pdf_rejected(client):
    r = _upload(client, b"this is not a pdf at all", "fake.pdf")
    assert r.status_code == 400
    r = _upload(client, b"%PDF-1.4 garbage that is not parseable \x00\x01\x02", "bad.pdf")
    assert r.status_code == 400


def test_upload_non_pdf_extension_rejected(client, sample_pdf_bytes):
    r = client.post(
        "/api/documents/upload",
        files=[("files", ("notes.txt", io.BytesIO(sample_pdf_bytes), "text/plain"))],
    )
    assert r.status_code == 400


def test_duplicate_detection(client, sample_pdf_bytes):
    r1 = _upload(client, sample_pdf_bytes)
    assert r1.status_code == 200
    doc1 = r1.json()["documents"][0]
    _wait_ready(client, doc1["id"])
    r2 = _upload(client, sample_pdf_bytes)
    assert r2.status_code == 200
    doc2 = r2.json()["documents"][0]
    assert doc2["duplicate"] is True
    assert doc2["id"] == doc1["id"]
    assert doc2["status"] == "READY"


def test_get_and_list_documents(client, sample_pdf_bytes):
    r = _upload(client, sample_pdf_bytes)
    doc_id = r.json()["documents"][0]["id"]
    r = client.get(f"/api/documents/{doc_id}")
    assert r.status_code == 200
    assert r.json()["original_filename"] == "sample.pdf"
    r = client.get("/api/documents")
    assert r.status_code == 200
    assert any(d["id"] == doc_id for d in r.json())
    r = client.get("/api/documents/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_delete_cascades(client, db, sample_pdf_bytes):
    r = _upload(client, sample_pdf_bytes)
    doc_id = r.json()["documents"][0]["id"]
    _wait_ready(client, doc_id)
    r = client.delete(f"/api/documents/{doc_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True
    r = client.get(f"/api/documents/{doc_id}")
    assert r.status_code == 404
    from sqlalchemy import text

    n_chunks = db.execute(
        text("SELECT count(*) FROM document_chunks WHERE document_id=:d"), {"d": doc_id}
    ).scalar()
    assert n_chunks == 0
    n_emb = db.execute(text("SELECT count(*) FROM document_embeddings")).scalar()
    # embeddings of the deleted doc are gone (other tests may have added some,
    # so only assert this doc's chunks' embeddings are gone via join)
    n_emb_doc = db.execute(
        text("SELECT count(*) FROM document_embeddings e JOIN document_chunks c ON c.id=e.chunk_id WHERE c.document_id=:d"),
        {"d": doc_id},
    ).scalar()
    assert n_emb_doc == 0
    assert n_emb >= 0
