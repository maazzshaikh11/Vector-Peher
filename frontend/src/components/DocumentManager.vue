<template>
  <section class="doc-manager" aria-label="Sources">
    <div class="sources-head">
      <h2>Sources</h2>
      <span class="muted source-total">{{ docs.documents.length }} document{{ docs.documents.length === 1 ? '' : 's' }} · {{ docs.readyDocuments.length }} ready</span>
    </div>
    <button type="button" class="btn btn-primary add-source" @click="showDropzone = !showDropzone" :aria-expanded="showDropzone">＋ Add source</button>
    <UploadDropzone v-if="showDropzone || !docs.documents.length" :uploading="docs.uploading" :progress="docs.uploadProgress" @files="docs.upload($event)" />
    <div class="filter-row">
      <input v-model="docs.filter" class="input" type="search" placeholder="Filter documents…" aria-label="Filter documents" />
      <button type="button" class="btn btn-sm" @click="docs.selectAll()">Select all</button>
      <button type="button" class="btn btn-sm" @click="docs.clearSelection()">Clear</button>
    </div>
    <p class="muted selection-note">{{ selectionNote }}</p>
    <LoadingIndicator v-if="docs.loading" label="Loading documents…" />
    <EmptyState v-else-if="!docs.filteredDocuments.length" title="No documents yet" message="Upload PDFs to start asking questions about them." icon="📚" />
    <div v-else class="doc-list">
      <DocumentCard v-for="d in docs.filteredDocuments" :key="d.id" :doc="d" :selected="docs.selectedIds.has(d.id)" :is-selected-doc="docs.selectedDocumentId === d.id" @toggle-select="docs.toggleSelect($event)" @select-doc="docs.selectDocument($event)" @request-delete="pendingDelete = $event" @request-retry="docs.retry($event.id)" @request-rename="docs.rename($event.id, $event.filename)" />
    </div>
    <ConfirmDialog :open="!!pendingDelete" title="Delete document?" :message="pendingDelete ? `Delete “${pendingDelete.original_filename || pendingDelete.filename}”? This removes it from search and chat.` : ''" confirm-label="Delete" @confirm="confirmDelete" @cancel="pendingDelete = null" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDocumentsStore } from '../stores/documents'
import type { DocumentItem } from '../types'
import DocumentCard from './DocumentCard.vue'
import UploadDropzone from './UploadDropzone.vue'
import EmptyState from './EmptyState.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import ConfirmDialog from './ConfirmDialog.vue'
const docs = useDocumentsStore()
const pendingDelete = ref<DocumentItem | null>(null)
const showDropzone = ref(false)
async function confirmDelete() { if (pendingDelete.value) await docs.remove(pendingDelete.value.id); pendingDelete.value = null }
const selectionNote = computed(() => {
  const checked = docs.selectedIds.size
  if (!docs.documents.length) return 'No documents yet.'
  if (!checked) return 'No sources checked — select at least one source to ask a question.'
  return `${docs.scopedSourceCount} of ${docs.readyDocuments.length} ready source${docs.readyDocuments.length === 1 ? '' : 's'} checked — chat searches only these.`
})
</script>
<style scoped>
.doc-manager { display: flex; flex-direction: column; gap: 10px; }
.sources-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.sources-head h2 { margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); }
.source-total { font-size: 12px; }
.add-source { width: 100%; }
.filter-row { display: flex; gap: 8px; }
.filter-row .input { flex: 1; min-width: 0; }
.selection-note { font-size: 12px; margin: 0; }
.doc-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
</style>
