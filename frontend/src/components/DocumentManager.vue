<template>
  <section class="doc-manager" aria-label="Document library">
    <UploadDropzone :uploading="docs.uploading" :progress="docs.uploadProgress" @files="docs.upload($event)" />
    <div class="filter-row">
      <input v-model="docs.filter" class="input" type="search" placeholder="Filter documents…" aria-label="Filter documents" />
      <button type="button" class="btn btn-sm" @click="docs.selectAll()">Select all</button>
      <button type="button" class="btn btn-sm" @click="docs.clearSelection()">Clear</button>
    </div>
    <p class="muted selection-note">{{ docs.selectedIds.size ? `${docs.selectedIds.size} selected — chat searches only these.` : 'No documents selected — chat searches all documents.' }}</p>
    <LoadingIndicator v-if="docs.loading" label="Loading documents…" />
    <EmptyState v-else-if="!docs.filteredDocuments.length" title="No documents yet" message="Upload PDFs to start asking questions about them." icon="📚" />
    <div v-else class="doc-list">
      <DocumentCard v-for="d in docs.filteredDocuments" :key="d.id" :doc="d" :selected="docs.selectedIds.has(d.id)" @toggle-select="docs.toggleSelect($event)" @request-delete="pendingDelete = $event" />
    </div>
    <ConfirmDialog :open="!!pendingDelete" title="Delete document?" :message="pendingDelete ? `Delete “${pendingDelete.original_filename || pendingDelete.filename}”? This removes it from search and chat.` : ''" confirm-label="Delete" @confirm="confirmDelete" @cancel="pendingDelete = null" />
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useDocumentsStore } from '../stores/documents'
import type { DocumentItem } from '../types'
import DocumentCard from './DocumentCard.vue'
import UploadDropzone from './UploadDropzone.vue'
import EmptyState from './EmptyState.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import ConfirmDialog from './ConfirmDialog.vue'
const docs = useDocumentsStore()
const pendingDelete = ref<DocumentItem | null>(null)
async function confirmDelete() { if (pendingDelete.value) await docs.remove(pendingDelete.value.id); pendingDelete.value = null }
</script>
<style scoped>
.doc-manager { display: flex; flex-direction: column; gap: 12px; }
.filter-row { display: flex; gap: 8px; }
.filter-row .input { flex: 1; min-width: 0; }
.selection-note { font-size: 12px; margin: 0; }
.doc-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
</style>
