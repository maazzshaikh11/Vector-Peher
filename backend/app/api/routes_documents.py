"""Document upload / list / get / status / delete endpoints."""
import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.session import get_db
from app.models.models import Document, DocumentChunk, DocumentStatus
from app.schemas.schemas import (
    DocumentRenameRequest,
    DocumentStatusResponse,
    DocumentSummary,
    DocumentUploadResponse,
)
from app.services.cache import invalidate_document
from app.services.processing import process_document

router = APIRouter()
settings = get_settings()


def _chunk_count(db: Session, doc_id: uuid.UUID) -> int:
    return db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).count()


def _summary(db: Session, doc: Document, duplicate: bool = False) -> DocumentSummary:
    return DocumentSummary(
        id=doc.id,
        filename=doc.filename,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        page_count=doc.page_count,
        file_hash=doc.file_hash,
        status=doc.status,
        error_message=doc.error_message,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        chunk_count=_chunk_count(db, doc.id),
        duplicate=duplicate,
    )


def _validate_pdf_bytes(data: bytes, filename: str) -> None:
    if not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail=f"{filename}: not a valid PDF (missing %PDF magic bytes).")
    if b"%%EOF" not in data[-2048:]:
        # Lenient: some producers omit a trailing EOF marker; magic + parse check below.
        pass


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    summaries: list[DocumentSummary] = []

    for upload in files:
        filename = upload.filename or "unnamed.pdf"
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{filename}: only .pdf files are accepted.")
        if upload.content_type and upload.content_type not in (
            "application/pdf",
            "application/octet-stream",
        ):
            raise HTTPException(status_code=400, detail=f"{filename}: invalid MIME type {upload.content_type}.")
        data = await upload.read()
        if len(data) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"{filename}: exceeds {settings.max_upload_size_mb}MB limit.",
            )
        _validate_pdf_bytes(data, filename)
        # PDF integrity: must be parseable by pypdf.
        try:
            from pypdf import PdfReader
            import io

            PdfReader(io.BytesIO(data))
        except Exception:
            raise HTTPException(status_code=400, detail=f"{filename}: not a readable PDF.")

        file_hash = hashlib.sha256(data).hexdigest()
        existing = db.query(Document).filter(Document.file_hash == file_hash).first()
        if existing is not None:
            summaries.append(_summary(db, existing, duplicate=True))
            continue

        stored_name = f"{uuid.uuid4()}.pdf"
        stored_path = settings.upload_path / stored_name
        stored_path.write_bytes(data)
        doc = Document(
            filename=stored_name,
            original_filename=filename,
            file_path=str(stored_path),
            file_size=len(data),
            file_hash=file_hash,
            status=DocumentStatus.UPLOADED,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        background_tasks.add_task(process_document, doc.id)
        summaries.append(_summary(db, doc, duplicate=False))

    return DocumentUploadResponse(documents=summaries)


@router.get("/documents", response_model=list[DocumentSummary])
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [_summary(db, d) for d in docs]


@router.get("/documents/{doc_id}", response_model=DocumentSummary)
def get_document(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _summary(db, doc)


@router.get("/documents/{doc_id}/status", response_model=DocumentStatusResponse)
def get_document_status(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentStatusResponse(
        id=doc.id,
        status=doc.status,
        page_count=doc.page_count,
        chunk_count=_chunk_count(db, doc.id),
        error_message=doc.error_message,
    )


@router.patch("/documents/{doc_id}", response_model=DocumentSummary)
def rename_document(doc_id: uuid.UUID, body: DocumentRenameRequest, db: Session = Depends(get_db)):
    """Rename a document's display name (original_filename). The stored
    file on disk keeps its UUID name — only the display name changes.
    Cached answers and chunk metadata citing the old name are invalidated/
    updated so citations stay consistent."""
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    new_name = (body.original_filename or body.filename or "").strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="A non-empty filename is required.")
    if len(new_name) > 255:
        raise HTTPException(status_code=400, detail="Filename must be at most 255 characters.")
    doc.original_filename = new_name
    db.execute(
        text(
            "UPDATE document_chunks SET metadata = jsonb_set("
            "COALESCE(metadata, '{}'::jsonb), '{original_filename}', to_jsonb(CAST(:name AS text))) "
            "WHERE document_id = :d"
        ),
        {"name": new_name, "d": str(doc_id)},
    )
    db.commit()
    db.refresh(doc)
    # Cached answers may cite the old display name — drop them.
    invalidate_document(db, doc_id)
    db.commit()
    return _summary(db, doc)


@router.post("/documents/{doc_id}/reprocess", response_model=DocumentSummary)
def reprocess_document(
    doc_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Reset a document to UPLOADED and re-run the processing pipeline.
    Intended for FAILED documents, but any non-processing document can be
    reprocessed (e.g. after an extractor fix). Existing chunks are deleted
    first so reprocessing never duplicates them; cached answers for the
    document are invalidated. A document already PROCESSING/INDEXING is
    rejected with 409 to avoid concurrent double-processing."""
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if doc.status in (DocumentStatus.PROCESSING, DocumentStatus.INDEXING):
        raise HTTPException(
            status_code=409, detail="Document is already being processed."
        )
    # Bulk delete: the DB-level FK (ondelete=CASCADE) removes embeddings.
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete(
        synchronize_session=False
    )
    doc.status = DocumentStatus.UPLOADED
    doc.error_message = None
    doc.page_count = None
    doc.processing_seconds = None
    db.commit()
    db.refresh(doc)
    invalidate_document(db, doc_id)
    db.commit()
    background_tasks.add_task(process_document, doc.id)
    return _summary(db, doc)


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    file_path = Path(doc.file_path)
    # Invalidate every cached answer whose scope references this document
    # ("all" scopes too — they may cite it).
    invalidate_document(db, doc_id)
    db.delete(doc)
    db.commit()
    try:
        if file_path.exists():
            file_path.unlink()
    except OSError:
        pass
    return {"deleted": True, "id": str(doc_id)}
