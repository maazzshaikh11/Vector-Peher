# Vector Brain

**Your personal AI-powered research workspace.**

Vector Brain is a multi-document research assistant — a "second brain" for studying. Upload multiple PDFs, ask questions across all of them at once, and get grounded, streamed answers with citations showing the original filename and page number.

Built from the *Notebook LLM Lite* implementation guide (`workspace/user/files/Vector-Brain.pdf`): Vue.js 3 frontend, FastAPI backend, PostgreSQL + pgvector for semantic search, Docling for PDF extraction, Sentence Transformers for embeddings, and the Groq API for answer generation.

## Features

- **Multi-PDF upload** — drag-and-drop or multi-file picker, with upload progress, SHA-256 duplicate detection, file-type/size/integrity validation, and safe storage.
- **Real PDF processing** — Docling extracts text with page numbers, headings, paragraphs, and tables where possible; a pypdf fallback covers PDFs Docling cannot read. Processing runs in the background (states: `UPLOADED → PROCESSING → INDEXING → READY / FAILED`) and never blocks the app.
- **Semantic search** — every chunk is embedded with `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, L2-normalised) and stored in PostgreSQL + pgvector. Questions are embedded with the same model and retrieved with cosine distance (`<=>`), top 5 by default, with an optional per-document filter and a configurable similarity threshold.
- **Grounded RAG chat** — retrieved chunks (filename + page + content) are built into a grounded system prompt and sent to Groq. The assistant answers only from the retrieved context, cites sources, and says so explicitly when the documents do not contain the answer. It never invents facts, quotations, page numbers, or references.
- **Real-time streaming** — answers stream token-by-token over Server-Sent Events (SSE), with a typing indicator, stop-generation support, and persistence of completed answers only.
- **Clickable citations** — every answer carries sources (`Filename.pdf — Page N`); clicking one opens the document in the source panel.
- **Chat sessions** — create, rename, delete, and reload conversations; history persists in PostgreSQL.
- **Three-part workspace** — sidebar (library, recent chats, settings), main chat, and a collapsible document panel with status, size, page count, and delete actions.
- **Light & dark themes** — exact palettes via CSS variables, persisted across reloads.
- **Honest status reporting** — `/api/health` reports the active embedding mode (`sentence-transformers` vs `hash-fallback`) and whether Groq is configured, so the app never silently pretends to be smarter than it is.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | Vue.js 3.4, Composition API, Vite 5, TypeScript, Vue Router 4, Pinia, CSS variables |
| Backend | Python 3.12, FastAPI, Pydantic v2, pydantic-settings, SSE streaming |
| AI / document intelligence | Groq API (answers only), Docling 2.15.0 (pypdf fallback), RAG, Sentence Transformers `all-MiniLM-L6-v2` (384-dim), cosine similarity |
| Database | PostgreSQL 16, pgvector 0.6.0, SQLAlchemy 2, Alembic |
| Testing | Pytest (+ pytest-asyncio), Vitest, Vue Test Utils, Playwright (E2E — see [Known limitations](#known-limitations)) |

Additional packages are used only where they solve a genuine requirement (reportlab for generating test PDFs, `pgvector` Python bindings, `httpx` for the Groq client). No technology from the mandated stack was replaced.

## Architecture

```
PDF upload (drag-drop / picker)
    ↓  Vue 3 frontend (Pinia stores, SSE composable)
    ↓  FastAPI REST + SSE
    ↓  PDF validation & storage (SHA-256, duplicate check)
    ↓  Docling extraction (text + page numbers + structure)
    ↓  Text cleaning & chunking (sentence-aware, 1000 chars / 200 overlap)
    ↓  Sentence Transformer embeddings (384-dim, normalised)
    ↓  PostgreSQL + pgvector (HNSW index, cosine <=>)
    ↓  User question → question embedding → top-5 chunks
    ↓  Groq API (grounded prompt) → streamed answer
    ↓  Vue chat interface → answer + clickable citations
