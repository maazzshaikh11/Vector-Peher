import type { DocumentItem, SearchResult } from '../types'

/**
 * Notebook-guide helpers (NotebookLM-style empty state).
 *
 * Honesty rules, per the brief:
 * - The auto-summary is EXTRACTIVE: every bullet is a verbatim excerpt of a
 *   chunk returned by the search API, attributed to its filename + page.
 *   Nothing is paraphrased, inferred, or invented.
 * - Suggested questions are derived from document titles only
 *   ("What does <title> cover?") — never from claims about the content.
 * - If search returns nothing (or fails), callers fall back to a
 *   metadata-only summary (filename, pages, status) — never a made-up one.
 */

export interface SummaryItem { excerpt: string; filename: string; page_number: number }

const MAX_ITEMS = 3
const MAX_EXCERPT = 220

/** First sentence-ish slice of a chunk, kept verbatim (no rewording). */
export function excerptOf(content: string, max = MAX_EXCERPT): string {
  const text = (content ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return (end > 60 ? cut.slice(0, end + 1) : cut).trimEnd() + '…'
}

/** Build the auto-summary items from retrieved chunks (top hits first). */
export function buildSummaryItems(results: SearchResult[], maxItems = MAX_ITEMS): SummaryItem[] {
  const items: SummaryItem[] = []
  const seen = new Set<string>()
  for (const r of results ?? []) {
    const excerpt = excerptOf(r.content)
    if (!excerpt || seen.has(r.chunk_id)) continue
    seen.add(r.chunk_id)
    items.push({ excerpt, filename: r.filename, page_number: r.page_number })
    if (items.length >= maxItems) break
  }
  return items
}

function shortTitle(filename: string): string {
  return (filename ?? '').replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || filename
}

/** Suggested questions derived from the documents' titles only. */
export function buildSuggestedQuestions(docs: DocumentItem[], max = 4): string[] {
  const ready = docs.filter((d) => d.status.toUpperCase() === 'READY')
  const questions: string[] = []
  for (const d of ready.slice(0, 2)) {
    const title = shortTitle(d.original_filename || d.filename)
    questions.push(`What does ${title} cover?`)
    if (questions.length < max) questions.push(`What are the key points in ${title}?`)
    if (questions.length >= max) break
  }
  if (ready.length > 1 && questions.length < max) {
    questions.push('Summarize the main findings across these sources.')
  } else if (ready.length === 1 && questions.length < max) {
    questions.push(`Summarize ${shortTitle(ready[0].original_filename || ready[0].filename)}.`)
  }
  return questions.slice(0, max)
}

export function useNotebookGuide() {
  return { buildSummaryItems, buildSuggestedQuestions, excerptOf }
}
