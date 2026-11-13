import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { deleteDocument, getDocumentStatus, listDocuments, renameDocument, reprocessDocument, uploadDocuments } from '../services/api'
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
  /** Document whose metadata is shown in the Details panel (row click). */
  const selectedDocumentId = ref<string | null>(null)
  const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)
  const toast = useToastStore()

  const filteredDocuments = computed(() => {
    const q = filter.value.trim().toLowerCase()
    if (!q) return documents.value
    return documents.value.filter((d) => (d.original_filename || d.filename).toLowerCase().includes(q))
  })
  const readyDocuments = computed(() => documents.value.filter((d) => d.status.toUpperCase() === 'READY'))
  /** READY documents actually in scope for the next query: the checked ones.
   *  When nothing is checked the scope is empty — the composer disables
   *  and the chat store refuses to send (there is nothing to draw from).
   *  Uploads and fetches check every document by default, so the common
   *  case still has all READY documents in scope. */
  const checkedReadyDocuments = computed(() => readyDocuments.value.filter((d) => selectedIds.value.has(d.id)))
  /** Live "N sources" count shown in the composer — only checked READY
   *  documents count (a checked document still processing does not). */
  const scopedSourceCount = computed(() => checkedReadyDocuments.value.length)
  const selectedDocument = computed(() => documents.value.find((d) => d.id === selectedDocumentId.value) ?? null)
  const selectedDocumentIds = computed(() => (selectedIds.value.size ? [...selectedIds.value] : null))
  const hasProcessing = computed(() => documents.value.some((d) => isProcessing(d.status)))

  async function fetchDocuments() {
    loading.value = true; error.value = null
    try { documents.value = await listDocuments(); documents.value.forEach((d) => selectedIds.value.add(d.id)); startPollingIfNeeded() }
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
    try { await deleteDocument(id); documents.value = documents.value.filter((d) => d.id !== id); selectedIds.value.delete(id); if (selectedDocumentId.value === id) selectedDocumentId.value = null; toast.push('Document deleted.', 'success') }
    catch (e) { toast.push(`Delete failed: ${(e as Error).message}`, 'error') }
  }

  /** Rename a document's display name. Surfaces a clear error if the
   *  backend has no rename endpoint yet — the name is never changed
   *  client-side only, so a reload cannot silently revert it. */
  async function rename(id: string, filename: string) {
    const clean = filename.trim(); if (!clean) return false
    try {
      const updated = await renameDocument(id, clean)
      documents.value = documents.value.map((d) => (d.id === id ? updated : d))
      toast.push('Document renamed.', 'success'); return true
    } catch (e) { toast.push(`Rename failed: ${(e as Error).message}`, 'error'); return false }
  }

  /** Ask the backend to reprocess a FAILED document. Surfaces a clear
   *  error if the backend has no reprocess endpoint yet. */
  async function retry(id: string) {
    try {
      const updated = await reprocessDocument(id)
      documents.value = documents.value.map((d) => (d.id === id ? updated : d))
      toast.push('Reprocessing started.', 'success'); startPollingIfNeeded(); return true
    } catch (e) { toast.push(`Retry failed: ${(e as Error).message}`, 'error'); return false }
  }

  function selectDocument(id: string | null) { selectedDocumentId.value = id }

  function toggleSelect(id: string) { selectedIds.value.has(id) ? selectedIds.value.delete(id) : selectedIds.value.add(id) }
  function selectAll() { documents.value.forEach((d) => selectedIds.value.add(d.id)) }
  function clearSelection() { selectedIds.value.clear() }

  return { documents, loading, error, uploading, uploadProgress, selectedIds, filter, filteredDocuments, readyDocuments, checkedReadyDocuments, scopedSourceCount, selectedDocumentId, selectedDocument, selectedDocumentIds, hasProcessing, fetchDocuments, upload, remove, rename, retry, selectDocument, toggleSelect, selectAll, clearSelection, startPollingIfNeeded, stopPolling }
})
