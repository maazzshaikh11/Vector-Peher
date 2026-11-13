import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseSseLine, listDocuments, uploadDocuments } from './api'
import { validatePdfFile, formatFileSize } from '../types'

describe('parseSseLine', () => {
  it('parses token JSON', () => { expect(parseSseLine('data: {"type":"token","text":"hello"}')).toEqual({ type: 'token', text: 'hello' }) })
  it('parses sources JSON', () => { const e = parseSseLine('data: {"type":"sources","sources":[]}'); expect(e?.type).toBe('sources') })
  it('parses cached JSON', () => { const e = parseSseLine('data: {"type":"cached","cached":true}'); expect(e?.type).toBe('cached'); expect(e?.cached).toBe(true) })
  it('treats plain text as token', () => { expect(parseSseLine('data: hello world')).toEqual({ type: 'token', text: 'hello world' }) })
  it('treats [DONE] as done', () => { expect(parseSseLine('data: [DONE]')?.type).toBe('done') })
  it('ignores non-data lines', () => { expect(parseSseLine(': keep-alive')).toBeNull() })
  it('ignores empty lines', () => { expect(parseSseLine('')).toBeNull() })
})

describe('validatePdfFile', () => {
  it('accepts a PDF', () => { expect(validatePdfFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull() })
  it('rejects non-PDF', () => { expect(validatePdfFile(new File(['x'], 'a.txt', { type: 'text/plain' }))).toMatch(/only PDF/) })
  it('rejects oversize PDF', () => { const f = new File(['x'], 'big.pdf', { type: 'application/pdf' }); Object.defineProperty(f, 'size', { value: 60 * 1024 * 1024 }); expect(validatePdfFile(f)).toMatch(/50 MB/) })
  it('rejects empty PDF', () => { expect(validatePdfFile(new File([], 'e.pdf', { type: 'application/pdf' }))).toMatch(/empty/) })
})

describe('formatFileSize', () => {
  it('formats bytes/KB/MB', () => { expect(formatFileSize(500)).toBe('500 B'); expect(formatFileSize(2048)).toBe('2.0 KB'); expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB') })
})

describe('api list/upload shapes', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it('listDocuments handles bare array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: '1', filename: 'a.pdf', original_filename: 'a.pdf', file_size: 10, page_count: 1, status: 'READY' }] }))
    expect((await listDocuments()).length).toBe(1)
  })
  it('listDocuments handles {documents:[...]}', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [{ id: '2', filename: 'b.pdf', original_filename: 'b.pdf', file_size: 10, page_count: 2, status: 'READY' }] }) }))
    expect((await listDocuments())[0].id).toBe('2')
  })
  it('uploadDocuments handles {documents:[...]}', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [{ id: '3', filename: 'c.pdf', original_filename: 'c.pdf', file_size: 10, page_count: 1, status: 'PROCESSING' }] }) }))
    const docs = await uploadDocuments([new File(['x'], 'c.pdf', { type: 'application/pdf' })])
    expect(docs[0].status).toBe('PROCESSING')
  })
  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ detail: 'boom' }) }))
    await expect(listDocuments()).rejects.toThrow('boom')
  })
})
