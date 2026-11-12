"""Background document processing pipeline.

UPLOADED -> PROCESSING (Docling/pypdf extraction) -> INDEXING (chunk +
embed + insert) -> READY | FAILED. Processing duration is recorded on the
document row; errors are stored in error_message, never raised to the
background task.
"""
import time
import uuid

from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.models import (
    Document,
    DocumentChunk,
    DocumentEmbedding,
    DocumentStatus,
)
from app.services.chunking import chunk_text
from app.services.document_processor.processor import extract_document
from app.services.embeddings.embeddings import embed_texts


def _set_status(db: Session, doc: Document, status: DocumentStatus, **extra):
    doc.status = status
    for key, value in extra.items():
        setattr(doc, key, value)
    db.commit()


def process_document(document_id: uuid.UUID) -> None:
    started = time.monotonic()
    db = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if doc is None:
            return
        _set_status(db, doc, DocumentStatus.PROCESSING)
        try:
            result = extract_document(doc.file_path)
        except Exception as exc:
            _set_status(
                db,
                doc,
                DocumentStatus.FAILED,
                error_message=f"Extraction failed: {exc}",
                processing_seconds=time.monotonic() - started,
            )
            return
        if not result.pages:
            _set_status(
                db,
                doc,
                DocumentStatus.FAILED,
                error_message="No extractable text found in PDF.",
                processing_seconds=time.monotonic() - started,
            )
            return
        doc.page_count = result.page_count
        _set_status(db, doc, DocumentStatus.INDEXING)

        # Chunk per page (keeps page numbers exact), then embed in batches.
        all_chunks: list[tuple[int, str, int]] = []  # (chunk_index, content, page)
        idx = 0
        from app.core.config import get_settings

        settings = get_settings()
        for page in result.pages:
            for piece in chunk_text(page.text, size=settings.chunk_size, overlap=settings.chunk_overlap):
                all_chunks.append((idx, piece, page.page_number))
                idx += 1
        if not all_chunks:
            _set_status(
                db,
                doc,
                DocumentStatus.FAILED,
                error_message="No non-empty chunks produced.",
                processing_seconds=time.monotonic() - started,
            )
            return

        texts = [c[1] for c in all_chunks]
        vectors = embed_texts(texts)
        for (chunk_index, content, page_number), vec in zip(all_chunks, vectors):
            chunk = DocumentChunk(
                document_id=doc.id,
                chunk_index=chunk_index,
                content=content,
                page_number=page_number,
                chunk_metadata={
                    "extractor": result.extractor,
                    "original_filename": doc.original_filename,
                },
            )
            db.add(chunk)
            db.flush()
            db.add(DocumentEmbedding(chunk_id=chunk.id, embedding=vec.tolist()))
        db.commit()
        _set_status(
            db,
            doc,
            DocumentStatus.READY,
            processing_seconds=time.monotonic() - started,
        )
    finally:
        db.close()
