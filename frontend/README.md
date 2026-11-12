# Vector Brain — Frontend

Vue 3 + Vite + TypeScript + Vue Router + Pinia. Light/dark themes via CSS variables, persisted in `localStorage` (`vector-brain-theme`).

## Run
```bash
npm install
npm run dev      # http://localhost:5173, /api proxied to http://localhost:8000
npm run build
npm test
```
Set `VITE_API_BASE_URL` to point at a different backend (default `http://localhost:8000`).

## Backend contract
Implements exactly the API in the task brief: health, document upload/list/status/delete, chat sessions CRUD, SSE `POST /api/chat` (token/sources/done/error events, AbortController stop), and `POST /api/search`. No mocked responses — every control calls the real API; without a backend running, health shows "Backend unreachable" and actions surface an error toast.
