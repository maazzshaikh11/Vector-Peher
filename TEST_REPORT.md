# Vector Brain — Final Test Report

**Date:** 2026-11-11 (IST). **Scope:** Phases 6–8 independent verification of the
full stack in `~/workspace/vector-brain`. All counts below were produced by
re-running the suites and the live end-to-end journey during this verification
pass — no builder-claimed counts were trusted. Where a run was repeated (backend
suite before/after a fix), the final run is reported.

## Summary counts

| Suite | Total | Passed | Failed | Skipped | Blocked | Verdict |
|---|---|---|---|---|---|---|
| Backend pytest | 27 | 27 | 0 | 0 | 0 | ✅ PASS |
| Frontend Vitest | 48 | 48 | 0 | 0 | 0 | ✅ PASS |
| Frontend production build (`vue-tsc + vite build`) | 1 | 1 | 0 | 0 | 0 | ✅ PASS |
| Live API E2E (curl, real servers) | 10 steps | 10 | 0 | 0 | 0 | ✅ PASS |
| Playwright browser E2E (headless shell) | 15 checks | 15 | 0 | 0 | 0 | ✅ PASS |
| **Total** | **101** | **101** | **0** | **0** | **0** | ✅ **PASS** |

No test was skipped, disabled, weakened, or marked passed while blocked.

## Backend — pytest (27 passed)

**Command:** `cd backend && HF_HUB_OFFLINE=1 .venv/bin/python -m pytest tests/ -q`
**Result:** `27 passed, 16 warnings in 68.53s` (final run, after the SSE-order fix;
an identical 27-passed run preceded the fix in 70.84s).

- Tests use a real PostgreSQL test database (`vectorbrain_test`) and generate
  sample PDFs with reportlab. Groq is mocked — no real key needed.
- The 16 warnings are pre-existing deprecations only (pytest-asyncio loop-scope,
  Starlette `httpx` deprecation, Pydantic `@model_validator`, Docling
  `generate_table_images`). No failures or errors.
- Coverage areas exercised: app startup, health + database health, migrations,
  pgvector extension, PDF validation, multi-file upload, invalid-PDF rejection,
  duplicate detection (SHA-256), Docling extraction with page numbers, chunking,
  384-dim embedding shape, vector insertion, cosine retrieval, document
  filtering, document deletion + cascade, session CRUD, chat SSE (incl. the
  no-Groq error path and a mocked-Groq streamed answer with persisted sources),
  citation generation, error handling.

## Frontend — Vitest (48 passed) + build

**Commands:** `cd frontend && npm test` → `npm run build`
**Result:** `Test Files 6 passed (6) · Tests 48 passed (48)` in ~5.5s; build
`vue-tsc -b && vite build` clean, 87 modules, ~2s.

| Test file | Tests |
|---|---|
| `src/services/api.test.ts` | 15 passed |
| `src/components/components.test.ts` | 15 passed |
| `src/stores/chat.test.ts` | 5 passed |
| `src/stores/documents.test.ts` | 5 passed |
| `src/composables/useStreaming.test.ts` | 4 passed |
| `src/stores/theme.test.ts` | 4 passed |

## Live API E2E — 10/10 steps (real servers)

Backend `uvicorn` on :8000 (PostgreSQL 16 + pgvector 0.6.0, embedding mode
`sentence-transformers`, Groq unconfigured), frontend dev server on :5173.

