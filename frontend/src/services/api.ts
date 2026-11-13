import type { ChatSession, DocumentItem, HealthResponse, SearchResult } from '../types'

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000'
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const j = await res.json(); msg = (j as { detail?: string; message?: string }).detail || (j as { message?: string }).message || msg } catch { /* keep default */ }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function checkHealth(): Promise<HealthResponse> {
  return handle<HealthResponse>(await fetch(`${API_BASE_URL}/api/health`))
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const data = await handle<DocumentItem[] | { documents: DocumentItem[] }>(await fetch(`${API_BASE_URL}/api/documents`))
  return Array.isArray(data) ? data : data.documents ?? []
}

export async function uploadDocuments(files: File[], onProgress?: (loaded: number, total: number) => void): Promise<DocumentItem[]> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  // fetch has no upload progress; report indeterminate start, then completion.
  onProgress?.(0, files.reduce((s, f) => s + f.size, 0))
  const data = await handle<DocumentItem[] | { documents: DocumentItem[] }>(
    await fetch(`${API_BASE_URL}/api/documents/upload`, { method: 'POST', body: form }),
  )
  const docs = Array.isArray(data) ? data : data.documents ?? []
  onProgress?.(files.reduce((s, f) => s + f.size, 0), files.reduce((s, f) => s + f.size, 0))
  return docs
}

export async function getDocumentStatus(id: string): Promise<{ id: string; status: string }> {
  return handle(await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}/status`))
}

/** Rename a document's display name. Requires a backend PATCH
 *  /api/documents/{id} endpoint — if the server does not implement it yet,
 *  this throws and the caller surfaces the failure (no silent rename). */
export async function renameDocument(id: string, filename: string): Promise<DocumentItem> {
  return handle(await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  }))
}

/** Ask the backend to reprocess a FAILED document. Requires a backend POST
 *  /api/documents/{id}/reprocess endpoint — see renameDocument note. */
export async function reprocessDocument(id: string): Promise<DocumentItem> {
  return handle(await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}/reprocess`, { method: 'POST' }))
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed (${res.status})`)
}

export async function listSessions(): Promise<ChatSession[]> {
  return handle(await fetch(`${API_BASE_URL}/api/chat/sessions`))
}
export async function createSession(title?: string): Promise<ChatSession> {
  return handle(await fetch(`${API_BASE_URL}/api/chat/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(title ? { title } : {}) }))
}
export async function getSession(id: string): Promise<ChatSession> {
  return handle(await fetch(`${API_BASE_URL}/api/chat/sessions/${encodeURIComponent(id)}`))
}
export async function renameSession(id: string, title: string): Promise<ChatSession> {
  return handle(await fetch(`${API_BASE_URL}/api/chat/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }))
}
export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed (${res.status})`)
}

export async function searchDocuments(query: string, documentIds?: string[] | null, topK = 5): Promise<SearchResult[]> {
  const data = await handle<{ results: SearchResult[] }>(await fetch(`${API_BASE_URL}/api/search`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, document_ids: documentIds ?? null, top_k: topK }),
  }))
  return data.results ?? []
}

export function chatStreamUrl(): string { return `${API_BASE_URL}/api/chat` }

export function parseSseLine(line: string): { type: string; text?: string; sources?: unknown; session_id?: string; message?: string; cached?: boolean } | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice(5).trim()
  if (!payload || payload === '[DONE]') return { type: 'done' }
  try { return JSON.parse(payload) } catch {
    // Plain-text SSE chunk: treat as a token.
    return { type: 'token', text: payload }
  }
}
