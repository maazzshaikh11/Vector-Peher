"""Health endpoints."""
from fastapi import APIRouter
from sqlalchemy import text

from app.database.session import SessionLocal
from app.services.embeddings.embeddings import embedding_mode
from app.services.llm.groq_client import groq_configured

router = APIRouter()


def _db_status() -> dict:
    try:
        db = SessionLocal()
        try:
            pg_version = db.execute(text("SELECT version()")).scalar()
            vec_version = db.execute(
                text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
            ).scalar()
            return {
                "database": "ok",
                "postgres_version": str(pg_version).split(" ")[1] if pg_version else None,
                "pgvector": vec_version or "not installed",
            }
        finally:
            db.close()
    except Exception as exc:
        return {"database": f"error: {exc}", "pgvector": "unknown"}


@router.get("/health")
def health():
    db = _db_status()
    return {
        "status": "ok",
        "embedding_mode": embedding_mode(),
        "groq_configured": groq_configured(),
        "database": db["database"],
        "pgvector": db["pgvector"],
    }


@router.get("/health/database")
def health_database():
    return _db_status()