| # | Step | Result |
|---|---|---|
| 1 | `GET /api/health` + `GET /api/health/database` | ✅ `{"status":"ok","embedding_mode":"sentence-transformers","groq_configured":false,"database":"ok","pgvector":"0.6.0"}`, Postgres 16.15 |
| 2 | Fresh PDF generated (reportlab, distinctive invented content: "quokka propulsion", thrust-to-weight 4.2, p.1; "QuokkaJet" rover, Rottnest Island, p.2) | ✅ 2 pages, 2,379 bytes; no user files used |
| 3 | `POST /api/documents/upload` → poll status | ✅ HTTP 200, `duplicate:false`, `PROCESSING` at +3s → `READY` at +8s, `page_count:2, chunk_count:2` |
| 4 | `POST /api/search` ("What is quokka propulsion…") | ✅ Exactly the 2 fresh chunks, verbatim, `filename:"quokka-propulsion-e2e.pdf"`, p.1 score 0.812, p.2 score 0.687 |
| 5 | `POST /api/chat` (Groq unconfigured) | ✅ HTTP 200, SSE `sources` event then a single `error` event (`GROQ_API_KEY not configured…`); zero `token` events — no answer fabricated |
| 6 | Chat sessions CRUD (create/list/get/rename/delete) | ✅ Rename changed `updated_at`; delete → `{"deleted":true}`; GET after delete → 404 |
| 7 | Re-upload same PDF | ✅ HTTP 200, same id, `"duplicate":true`, still `READY`, `chunk_count:2` — not re-indexed |
| 8 | Delete document, then search again (p.1 + p.2 terms) | ✅ `{"deleted":true}`, status → 404, both searches → `{"results":[]}` |
| 9 | Frontend smoke (curl) | ✅ :5173 `index.html`/`main.ts`/`@vite/client` 200; `GET :5173/api/health` returns the real backend JSON (Vite proxy live) |
| 10 | Playwright browser journey | ✅ 15/15 (see below) |

## Playwright browser E2E — 15/15 checks

Real headless Chromium (headless shell, `chromium_headless_shell-1254`) against
the live servers; script saved at `e2e-verification/playwright-e2e.cjs`
(re-runnable with `node playwright-e2e.cjs`), final screenshot at
`e2e-verification/final-screenshot.png`.

- App loads (title "Vector Brain — Your personal AI-powered research workspace"), dropzone visible
- UI upload of the quokka PDF → card appears → badge "Ready"; composer enabled once READY
- Asked Q1 → assistant message: *"Sorry — I could not get an answer: GROQ_API_KEY not configured…"* plus a "Chat error" toast; verified no "4.2"/fabricated text in the reply
- Follow-up question → second identical honest error
- Dark mode toggle → `data-theme="dark"`, `localStorage['vector-brain-theme']="dark"`; **reload → still dark** (persistence verified); restored to light afterwards
- UI delete (Delete → confirm dialog → Delete) → card detached; backend confirms the document is gone; post-delete search → 0 results

## Production build serving — verified

`npm run build` output served with `vite preview` on port 5199: index returns
HTTP 200 and `GET /api/health` through the preview server returns the real
backend health JSON. In production the frontend calls the backend at
`VITE_API_BASE_URL` (default `http://localhost:8000`), so serving `dist/` works
whenever the backend is reachable at that URL; the Vite dev proxy covers `:5173`.

## Bugs found and fixed during this verification pass

1. **Citations invisible when Groq is down (product gap, fixed).** `routes_chat.py`
   emitted the `sources` SSE event only after a successful LLM stream, so with
   Groq unconfigured the user saw the error but never the retrieved sources
   that `/api/search` proves exist. **Fix:** the `sources` event is now emitted
   immediately after retrieval, before any Groq call (`sources → token* → done`).
   The frontend composable/store handle `sources` at any point in the stream, so
   no frontend change was needed. Backend tests updated to the new order and
   strengthened (assert sources precede the error; assert no tokens on the
   error path). Re-verified live: `POST /api/chat` now streams
   `sources` then `error`, and the UI shows citations alongside the honest error.
2. **Empty sessions accumulated from failed chats (minor, fixed).** Each
   `POST /api/chat` auto-created a session before the Groq check, and the error
   path persisted nothing, leaving 0-message sessions. **Fix:** on any Groq
   error path, an auto-created session with no messages is deleted again
   (`_cleanup_empty_session`). Test strengthened: after a no-Groq chat,
   `GET /api/chat/sessions` returns `[]`. Re-verified live: a failed chat left
   no new session.
3. **Root README was missing (fixed).** Wrote `README.md` with all 17 sections
   from the brief; updated the SSE sequence in both READMEs after fix #1.
4. **No `.gitignore` existed (fixed).** Added a root `.gitignore` covering
   `.env`, `backend/.venv/`, `backend/.docling-models/`, `frontend/node_modules/`,
   `frontend/dist/`, `storage/uploads/`.