```

The code is modular: document processing, embeddings, retrieval, LLM communication, database access, and API routing live in separate modules (`backend/app/services/{document_processor,embeddings,retrieval,llm}`, `backend/app/repositories`, `backend/app/api`).

## RAG pipeline

1. Receive the user question and identify the chat session.
2. Load relevant conversation history.
3. Embed the question with the same MiniLM model used for indexing.
4. Retrieve the top 5 chunks by cosine similarity from pgvector (filtered to selected documents when requested, excluding deleted/unprocessed documents, applying the similarity threshold).
5. Build a context block of source filename, page number, and extracted content.
6. Construct the grounded system prompt (prioritise uploaded documents, never invent facts or citations, distinguish sources, explain disagreements, say when the answer is not in the documents).
7. Send prompt + context to Groq and stream the answer back over SSE.
8. Save the completed conversation (user message + assistant message with sources) and return citations.

Latency note: the guide's sub-one-second answer latency is an **optimisation target, not a guaranteed SLA** — retrieval latency and time-to-first-token are logged separately, and the first PDF after a server restart takes ~30 s (Docling model load) plus ~20 s for the first embedding-model load.

## Database schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

documents            -- id, filename, original_filename, file_path, file_size,
                     -- page_count, file_hash (SHA-256, unique), status, created_at, updated_at
document_chunks      -- id, document_id (FK, cascade delete), chunk_index,
                     -- content, page_number, metadata, created_at
document_embeddings  -- id, chunk_id (FK, cascade delete), embedding vector(384), created_at
chat_sessions        -- id, title, created_at, updated_at
chat_messages        -- id, session_id (FK, cascade delete), role, content,
                     -- sources (JSON), created_at
```

- `document_embeddings.embedding` carries an HNSW index (`vector_cosine_ops`) for fast approximate cosine search.
- Deleting a document cascades to its chunks and embeddings, so deleted content is never retrieved again.
- All SQL is parameterised (SQLAlchemy); no string-built queries.

## Folder structure

```
vector-brain/
├── README.md                 # this file
├── TEST_REPORT.md            # final test report (counts, bugs, limitations)
├── .env.example              # all environment variables, documented
├── docker-compose.yml        # pgvector/pgvector:pg16 database (port 5432)
├── storage/uploads/          # uploaded PDFs (git-ignored)
├── frontend/                 # Vue 3 + Vite + TypeScript
│   └── src/
│       ├── assets/ components/ views/ layouts/ router/ stores/
│       ├── composables/ services/ types/ styles/ utils/
├── backend/                  # FastAPI
│   ├── app/
│   │   ├── api/              # routes: health, documents, chat, search
│   │   ├── core/             # settings (pydantic-settings)
│   │   ├── models/ schemas/ repositories/ database/
│   │   ├── services/
│   │   │   ├── document_processor/  # Docling extraction (+ pypdf fallback)
│   │   │   ├── embeddings/          # MiniLM + deterministic hash fallback
│   │   │   ├── retrieval/           # pgvector cosine search
│   │   │   └── llm/                 # Groq SSE client
│   │   └── main.py
│   ├── tests/                # pytest suite (real Postgres test DB)
│   ├── alembic/              # migrations (0001_initial)
│   └── requirements.txt      # pinned, verified 2026-11-11
```

## Prerequisites

- Python 3.12+, Node.js 20+ (verified with Node 24), npm 10+
- PostgreSQL 16 + pgvector **or** Docker (for `docker compose up -d db`)
- A Groq API key for live chat answers — get one at <https://console.groq.com> (API Keys → Create). Chat without a key returns a clean `error` event; search, upload, and indexing work without one.

## Installation instructions

### Option A — this VM / no Docker (Ubuntu 24.04)

```bash
# 1. PostgreSQL + pgvector
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER vectorbrain WITH PASSWORD 'vectorbrain' CREATEDB LOGIN;"
sudo -u postgres psql -c "CREATE DATABASE vectorbrain OWNER vectorbrain;"
sudo -u postgres psql -d vectorbrain -c "CREATE EXTENSION vector;"

# 2. Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # then set GROQ_API_KEY
.venv/bin/alembic upgrade head

# 3. Frontend
cd ../frontend
npm install
```

