import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('../services/api', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, listDocuments: vi.fn(), uploadDocuments: vi.fn(), deleteDocument: vi.fn(), getDocumentStatus: vi.fn() }
})
import { listDocuments, uploadDocuments, deleteDocument } from '../services/api'
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
})
