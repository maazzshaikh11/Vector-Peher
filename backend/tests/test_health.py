"""Health, migrations, pgvector extension."""
from sqlalchemy import text


def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["embedding_mode"] in ("sentence-transformers", "hash-fallback")
    assert body["groq_configured"] is False
    assert body["database"] == "ok"


def test_health_database(client):
    r = client.get("/api/health/database")
    assert r.status_code == 200
    assert r.json()["database"] == "ok"
    assert r.json()["pgvector"] != "not installed"


def test_pgvector_extension_and_tables(db):
    version = db.execute(
        text("SELECT extversion FROM pg_extension WHERE extname='vector'")
    ).scalar()
    assert version is not None
    tables = db.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname='public'")
    ).scalars().all()
    for t in ("documents", "document_chunks", "document_embeddings", "chat_sessions", "chat_messages", "query_cache"):
        assert t in tables
    # Alembic version stamped (head moves as migrations are added)
    rev = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert rev == "0002"
    # vector type works end to end
    dist = db.execute(text("SELECT '[1,0,0]'::vector <=> '[0,1,0]'::vector")).scalar()
    assert abs(float(dist) - 1.0) < 1e-6


def test_embedding_dimension_roundtrip(db):
    from app.models.models import Document, DocumentChunk, DocumentEmbedding, DocumentStatus
    import uuid, hashlib
    doc = Document(filename="x.pdf", original_filename="x.pdf", file_path="/tmp/x.pdf",
                   file_size=1, file_hash=hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest(),
                   status=DocumentStatus.READY)
    db.add(doc); db.flush()
    chunk = DocumentChunk(document_id=doc.id, chunk_index=0, content="hello world", page_number=1)
    db.add(chunk); db.flush()
    from app.services.embeddings.embeddings import embed_texts
    vec = embed_texts(["hello world"])[0]
    assert vec.shape == (384,)
    db.add(DocumentEmbedding(chunk_id=chunk.id, embedding=vec.tolist()))
    db.commit()
    stored = db.execute(text("SELECT vector_dims(embedding) FROM document_embeddings WHERE chunk_id=:c"),
                        {"c": str(chunk.id)}).scalar()
    assert stored == 384