### Option B — Docker (machines that have it)

```bash
# from the repo root
docker compose up -d db
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # then set GROQ_API_KEY
.venv/bin/alembic upgrade head
cd ../frontend && npm install
```

## Environment configuration

Copy `.env.example` to `.env` (repo root or `backend/.env` — the backend reads `backend/.env` first, then the root `.env`). Never commit `.env`.

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | _(empty)_ | Groq API key. Required for chat answers; without it `/api/chat` streams an `error` event. Never put it in frontend code or browser storage. |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq chat model. Must be a currently supported Groq model. |
| `DATABASE_URL` | `postgresql://vectorbrain:vectorbrain@localhost:5432/vectorbrain` | SQLAlchemy URL for the app database. |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Local embedding model (384-dim). Groq never generates embeddings. |
| `UPLOAD_DIR` | `storage/uploads` | Where uploaded PDFs are stored (relative to the repo root). |
| `MAX_UPLOAD_SIZE_MB` | `50` | Per-file upload limit. |
| `TOP_K` | `5` | Default number of chunks retrieved per question. |
| `CHUNK_SIZE` | `1000` | Chunk size in characters. |
| `CHUNK_OVERLAP` | `200` | Overlap between consecutive chunks in characters. |
| `SIMILARITY_THRESHOLD` | `0.2` | Cosine-similarity floor for retrieved chunks. |

## PostgreSQL and pgvector setup

