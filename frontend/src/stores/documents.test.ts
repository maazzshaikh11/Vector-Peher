import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('../services/api', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, listDocuments: vi.fn(), uploadDocuments: vi.fn(), deleteDocument: vi.fn(), getDocumentStatus: vi.fn(), renameDocument: vi.fn(), reprocessDocument: vi.fn() }
})
import { listDocuments, uploadDocuments, deleteDocument, renameDocument, reprocessDocument } from '../services/api'
import { useDocumentsStore } from './documents'
import { useToastStore } from './toast'

const doc = { id: 'd1', filename: 'a.pdf', original_filename: 'a.pdf', file_size: 100, page_count: 2, status: 'READY' }

describe('documents store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); useToastStore().toasts = [] })
  it('lists documents and filters by name', async () => {
    vi.mocked(listDocuments).mockResolvedValue([doc, { ...doc, id: 'd2', original_filename: 'other.pdf' }])
    const s = useDocumentsStore(); await s.fetchDocuments()
    expect(s.documents.length).toBe(2)
    s.filter = 'other'; expect(s.filteredDocuments.length).toBe(1)
  })
  it('rejects non-PDF upload client-side without calling API', async () => {
    const s = useDocumentsStore()
    const out = await s.upload([new File(['x'], 'a.txt', { type: 'text/plain' })])
    expect(out).toEqual([]); expect(uploadDocuments).not.toHaveBeenCalled()
    expect(useToastStore().toasts.some((t) => t.kind === 'error')).toBe(true)
  })
  it('uploads valid PDFs and selects them', async () => {
    vi.mocked(uploadDocuments).mockResolvedValue([{ ...doc, status: 'PROCESSING' }])
    const s = useDocumentsStore()
    const out = await s.upload([new File(['x'], 'a.pdf', { type: 'application/pdf' })])
    expect(out.length).toBe(1); expect(s.selectedIds.has('d1')).toBe(true)
  })
  it('deletes a document', async () => {
    vi.mocked(listDocuments).mockResolvedValue([doc]); vi.mocked(deleteDocument).mockResolvedValue(undefined)
    const s = useDocumentsStore(); await s.fetchDocuments(); await s.remove('d1')
    expect(s.documents.length).toBe(0); expect(deleteDocument).toHaveBeenCalledWith('d1')
  })
  it('toggle/selectAll/clearSelection work', () => {
    const s = useDocumentsStore(); s.documents = [doc, { ...doc, id: 'd2' }]
    s.toggleSelect('d1'); expect(s.selectedIds.has('d1')).toBe(true)
    s.selectAll(); expect(s.selectedIds.size).toBe(2)
    s.clearSelection(); expect(s.selectedIds.size).toBe(0)
    expect(s.selectedDocumentIds).toBeNull()
  })
  it('scopedSourceCount counts only checked READY documents', () => {
    const s = useDocumentsStore()
    s.documents = [doc, { ...doc, id: 'd2', original_filename: 'b.pdf', status: 'PROCESSING' }]
    // Nothing checked: no sources in scope.
    expect(s.scopedSourceCount).toBe(0)
    // Checking the PROCESSING doc does not add to the count.
    s.toggleSelect('d2'); expect(s.scopedSourceCount).toBe(0)
    // Checking the READY doc does.
    s.toggleSelect('d1'); expect(s.scopedSourceCount).toBe(1)
    s.clearSelection(); expect(s.scopedSourceCount).toBe(0)
  })
  it('fetchDocuments checks all loaded documents by default', async () => {
    vi.mocked(listDocuments).mockResolvedValue([doc, { ...doc, id: 'd2', original_filename: 'b.pdf' }])
    const s = useDocumentsStore(); await s.fetchDocuments()
    expect(s.selectedIds.has('d1')).toBe(true)
    expect(s.selectedIds.has('d2')).toBe(true)
    expect(s.scopedSourceCount).toBe(2)
  })
  it('selectDocument tracks the document shown in Details', () => {
    const s = useDocumentsStore(); s.documents = [doc, { ...doc, id: 'd2' }]
    expect(s.selectedDocument).toBeNull()
    s.selectDocument('d2'); expect(s.selectedDocument?.id).toBe('d2')
    s.selectDocument(null); expect(s.selectedDocument).toBeNull()
  })
  it('rename updates the document on success', async () => {
    vi.mocked(renameDocument).mockResolvedValue({ ...doc, original_filename: 'renamed.pdf' })
    const s = useDocumentsStore(); s.documents = [doc]
    expect(await s.rename('d1', 'renamed.pdf')).toBe(true)
    expect(s.documents[0].original_filename).toBe('renamed.pdf')
    expect(renameDocument).toHaveBeenCalledWith('d1', 'renamed.pdf')
  })
  it('rename surfaces a clear error when the backend has no endpoint', async () => {
    vi.mocked(renameDocument).mockRejectedValue(new Error('Request failed (404)'))
    const s = useDocumentsStore(); s.documents = [doc]
    expect(await s.rename('d1', 'renamed.pdf')).toBe(false)
    expect(s.documents[0].original_filename).toBe('a.pdf')
    expect(useToastStore().toasts.some((t) => t.kind === 'error' && t.message.includes('Rename failed'))).toBe(true)
  })
  it('retry reprocesses a FAILED document and restarts polling', async () => {
    vi.mocked(reprocessDocument).mockResolvedValue({ ...doc, status: 'PROCESSING' })
    const s = useDocumentsStore(); s.documents = [{ ...doc, status: 'FAILED' }]
    expect(await s.retry('d1')).toBe(true)
    expect(s.documents[0].status).toBe('PROCESSING')
    s.stopPolling()
  })
})
