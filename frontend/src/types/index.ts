export type DocumentStatus = 'PROCESSING' | 'INDEXING' | 'READY' | 'FAILED' | 'UPLOADED' | string
export interface DocumentItem {
  id: string; filename: string; original_filename: string; file_size: number; page_count: number;
  status: DocumentStatus; created_at?: string; chunk_count?: number;
}
export interface Source { filename: string; page_number: number; chunk_id: string; score: number; document_id?: string; content?: string }
export interface ChatMessageItem { id: string; role: 'user' | 'assistant'; content: string; sources?: Source[]; created_at?: string; /** True when the answer was served from the backend response cache. */ cached?: boolean }
export interface ChatSession { id: string; title: string; created_at?: string; updated_at?: string; messages?: ChatMessageItem[] }
export interface SearchResult { content: string; filename: string; page_number: number; score: number; chunk_id: string; document_id: string }
export interface StreamEvent { type: 'token' | 'sources' | 'done' | 'error' | 'cached'; text?: string; sources?: Source[]; session_id?: string; message?: string; cached?: boolean }
export interface HealthResponse { status: string; [key: string]: unknown }
export function formatFileSize(bytes: number): string {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
export function validatePdfFile(file: File, maxBytes = 50 * 1024 * 1024): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return `${file.name}: only PDF files are accepted.`
  if (file.size > maxBytes) return `${file.name}: exceeds the 50 MB limit (${formatFileSize(file.size)}).`
  if (file.size === 0) return `${file.name}: file is empty.`
  return null
}