See [Installation](#installation-instructions). The essentials:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Migrations are managed with Alembic (`backend/alembic/versions/0001_initial.py` creates all five tables plus the HNSW vector index). Apply with `alembic upgrade head` from `backend/`. The test suite creates its own database, `vectorbrain_test`.

> **VM restart warning (observed 2026-11-11):** on this VM the PostgreSQL data directory lives outside `/home`, so a VM restart/replacement wipes the cluster (only the packages survive). After a restart, re-run the cluster start plus the user/database/extension SQL from Option A step 1, then `alembic upgrade head`. Uploaded files under `storage/` survive; indexed content must be re-uploaded.

## Backend startup

```bash
cd backend
# HF_HUB_OFFLINE=1 is required on this VM: the :3128 proxy can stall a
# HuggingFace request indefinitely (one test run hung 40 min on it).
# The MiniLM weights are already in the local HF cache, so offline
# mode loads them fine.
HF_HUB_OFFLINE=1 .venv/bin/uvicorn app.main:app --port 8000
```

- API: <http://localhost:8000> — interactive docs at `/docs`.
- Health: `GET /api/health` → `{status, embedding_mode, groq_configured, database, pgvector}`.
- Database health: `GET /api/health/database`.

## Frontend startup

```bash
cd frontend
npm run dev      # http://localhost:5173 — /api is proxied to http://localhost:8000
```

Set `VITE_API_BASE_URL` to point at a different backend. Production build: `npm run build`, then serve `dist/` with any static server and `npm run preview` (port 5173) — or serve `dist/` behind the same host that serves the API; the app uses relative `/api` calls through the Vite proxy in dev, and `VITE_API_BASE_URL` in production builds.

## Docker instructions

```bash
docker compose up -d db   # pgvector/pgvector:pg16, port 5432, volume vectorbrain-data
```

The backend and frontend run on the host (see startup sections above); only the database is containerised, so the app also works on machines without Docker by following Option A.

## API reference

| Route | Description |
|---|---|
| `GET /api/health` | Overall health + embedding mode + Groq configured flag |
| `GET /api/health/database` | Postgres + pgvector check |
| `POST /api/documents/upload` | Multipart `files` (multiple PDFs). Duplicates by SHA-256 return `duplicate: true` with HTTP 200 and are not re-indexed |
| `GET /api/documents` | List documents |
| `GET /api/documents/{id}` | One document |
| `GET /api/documents/{id}/status` | Processing status |
| `DELETE /api/documents/{id}` | Delete file + chunks + embeddings (cascade) |
| `POST /api/chat` | SSE `text/event-stream`: `sources` (emitted first, right after retrieval — so citations are visible even when the LLM is down) → `token`* → `done`; `error` event if Groq is unconfigured. Body: `{question, session_id?, document_ids? (null = all), top_k?}`. A session auto-created for a chat that fails before any message is persisted is removed again, so failed chats leave no empty sessions. |
| `GET /api/chat/sessions` | List sessions |
| `POST /api/chat/sessions` | Create session |
| `GET /api/chat/sessions/{id}` | One session with messages |
| `PATCH /api/chat/sessions/{id}` | Rename session |
| `DELETE /api/chat/sessions/{id}` | Delete session |
| `POST /api/search` | `{query, document_ids?, top_k?}` → cited chunks with scores |
| `GET /api/search/documents/{id}` | Chunks of one document (source panel) |

Only completed assistant messages (plus the user message) are persisted; incomplete streams are never stored as successful answers.

## Testing commands

```bash
# Backend (real Postgres test DB vectorbrain_test; Groq mocked — no key needed)
cd backend
HF_HUB_OFFLINE=1 .venv/bin/python -m pytest tests/ -q

# Frontend (Vitest + Vue Test Utils)
cd frontend
npm test
npm run build

# End-to-end (Playwright) — see Known limitations
```

Exact counts and results: see [`TEST_REPORT.md`](TEST_REPORT.md).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `HF_HUB_OFFLINE=1` missing and a request hangs | The VM's `:3128` proxy stalls HuggingFace requests. Always run the backend and tests with `HF_HUB_OFFLINE=1`. The MiniLM weights are in the local HF cache. |
| `/api/health` reports `embedding_mode: hash-fallback` | The MiniLM model could not load (no torch / cache missing). Retrieval still ranks chunks sharing vocabulary with the query, but it is **not** semantic — do not claim semantic quality in this mode. |
| First PDF after restart is slow (~50 s) | Expected: Docling model load (~30 s) + first embedding load (~20 s). Later requests take seconds. |
| `POST /api/chat` streams an `error` event | `GROQ_API_KEY` is not set in `backend/.env`. Search, upload, and indexing still work; only answer generation needs the key. |
| `database: error` on `/api/health` | Postgres is down — `sudo pg_ctlcluster 16 main start`. After a VM restart, also recreate the user/database/extension (see the restart warning above) and run `alembic upgrade head`. |
| Docling import errors about `BoundingBox` | `docling-core` must be **2.40.0** (2.84+ moved `BoundingBox`); the pin is in `backend/requirements.txt`. |
| Scanned/image PDFs return little text | OCR is off (`do_ocr=False`) and the table-structure model is off to avoid multi-hundred-MB downloads; such PDFs fall back to pypdf, which extracts programmatic text only. |

## Known limitations

- **Live Groq chat is unverified without an API key.** The SSE contract, retrieval, citation plumbing, and the clean `error` event for an unconfigured key are all verified; an actual Groq-generated answer has not been observed on this VM because no key is on file. Add `GROQ_API_KEY` to `backend/.env` and ask a question to verify it end to end.
- **Playwright E2E ran on the headless shell only** (15/15 checks passed — see `TEST_REPORT.md`). The full-Chromium download failed once on this VM's network, so headed mode and full-Chromium-only features were not exercised; nothing in the journey needed them. The same journey was also verified at the API level.
- **Postgres does not survive a VM restart** on this machine (data dir outside `/home`); see the recovery commands in [PostgreSQL and pgvector setup](#postgresql-and-pgvector-setup).
- **Docling quirks:** layout model is served from a local `backend/.docling-models/` copy (the HuggingFace download stalls behind the VM proxy); table structure and OCR are disabled, so scanned PDFs rely on the pypdf fallback.
- **Embedding fallback:** if the MiniLM model cannot load, the app falls back to a deterministic 384-dim word-hash vector and says so on `/api/health`. Retrieval quality in that mode is keyword-overlap only.
- **Single-user, no authentication.** The app is a personal research workspace; there is no login, per-user isolation, or rate limiting. Do not expose it publicly as-is.
- The sub-one-second answer-latency figure from the guide is an optimisation target, not a measured SLA.
