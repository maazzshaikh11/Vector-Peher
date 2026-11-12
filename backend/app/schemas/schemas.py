"""Pydantic schemas for the Vector Brain API."""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.models import DocumentStatus


# --- Documents ---
class DocumentSummary(BaseModel):
    id: uuid.UUID
    filename: str
    original_filename: str
    file_size: int
    page_count: int | None = None
    file_hash: str
    status: DocumentStatus
    error_message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    chunk_count: int = 0
    duplicate: bool = False

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    documents: list[DocumentSummary]


class DocumentStatusResponse(BaseModel):
    id: uuid.UUID
    status: DocumentStatus
    page_count: int | None = None
    chunk_count: int = 0
    error_message: str | None = None


class ChunkOut(BaseModel):
    id: uuid.UUID
    chunk_index: int
    content: str
    page_number: int | None = None
    metadata: dict | None = None

    model_config = {"from_attributes": True}


# --- Search ---
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    document_ids: list[uuid.UUID] | None = None
    top_k: int = Field(default=5, ge=1, le=50)


class SearchResult(BaseModel):
    content: str
    filename: str
    page_number: int | None = None
    score: float
    chunk_id: uuid.UUID
    document_id: uuid.UUID


class SearchResponse(BaseModel):
    results: list[SearchResult]


# --- Chat ---
class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    session_id: uuid.UUID | None = None
    document_ids: list[uuid.UUID] | None = None
    top_k: int = Field(default=5, ge=1, le=50)


class ChatSessionCreate(BaseModel):
    title: str | None = None


class ChatSessionUpdate(BaseModel):
    title: str = Field(..., min_length=1)


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    sources: list | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ChatSessionOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    messages: list[ChatMessageOut] = []

    model_config = {"from_attributes": True}


class ChatSessionSummary(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    message_count: int = 0

    model_config = {"from_attributes": True}
