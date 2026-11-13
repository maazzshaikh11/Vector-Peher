import { describe, it, expect } from 'vitest'
import { buildSuggestedQuestions, buildSummaryItems, excerptOf } from './useNotebookGuide'

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'd1', filename: 'quokka-propulsion.pdf', original_filename: 'quokka-propulsion.pdf',
  file_size: 100, page_count: 4, status: 'READY', ...over,
})

describe('buildSummaryItems (extractive — no invented content)', () => {
  it('quotes chunk text verbatim with filename + page attribution', () => {
    const items = buildSummaryItems([
      { content: 'Quokkas achieve a thrust-to-weight ratio of 4.2 in field trials.', filename: 'quokka-propulsion.pdf', page_number: 2, score: 0.9, chunk_id: 'c1', document_id: 'd1' },
    ])
    expect(items.length).toBe(1)
    expect(items[0].excerpt).toContain('thrust-to-weight ratio of 4.2')
    expect(items[0].filename).toBe('quokka-propulsion.pdf')
    expect(items[0].page_number).toBe(2)
  })
  it('returns nothing for empty results (caller falls back to metadata)', () => {
    expect(buildSummaryItems([])).toEqual([])
    expect(buildSummaryItems([{ content: '   ', filename: 'a.pdf', page_number: 1, score: 0.5, chunk_id: 'c9', document_id: 'd1' }])).toEqual([])
  })
  it('dedupes by chunk and caps at three items', () => {
    const mk = (i: number) => ({ content: `fact number ${i}`, filename: 'a.pdf', page_number: 1, score: 0.9, chunk_id: `c${i}`, document_id: 'd1' })
    const items = buildSummaryItems([mk(1), mk(1), mk(2), mk(3), mk(4)])
    expect(items.length).toBe(3)
    expect(items.map((x) => x.excerpt)).toEqual(['fact number 1', 'fact number 2', 'fact number 3'])
  })
})

describe('excerptOf', () => {
  it('keeps short text whole and truncates long text without inventing words', () => {
    expect(excerptOf('short fact.')).toBe('short fact.')
    const long = 'First sentence is complete. ' + 'word '.repeat(100)
    const out = excerptOf(long)
    expect(out.startsWith('First sentence is complete.')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThan(long.length)
  })
})

describe('buildSuggestedQuestions (derived from titles only)', () => {
  it('derives questions from document titles, never from content claims', () => {
    const qs = buildSuggestedQuestions([doc(), doc({ id: 'd2', original_filename: 'field-trials.pdf', filename: 'field-trials.pdf' })])
    expect(qs.length).toBeGreaterThan(0)
    expect(qs[0]).toContain('quokka propulsion')
    expect(qs.some((q) => q.includes('field trials'))).toBe(true)
    // No question asserts anything about the content.
    expect(qs.every((q) => q.endsWith('?') || q.endsWith('.'))).toBe(true)
  })
  it('ignores non-READY documents', () => {
    expect(buildSuggestedQuestions([doc({ status: 'PROCESSING' })])).toEqual([])
  })
  it('caps at four questions', () => {
    const docs = [1, 2, 3].map((i) => doc({ id: `d${i}`, original_filename: `doc-${i}.pdf`, filename: `doc-${i}.pdf` }))
    expect(buildSuggestedQuestions(docs).length).toBeLessThanOrEqual(4)
  })
})
