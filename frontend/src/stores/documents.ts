import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { deleteDocument, getDocumentStatus, listDocuments, uploadDocuments } from '../services/api'
import type { DocumentItem } from '../types'
import { validatePdfFile } from '../types'
import { useToastStore } from './toast'

const POLL_MS = 2000
function isProcessing(s: string) { return ['PROCESSING', 'INDEXING', 'UPLOADED'].includes(s.toUpperCase()) }

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref<DocumentItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const uploading = ref(false)
  const uploadProgress = ref(0)
  const selectedIds = ref<Set<string>>(new Set())
  const filter = ref('')
  const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
  const toast = useToastStore()

  const filteredDocuments = computed(() => {
    const q = filter.value.trim().toLowerCase()
    if (!q) return documents.value
    return documents.value.filter((d) => (d.original_filename || d.filename).toLowerCase().includes(q))
  })
  const readyDocuments = computed(() => documents.value.filter((d) => d.status.toUpperCase() === 'READY'))
  const selectedDocumentIds = computed(() => (selectedIds.value.size ? [...selectedIds.value] : null))
  const hasProcessing = computed(() => documents.value.some((d) => isProcessing(d.status)))

  async function fetchDocuments() {
    loading.value = true; error.value = null
    try { documents.value = await listDocuments(); startPollingIfNeeded() }
    catch (e) { error.value = (e as Error).message; toast.push(`Could not load documents: ${error.value}`, 'error') }
    finally { loading.value = false }
  }

  function startPollingIfNeeded() {
    if (pollTimer.value) return
    if (!hasProcessing.value) return
    pollTimer.value = setInterval(async () => {
      const pending = documents.value.filter((d) => isProcessing(d.status))
      if (!pending.length) { stopPolling(); return }
      for (const doc of pending) {
        try { const s = await getDocumentStatus(doc.id); const item = documents.value.find((d) => d.id === doc.id); if (item) item.status = s.status } catch { /* keep polling */ }
      }
      if (!hasProcessing.value) stopPolling()
    }, POLL_MS)
  }
  function stopPolling() { if (pollTimer.value) { clearInterval(pollTimer.value); pollTimer.value = null } }

  async function upload(files: File[]): Promise<DocumentItem[]> {
    const errors = files.map((f) => validatePdfFile(f)).filter(Boolean) as string[]
    if (errors.length) { errors.forEach((m) => toast.push(m, 'error')); return [] }
    uploading.value = true; uploadProgress.value = 0; error.value = null
    try {
      const docs = await uploadDocuments(files, (_l, t) => { uploadProgress.value = t ? 50 : 0 })
      uploadProgress.value = 100
      documents.value = [...docs, ...documents.value]
      docs.forEach((d) => selectedIds.value.add(d.id))
      toast.push(`${docs.length} document${docs.length === 1 ? '' : 's'} uploaded — processing started.`, 'success')
      startPollingIfNeeded()
      return docs
    } catch (e) { error.value = (e as Error).message; toast.push(`Upload failed: ${error.value}`, 'error'); return [] }
    finally { uploading.value = false; setTimeout(() => { uploadProgress.value = 0 }, 800) }
  }

  async function remove(id: string) {
    try { await deleteDocument(id); documents.value = documents.value.filter((d) => d.id !== id); selectedIds.value.delete(id); toast.push('Document deleted.', 'success') }
    catch (e) { toast.push(`Delete failed: ${(e as Error).message}`, 'error') }
  }

  function toggleSelect(id: string) { selectedIds.value.has(id) ? selectedIds.value.delete(id) : selectedIds.value.add(id) }
  function selectAll() { documents.value.forEach((d) => selectedIds.value.add(d.id)) }
  function clearSelection() { selectedIds.value.clear() }

  return { documents, loading, error, uploading, uploadProgress, selectedIds, filter, filteredDocuments, readyDocuments, selectedDocumentIds, hasProcessing, fetchDocuments, upload, remove, toggleSelect, selectAll, clearSelection, startPollingIfNeeded, stopPolling }
})