No failures occurred in either test suite, so no TEST→ANALYZE→FIX→RETEST cycles
beyond the two deliberate improvements above were needed, and no code was
changed to make a failing test pass.

## Final QA checks

- **Secrets:** grepped the repo for `gsk_`/key material — none found.
  `backend/.env` has an empty `GROQ_API_KEY`; `.env.example` files at the repo
  root and in `backend/` document every variable with safe defaults.
- **CORS:** restricted to `http://localhost:5173,http://127.0.0.1:5173` by
  default (`cors_origins` env var); `allow_methods/headers` are `*` within those
  origins.
- **No mocks/fake data in app code:** `mock`/`fake` matches exist only in
  `*.test.ts` files (expected). No `TODO`/`FIXME` in `backend/app` or
  `frontend/src`. No fake document data, analytics, or placeholder buttons.
- **SQL:** all queries are parameterised (SQLAlchemy); vector search uses
  pgvector `<=>` with an HNSW index.
- **Key handling:** the Groq key is read only from backend env vars, never
  exposed to the browser, never logged, never committed.

## Remaining limitations (not failures)

- **Live Groq chat is UNVERIFIED — no API key on file.** The SSE contract,
  retrieval, citation plumbing, and the honest-error path are all verified end
  to end, but an actual Groq-generated answer has never been observed on this
  VM. To verify: add `GROQ_API_KEY` to `backend/.env` and ask a question.
  (Do not paste the key in chat; put it in the `.env` file.)
- **PostgreSQL does not survive a VM restart on this machine** (data dir
  outside `/home`). Recovery commands are in `README.md` (§ PostgreSQL and
  pgvector setup) and `backend/README.md`: restart the cluster, recreate the
  user/database/extension, run `alembic upgrade head`, re-upload documents.
- **Docling quirks:** layout model is served from a local
  `backend/.docling-models/` copy (the HuggingFace download stalls behind the
  VM proxy); table structure and OCR are disabled, so scanned/image-only PDFs
  fall back to pypdf (programmatic text only). `docling-core` must stay pinned
  at 2.40.0.
- **Embedding fallback:** if the MiniLM model cannot load, the app falls back
  to a deterministic 384-dim word-hash vector and reports `hash-fallback` on
  `/api/health`. Retrieval then ranks by shared vocabulary only — not semantic.
- **Playwright ran on the headless shell only.** The full-Chromium download
  failed once (`Failed to download Chrome for Testing 158.0.8127.18,
  code=1`) and an `apt-get update` stalled >6 min, so headed mode and
  full-Chromium-only features were not exercised; nothing in the journey needed
  them. No system Chrome/Firefox exists on this VM.
- **Single-user, no auth.** Personal research workspace; no login, per-user
  isolation, or rate limiting. Do not expose publicly as-is.
- **Pre-existing artefacts left in the dev database** (not created by this
  verification pass, left untouched): documents `live-sample.pdf` and
  `live-sample2.pdf` (READY, created 2026-11-11 16:35–16:37 UTC) and one
  0-message session titled "What is quantum computing?" (16:35 UTC). Delete
  them via the UI or `DELETE /api/documents/{id}` if a clean slate is wanted.
- The sub-one-second answer-latency figure from the guide is an optimisation
  target, not a measured SLA; retrieval latency and time-to-first-token are
  logged separately.
- First PDF after a server restart takes ~30 s (Docling model load) plus ~20 s
  for the first embedding-model load; later requests take seconds. The E2E
  upload reached READY in 8 s only because the models were already warm.

## How to run the app (verified commands)

```bash
# 1. Database (already online on this VM: cluster 16/main, port 5432)
sudo pg_ctlcluster 16 main start   # after a VM restart, also recreate the
                                   # user/database/extension — see README.md

# 2. Backend (HF_HUB_OFFLINE=1 is required on this VM)
cd ~/workspace/vector-brain/backend
HF_HUB_OFFLINE=1 .venv/bin/uvicorn app.main:app --port 8000

# 3. Frontend
cd ~/workspace/vector-brain/frontend
npm run dev                        # http://localhost:5173

# 4. Tests
cd ../backend && HF_HUB_OFFLINE=1 .venv/bin/python -m pytest tests/ -q
cd ../frontend && npm test && npm run build
```
