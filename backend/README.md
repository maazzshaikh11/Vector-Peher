# Vector Brain — Backend

Multi-document research AI: upload PDFs, index them into PostgreSQL +
pgvector, and ask grounded questions answered by Groq with citations.

## Stack

- Python 3.12, FastAPI + Pydantic, SQLAlchemy + Alembic
- PostgreSQL 16 + pgvector 0.6.0 (HNSW index, cosine `<=>`, 384-dim)
- Docling for PDF extraction (pypdf fallback if Docling is unavailable)
- sentence-transformers `all-MiniLM-L6-v2` (384-dim); deterministic
  hash fallback if the model cannot load — `/api/health` reports the
  active mode honestly
- Groq API for answers **only** (never embeddings), SSE streaming

## Setup (this VM — no Docker)

```bash
# 1. PostgreSQL + pgvector (Ubuntu 24.04)
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER vectorbrain WITH PASSWORD 'vectorbrain' CREATEDB LOGIN;"
sudo -u postgres psql -c "CREATE DATABASE vectorbrain OWNER vectorbrain;"
sudo -u postgres psql -d vectorbrain -c "CREATE EXTENSION vector;"

# 2. Python deps (CPU-only torch — the default PyPI wheel is CUDA and ~800MB)
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # then set GROQ_API_KEY

# 3. Migrations + run
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000
```

API: http://localhost:8000 — interactive docs at `/docs`.

> **VM survival notes (observed 2026-11-11):** the PostgreSQL data dir
> lives outside `/home`, so a VM restart/replacement wipes the cluster
> (only the packages survive). After a restart, re-run step 1's
> `pg_ctlcluster 16 main start` plus the user/DB/extension SQL and
> `alembic upgrade head`. The server also needs `HF_HUB_OFFLINE=1` on
> this VM — the `:3128` proxy can stall a HuggingFace request
> indefinitely (one pytest run hung 40 min on it); the MiniLM weights
> are already in the local HF cache, so offline mode loads them fine.
> Run the server as: `HF_HUB_OFFLINE=1 .venv/bin/uvicorn app.main:app --port 8000`.

## Setup (Docker — for machines that have it)

```bash
# from the repo root
docker compose up -d db
cd backend && .venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000
```

`docker-compose.yml` runs `pgvector/pgvector:pg16` on port 5432.

## Configuration (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `GROQ_API_KEY` | _(empty)_ | Required for chat answers; without it `/api/chat` streams an `error` event |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | |
| `DATABASE_URL` | `postgresql://vectorbrain:vectorbrain@localhost:5432/vectorbrain` | |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | |
| `UPLOAD_DIR` | `storage/uploads` | Relative to repo root |
| `MAX_UPLOAD_SIZE_MB` | `50` | |
| `TOP_K` | `5` | |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1000` / `200` | chars |
| `SIMILARITY_THRESHOLD` | `0.2` | cosine similarity floor for retrieval |

## Endpoints

| Route | Notes |
|---|---|
| `GET /api/health` | `status`, `embedding_mode`, `groq_configured`, `database`, `pgvector` |
| `GET /api/health/database` | Postgres + pgvector check |
| `POST /api/documents/upload` | multipart `files` (multiple PDFs); duplicates by SHA-256 return `duplicate: true` with HTTP 200 and are not re-indexed |
| `GET /api/documents`, `GET /api/documents/{id}`, `GET /api/documents/{id}/status` | |
| `DELETE /api/documents/{id}` | deletes file + chunks + embeddings (cascade) |
| `POST /api/chat` | SSE `text/event-stream`: `sources` (emitted first, right after retrieval — visible even if the LLM is down) → `token`* → `done`; `error` event if Groq is unconfigured. A session auto-created for a chat that fails before any message is persisted is removed again. |
| `GET/POST /api/chat/sessions`, `GET/PATCH/DELETE /api/chat/sessions/{id}` | |
| `POST /api/search` | `{query, document_ids?, top_k?}` → cited chunks with scores |
| `GET /api/search/documents/{id}` | chunks of one document (source panel) |

Chat request: `{question, session_id?, document_ids? (null = all), top_k?}`.
Only completed assistant messages (+ the user message) are persisted.

## Tests

```bash
cd backend
.venv/bin/python -m pytest tests/ -q
```

Uses a real Postgres test DB `vectorbrain_test` (created by the
session fixture) and generates sample PDFs with reportlab. Groq is
mocked in tests — no real key needed.

## Embedding modes (honest status)

- `sentence-transformers`: the real MiniLM model loaded; semantic search.
  Verified on this VM 2026-11-11: model files in the HF cache
  (`~/.cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2`),
  384-dim, self-similarity 1.0, unrelated-topic similarity ~0.07.
- `hash-fallback`: model unavailable (no torch / download failed). A
  deterministic 384-dim word-hash vector, L2-normalised. Retrieval still
  ranks chunks sharing vocabulary with the query, but it is **not**
  semantic — do not claim semantic quality in this mode.

## Docling notes (this VM)

Docling 2.15.0 is installed and is the primary extractor, but two
environment quirks were worked around (both verified 2026-11-11):

- `docling-core` must be **2.40.0**: 2.84+ moved `BoundingBox` out of
  `docling_core.types.legacy_doc.base`, which docling 2.15.0 still imports.
- The layout model (`ds4sd/docling-models@v2.1.0`, 171MB) could not be
  fetched by the `huggingface_hub` client on this VM (proxy read-timeouts),
  so it was downloaded with curl into `backend/.docling-models/` and the
  processor passes it as `artifacts_path`. Table structure is off
  (`do_table_structure=False`) and OCR is off (`do_ocr=False`) to avoid
  further multi-hundred-MB model downloads; scanned/image PDFs fall back
  to pypdf, which extracts programmatic text with page numbers.
- First PDF after a server restart takes ~30s (Docling model load) plus
  ~20s for the first embedding-model load; later requests are seconds.
