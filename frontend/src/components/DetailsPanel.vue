<template>
  <aside class="details-panel" aria-label="Details and citations">
    <div class="details-head"><h2>Details</h2><button type="button" class="btn btn-sm" aria-label="Close details panel" @click="$emit('close')">✕</button></div>

    <!-- Active citation: passage + where it came from. -->
    <section v-if="chat.selectedSource" class="details-section" aria-label="Active citation">
      <h3>Citation</h3>
      <p><strong>{{ chat.selectedSource.filename }}</strong></p>
      <p class="muted">Page {{ chat.selectedSource.page_number }} · Chunk {{ chat.selectedSource.chunk_id }} · Score {{ chat.selectedSource.score.toFixed(3) }}</p>
      <p v-if="chat.selectedSource.content" class="excerpt">{{ chat.selectedSource.content }}</p>
      <p v-else class="muted">Open the document to page {{ chat.selectedSource.page_number }} to read this passage in full.</p>
    </section>

    <!-- Selected document metadata (row click in Sources, or the citation's document). -->
    <section v-if="shownDocument" class="details-section" aria-label="Selected document">
      <h3>Document</h3>
      <dl class="meta-list">
        <div><dt>File</dt><dd>{{ shownDocument.original_filename || shownDocument.filename }}</dd></div>
        <div><dt>Pages</dt><dd>{{ shownDocument.page_count }}</dd></div>
        <div v-if="shownDocument.chunk_count != null"><dt>Chunks</dt><dd>{{ shownDocument.chunk_count }}</dd></div>
        <div><dt>Size</dt><dd>{{ formatFileSize(shownDocument.file_size) }}</dd></div>
        <div><dt>Status</dt><dd><ProcessingStatus :status="shownDocument.status" /></dd></div>
      </dl>
    </section>

    <p v-if="!chat.selectedSource && !shownDocument" class="muted details-empty">Select a source on the left, or click a citation chip in chat, to see its details here.</p>

    <section class="details-section" aria-label="Chat history">
      <SessionHistory />
    </section>
  </aside>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../stores/chat'
import { useDocumentsStore } from '../stores/documents'
import { formatFileSize } from '../types'
import ProcessingStatus from './ProcessingStatus.vue'
import SessionHistory from './SessionHistory.vue'
defineEmits<{ (e: 'close'): void }>()
const chat = useChatStore()
const docs = useDocumentsStore()
/** Metadata for the selected document, else the citation's document (matched by id, then filename). */
const shownDocument = computed(() => {
  if (docs.selectedDocument) return docs.selectedDocument
  const src = chat.selectedSource
  if (!src) return null
  return docs.documents.find((d) => (src.document_id && d.id === src.document_id) || (d.original_filename || d.filename) === src.filename) ?? null
})
</script>
<style scoped>
.details-panel { width: 320px; flex-shrink: 0; background: var(--surface); border-left: 1px solid var(--border); padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.details-head { display: flex; justify-content: space-between; align-items: center; }
.details-head h2 { margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); }
.details-section h3 { margin: 0 0 8px; font-size: 14px; }
.details-section p { margin: 4px 0; }
.excerpt { background: var(--surface-2); border-radius: 8px; padding: 10px; white-space: pre-wrap; }
.meta-list { margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
.meta-list div { display: flex; gap: 8px; }
.meta-list dt { color: var(--text-secondary); min-width: 52px; }
.meta-list dd { margin: 0; overflow-wrap: anywhere; }
.details-empty { font-size: 13px; margin: 0; }
</style>
