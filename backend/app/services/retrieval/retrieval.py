"""pgvector cosine retrieval. Parameterised SQL, `<=>` operator.

Cosine distance `<=>` ranges 0 (identical) to 2 (opposite); similarity is
1 - distance. Results are filtered by `similarity >= threshold`.
"""
import uuid

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings

_SEARCH_SQL = """
SELECT c.id AS chunk_id, c.document_id AS document_id, c.content AS content,
       c.page_number AS page_number, d.original_filename AS filename,
       1 - (e.embedding <=> CAST(:qvec AS vector)) AS score
FROM document_embeddings e
JOIN document_chunks c ON c.id = e.chunk_id
JOIN documents d ON d.id = c.document_id
WHERE (CAST(:doc_ids AS uuid[]) IS NULL OR d.id = ANY(CAST(:doc_ids AS uuid[])))
  AND (1 - (e.embedding <=> CAST(:qvec AS vector))) >= :threshold
ORDER BY e.embedding <=> CAST(:qvec AS vector)
LIMIT :limit
"""


def _vec_literal(vec: np.ndarray) -> str:
    return "[" + ",".join(f"{float(x):.6f}" for x in vec) + "]"


def search_chunks(
    db: Session,
    query_embedding: np.ndarray,
    top_k: int | None = None,
    document_ids: list[uuid.UUID] | None = None,
    threshold: float | None = None,
) -> list[dict]:
    settings = get_settings()
    top_k = top_k or settings.top_k
    threshold = settings.similarity_threshold if threshold is None else threshold
    rows = db.execute(
        text(_SEARCH_SQL),
        {
            "qvec": _vec_literal(query_embedding),
            "doc_ids": [str(d) for d in document_ids] if document_ids else None,
            "threshold": threshold,
            "limit": top_k,
        },
    ).mappings().all()
    return [
        {
            "chunk_id": r["chunk_id"],
            "document_id": r["document_id"],
            "content": r["content"],
            "page_number": r["page_number"],
            "filename": r["filename"],
            "score": float(r["score"]),
        }
        for r in rows
    ]
