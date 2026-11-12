"""Semantic search endpoints."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.models import Document, DocumentChunk
from app.schemas.schemas import ChunkOut, SearchRequest, SearchResponse, SearchResult
from app.services.embeddings.embeddings import embed_query
from app.services.retrieval.retrieval import search_chunks

router = APIRouter()


@router.post("/search", response_model=SearchResponse)
def search(req: SearchRequest, db: Session = Depends(get_db)):
    qvec = embed_query(req.query)
    results = search_chunks(db, qvec, top_k=req.top_k, document_ids=req.document_ids)
    return SearchResponse(
        results=[
            SearchResult(
                content=r["content"],
                filename=r["filename"],
                page_number=r["page_number"],
                score=r["score"],
                chunk_id=r["chunk_id"],
                document_id=r["document_id"],
            )
            for r in results
        ]
    )


@router.get("/search/documents/{doc_id}", response_model=list[ChunkOut])
def document_chunks(doc_id: uuid.UUID, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == doc_id)
        .order_by(DocumentChunk.chunk_index)
        .all()
    )
    return [
        ChunkOut(
            id=c.id,
            chunk_index=c.chunk_index,
            content=c.content,
            page_number=c.page_number,
            metadata=c.chunk_metadata,
        )
        for c in chunks
    ]
