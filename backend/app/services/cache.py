"""Semantic cache for chat answers (Fix 2).

A completed answer is stored with its question embedding and the canonical
document scope. A later question whose embedding is cosine-similar enough
(>= ``cache_similarity_threshold``) under the SAME scope is served from the
cache instead of calling Groq.

Scope is canonical: ``"all"`` when the chat covered all documents
(``document_ids`` is None/empty), else the comma-joined sorted UUID
strings of the selected documents — so scope comparison is
order-insensitive.

Adapted from the reference implementation's approach (pgvector ``<=>``
cosine distance, best match only), reworked for this codebase: UUID
document ids, no notebook concept, caller-owned SQLAlchemy session, and a
staleness check so a cached entry is never served after any document it
cites has been deleted or left READY.
"""
import uuid

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import QueryCache

ALL_SCOPE = "all"

_CHECK_SQL = """
SELECT id, answer, sources,
       (question_embedding <=> CAST(:qvec AS vector)) AS distance
FROM query_cache
WHERE scope = :scope
  AND (question_embedding <=> CAST(:qvec AS vector)) <= :max_distance
ORDER BY distance ASC
LIMIT 1
"""

_STALE_CHECK_SQL = """
SELECT c.id AS chunk_id
FROM document_chunks c
JOIN documents d ON d.id = c.document_id
WHERE c.id = ANY(CAST(:ids AS uuid[]))
  AND d.status = 'READY'
"""


def canonical_scope(document_ids: list[uuid.UUID] | None) -> str:
    """Canonical scope string for a document selection."""
    if not document_ids:
        return ALL_SCOPE
    return ",".join(sorted(str(d) for d in document_ids))


def _vec_literal(vec) -> str:
    arr = np.asarray(vec, dtype=np.float64).ravel()
    return "[" + ",".join(f"{float(x):.6f}" for x in arr) + "]"


def _sources_stale(db: Session, sources) -> bool:
    """True if any cached source chunk no longer exists or its document
    is not READY. Sources without a chunk_id cannot be verified and are
    treated as fine."""
    if not sources:
        return False
    chunk_ids = [
        str(s["chunk_id"])
        for s in sources
        if isinstance(s, dict) and s.get("chunk_id")
    ]
    if not chunk_ids:
        return False
    rows = db.execute(text(_STALE_CHECK_SQL), {"ids": chunk_ids}).scalars().all()
    return len(set(str(r) for r in rows)) < len(set(chunk_ids))


def check_cache(
    db: Session,
    question_embedding,
    document_ids: list[uuid.UUID] | None = None,
) -> dict | None:
    """Best matching cached {answer, sources} for this question + scope,
    or None. A stale hit (cited document gone / not READY) is deleted and
    treated as a miss. Never raises into the chat path."""
    try:
        settings = get_settings()
        row = db.execute(
            text(_CHECK_SQL),
            {
                "qvec": _vec_literal(question_embedding),
                "scope": canonical_scope(document_ids),
                "max_distance": float(1.0 - settings.cache_similarity_threshold),
            },
        ).mappings().first()
        if row is None:
            return None
        sources = row["sources"]
        if isinstance(sources, str):
            import json

            sources = json.loads(sources)
        if _sources_stale(db, sources):
            db.execute(
                text("DELETE FROM query_cache WHERE id = :id"),
                {"id": row["id"]},
            )
            db.commit()
            return None
        return {
            "answer": row["answer"],
            "sources": sources,
            "similarity": 1.0 - float(row["distance"]),
        }
    except Exception:
        db.rollback()
        return None


def store_cache(
    db: Session,
    question: str,
    question_embedding,
    answer: str,
    sources: list[dict],
    document_ids: list[uuid.UUID] | None = None,
) -> None:
    """Store a completed answer. Best-effort: never raises into the chat
    path; rolls back on failure."""
    try:
        entry = QueryCache(
            scope=canonical_scope(document_ids),
            question=question,
            question_embedding=np.asarray(question_embedding, dtype=np.float32).tolist(),
            answer=answer,
            sources=sources,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


def invalidate_document(db: Session, document_id: uuid.UUID) -> None:
    """Delete every cache row whose scope references this document — the
    "all" rows too, since they may cite it. Best-effort; never raises.
    The caller commits (the document delete commits in the same txn)."""
    try:
        db.execute(
            text(
                "DELETE FROM query_cache "
                "WHERE scope = :all_scope OR scope LIKE :pattern"
            ),
            {"all_scope": ALL_SCOPE, "pattern": f"%{document_id}%"},
        )
        db.flush()
    except Exception:
        db.rollback()
