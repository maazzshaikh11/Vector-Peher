"""Vector Brain — multi-document research AI (FastAPI + pgvector)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_chat, routes_documents, routes_health, routes_search
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title="Vector Brain", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_health.router, prefix="/api")
app.include_router(routes_documents.router, prefix="/api")
app.include_router(routes_search.router, prefix="/api")
app.include_router(routes_chat.router, prefix="/api")


@app.get("/")
def root():
    return {"name": "Vector Brain", "version": "0.1.0", "docs": "/docs"}
