"""Pytest fixtures: real Postgres test DB (vectorbrain_test) + tmp uploads.

Requires PostgreSQL running locally with user vectorbrain/vectorbrain
(CREATEDB). DATABASE_URL is pointed at vectorbrain_test BEFORE any app
module is imported, so the app engine binds to the test DB.
"""
import os
import uuid

import pytest

TEST_DB_URL = "postgresql://vectorbrain:vectorbrain@localhost:5432/vectorbrain_test"
ADMIN_DB_URL = "postgresql://vectorbrain:vectorbrain@localhost:5432/postgres"

os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["GROQ_API_KEY"] = ""  # tests must not need a real key
# Never let huggingface_hub touch the network during tests: on this VM the
# :3128 proxy can stall an HF request indefinitely (observed: a pytest run
# hung 40 min on an established proxy connection). The MiniLM weights live
# in the local HF cache; without them the loader falls back to hash
# embeddings and the mode-aware tests still pass.
os.environ["HF_HUB_OFFLINE"] = "1"


@pytest.fixture(scope="session")
def _test_db(tmp_path_factory):
    from sqlalchemy import create_engine, text

    admin = create_engine(ADMIN_DB_URL, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname='vectorbrain_test'")
        ).scalar()
        if exists:
            conn.execute(text("DROP DATABASE vectorbrain_test"))
        conn.execute(text("CREATE DATABASE vectorbrain_test"))
    admin.dispose()

    # Uploads go to a session tmp dir.
    upload_dir = tmp_path_factory.mktemp("uploads")
    os.environ["UPLOAD_DIR"] = str(upload_dir)

    # Run migrations against the test DB.
    import alembic.config
    from alembic import command

    cfg = alembic.config.Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
    command.upgrade(cfg, "head")
    yield
    # Leave the DB in place for inspection; drop on next session start.


@pytest.fixture(scope="session")
def client(_test_db):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db(_test_db):
    from app.database.session import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def make_sample_pdf(pages: list[str] | None = None) -> bytes:
    """Generate a real multi-page PDF with reportlab. Distinct keywords per page.

    Lines are word-wrapped (~85 chars) so all text stays inside the A4 page;
    an unwrapped drawString would run off the page edge and a layout-aware
    extractor (Docling) would only see the visible prefix.
    """
    import io
    import textwrap

    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    pages = pages or [
        "Quantum computing uses qubits and superposition to solve certain problems faster than classical computers. Shor's algorithm factors large integers.",
        "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen. Chlorophyll in leaves captures light energy.",
        "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation in the inner membrane.",
    ]
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for text in pages:
        y = 750
        for line in textwrap.wrap(text, width=85):
            c.drawString(72, y, line)
            y -= 16
        c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture()
def sample_pdf_bytes():
    return make_sample_pdf()


def insert_ready_document(db, filename="sample.pdf", pages=None):
    """Insert a READY document with chunks + hash-fallback embeddings directly."""
    import hashlib

    from app.models.models import Document, DocumentChunk, DocumentEmbedding, DocumentStatus
    from app.services.chunking import chunk_text
    from app.services.embeddings.embeddings import embed_texts

    pdf = make_sample_pdf(pages)
    doc = Document(
        filename=f"{uuid.uuid4()}.pdf",
        original_filename=filename,
        file_path="/tmp/nonexistent.pdf",
        file_size=len(pdf),
        page_count=len(pages or [1, 2, 3]),
        file_hash=hashlib.sha256(pdf + str(uuid.uuid4()).encode()).hexdigest(),
        status=DocumentStatus.READY,
    )
    db.add(doc)
    db.flush()
    idx = 0
    for page_no, page_text in enumerate(pages or [
        "Quantum computing uses qubits and superposition to solve certain problems faster than classical computers.",
        "Photosynthesis in plants converts sunlight, water and carbon dioxide into glucose and oxygen.",
        "The mitochondria is the powerhouse of the cell. It produces ATP through oxidative phosphorylation.",
    ], start=1):
        for piece in chunk_text(page_text):
            chunk = DocumentChunk(
                document_id=doc.id, chunk_index=idx, content=piece,
                page_number=page_no, chunk_metadata={},
            )
            db.add(chunk)
            db.flush()
            vec = embed_texts([piece])[0]
            db.add(DocumentEmbedding(chunk_id=chunk.id, embedding=vec.tolist()))
            idx += 1
    db.commit()
    return doc
