"""Chat endpoints: SSE streaming Q&A + session CRUD.

SSE event sequence: {"type":"sources","sources":[...]} first (emitted right
after retrieval, so the client can show citations even if the LLM is down),
then {"type":"token","text":...}* then {"type":"done","session_id":...}.
If GROQ_API_KEY is missing, the stream carries the sources event followed by
a single {"type":"error","message":"GROQ_API_KEY not configured..."} event
with HTTP 200 (documented behaviour — the client reads the event stream).
Only COMPLETED assistant messages (plus the user message) are persisted.
A session auto-created for a chat that then fails before any message is
persisted is removed again, so failed chats do not leave empty sessions.
"""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.session import get_db
from app.models.models import ChatMessage, ChatSession
from app.schemas.schemas import (
    ChatRequest,
    ChatSessionCreate,
    ChatSessionOut,
    ChatSessionSummary,
    ChatSessionUpdate,
)
from app.services.embeddings.embeddings import embed_query
from app.services.llm.groq_client import (
    GroqNotConfigured,
    GroqProviderError,
    GroqRateLimited,
    groq_configured,
    stream_chat,
)
from app.services.retrieval.retrieval import search_chunks

router = APIRouter()
settings = get_settings()

SYSTEM_PROMPT = (
    "You are Vector Brain, an accurate multi-document research assistant. "
    "Answer questions using the information provided in the retrieved document context. "
    "Rules: Prioritize uploaded documents over general knowledge. "
    "Never invent facts, quotations, page numbers or document references. "
    "Use multiple documents when they contain relevant information. "
    "Clearly distinguish information from different documents. "
    "Cite the original filename and page number. "
    "If the documents do not contain enough information, explicitly say so. "
    "Do not pretend to have read content that was not retrieved. "
    "Keep answers relevant and well structured. "
    "Use headings, lists and tables when appropriate. "
    "Preserve important technical terminology. "
    "When sources disagree, explain the disagreement and cite both sources."
)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _build_context(results: list[dict]) -> str:
    if not results:
        return ""
    parts = []
    for r in results:
        parts.append(
            f"[Source: {r['filename']}, page {r['page_number']}]\n{r['content']}"
        )
    return "\n\n".join(parts)


def _get_or_create_session(db: Session, session_id: uuid.UUID | None, question: str) -> ChatSession:
    if session_id is not None:
        session = db.get(ChatSession, session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Chat session not found.")
        return session
    title = (question[:60] + "…") if len(question) > 60 else question
    session = ChatSession(title=title or "New chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _cleanup_empty_session(session_id: uuid.UUID) -> None:
    """Delete a session that has no messages (auto-created for a chat that
    failed before anything was persisted). Best-effort; never raises."""
    try:
        from app.database.session import SessionLocal

        pdb = SessionLocal()
        try:
            count = (
                pdb.query(ChatMessage)
                .filter(ChatMessage.session_id == session_id)
                .count()
            )
            if count == 0:
                session = pdb.get(ChatSession, session_id)
                if session is not None:
                    pdb.delete(session)
                    pdb.commit()
        finally:
            pdb.close()
    except Exception:
        pass


@router.post("/chat")
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    auto_created = req.session_id is None
    session = _get_or_create_session(db, req.session_id, req.question)
    session_id = session.id

    # Retrieve first (needed for sources + context even if Groq is down).
    qvec = embed_query(req.question)
    results = search_chunks(
        db, qvec, top_k=req.top_k, document_ids=req.document_ids
    )
    sources = [
        {
            "filename": r["filename"],
            "page_number": r["page_number"],
            "chunk_id": str(r["chunk_id"]),
            "score": round(r["score"], 4),
        }
        for r in results
    ]

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(6)
        .all()
    )
    history = list(reversed(history))

    context = _build_context(results)
    if context:
        user_content = (
            f"Retrieved document context:\n\n{context}\n\n"
            f"Question: {req.question}"
        )
    else:
        user_content = (
            "No relevant content was retrieved from the uploaded documents.\n\n"
            f"Question: {req.question}\n\n"
            "If the documents do not contain enough information to answer, "
            "say so explicitly."
        )
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in history:
        messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": user_content})

    async def event_stream():
        full_answer = ""
        # Sources first: the client can show citations even if the LLM
        # is unconfigured or fails mid-stream.
        yield _sse({"type": "sources", "sources": sources})
        try:
            if not groq_configured():
                yield _sse(
                    {
                        "type": "error",
                        "message": "GROQ_API_KEY not configured on the server. "
                        "Set GROQ_API_KEY to enable answers.",
                    }
                )
                if auto_created:
                    _cleanup_empty_session(session_id)
                return
            async for token in stream_chat(messages, settings.groq_model, timeout=settings.groq_timeout_seconds):
                full_answer += token
                yield _sse({"type": "token", "text": token})
        except GroqNotConfigured:
            yield _sse(
                {
                    "type": "error",
                    "message": "GROQ_API_KEY not configured on the server. "
                    "Set GROQ_API_KEY to enable answers.",
                }
            )
            if auto_created:
                _cleanup_empty_session(session_id)
            return
        except GroqRateLimited as exc:
            yield _sse({"type": "error", "message": str(exc)})
            if auto_created:
                _cleanup_empty_session(session_id)
            return
        except GroqProviderError as exc:
            yield _sse({"type": "error", "message": str(exc)})
            if auto_created:
                _cleanup_empty_session(session_id)
            return

        # Persist only completed exchanges.
        try:
            from app.database.session import SessionLocal

            pdb = SessionLocal()
            try:
                pdb.add(ChatMessage(session_id=session_id, role="user", content=req.question))
                pdb.add(
                    ChatMessage(
                        session_id=session_id,
                        role="assistant",
                        content=full_answer,
                        sources=sources,
                    )
                )
                pdb.commit()
            finally:
                pdb.close()
        except Exception:
            pass
        yield _sse({"type": "done", "session_id": str(session_id)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# --- Session CRUD ---
@router.get("/chat/sessions", response_model=list[ChatSessionSummary])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).all()
    return [
        ChatSessionSummary(
            id=s.id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            message_count=len(s.messages),
        )
        for s in sessions
    ]


@router.post("/chat/sessions", response_model=ChatSessionOut, status_code=201)
def create_session(body: ChatSessionCreate, db: Session = Depends(get_db)):
    session = ChatSession(title=body.title or "New chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionOut)
def get_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return session


@router.patch("/chat/sessions/{session_id}", response_model=ChatSessionOut)
def update_session(session_id: uuid.UUID, body: ChatSessionUpdate, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    session.title = body.title
    db.commit()
    db.refresh(session)
    return session


@router.delete("/chat/sessions/{session_id}")
def delete_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    session = db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    db.delete(session)
    db.commit()
    return {"deleted": True, "id": str(session_id)}
