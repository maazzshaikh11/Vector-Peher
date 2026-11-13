<template>
  <article class="doc-card" :class="{ selected, 'doc-selected': isSelectedDoc }" :aria-label="displayName">
    <label class="select"><input type="checkbox" :checked="selected" :aria-label="`Select ${displayName} for chat`" @change="$emit('toggle-select', doc.id)" @click.stop /> <span class="sr">Select</span></label>
    <div class="doc-info" role="button" tabindex="0" :title="displayName" @click="$emit('select-doc', doc.id)" @keydown.enter="$emit('select-doc', doc.id)">
      <strong v-if="!renaming" class="doc-name" :title="displayName">{{ displayName }}</strong>
      <input v-else v-model="renameTitle" class="input rename-input" aria-label="Rename document" @click.stop @keydown.enter="confirmRename" @keydown.escape="renaming = false" @blur="confirmRename" />
      <span class="muted doc-meta">{{ formatFileSize(doc.file_size) }} · {{ doc.page_count }} pages</span>
      <span class="status-row"><ProcessingStatus :status="doc.status" />
        <button v-if="isFailed" type="button" class="btn btn-sm retry-btn" :aria-label="`Retry processing ${displayName}`" title="Retry processing" @click.stop="$emit('request-retry', doc)">Retry</button>
      </span>
      <span v-if="isFailed" class="failed-note">Processing failed — retry, or delete and upload again.</span>
    </div>
    <span class="row-actions">
      <button type="button" class="btn btn-sm row-action" :aria-label="`Rename ${displayName}`" title="Rename" @click.stop="startRename">✏️</button>
      <button type="button" class="btn btn-sm btn-danger row-action" :aria-label="`Delete ${displayName}`" title="Delete" @click.stop="$emit('request-delete', doc)">🗑️</button>
    </span>
  </article>
</template>
<script setup lang="ts">
import type { DocumentItem } from '../types'
import { formatFileSize } from '../types'
import ProcessingStatus from './ProcessingStatus.vue'
import { computed, ref } from 'vue'
const props = defineProps<{ doc: DocumentItem; selected: boolean; isSelectedDoc?: boolean }>()
const emit = defineEmits<{ (e: 'toggle-select', id: string): void; (e: 'request-delete', doc: DocumentItem): void; (e: 'request-retry', doc: DocumentItem): void; (e: 'request-rename', payload: { id: string; filename: string }): void; (e: 'select-doc', id: string): void }>()
const displayName = computed(() => props.doc.original_filename || props.doc.filename)
const isFailed = computed(() => props.doc.status.toUpperCase() === 'FAILED')
const renaming = ref(false)
const renameTitle = ref('')
function startRename() { renameTitle.value = displayName.value; renaming.value = true }
function confirmRename() {
  if (!renaming.value) return
  renaming.value = false
  const clean = renameTitle.value.trim()
  if (clean && clean !== displayName.value) emit('request-rename', { id: props.doc.id, filename: clean })
}
</script>
<style scoped>
/* Flat NotebookLM-style source row (not a card): checkbox, truncated title,
   status; rename/remove appear on hover (and on focus, for keyboard users). */
.doc-card { display: flex; gap: 10px; align-items: flex-start; padding: 8px 6px; border-radius: 8px; border: 1px solid transparent; }
.doc-card:hover, .doc-card:focus-within { background: var(--surface-2); }
.doc-card.selected { background: var(--accent-soft); }
.doc-card.doc-selected { border-color: var(--accent); }
.doc-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; cursor: pointer; }
.doc-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 20ch; font-weight: 600; }
.doc-meta { font-size: 12px; }
.status-row { display: flex; align-items: center; gap: 6px; }
.failed-note { font-size: 12px; color: var(--error); }
.rename-input { padding: 4px 6px; font-size: 14px; }
.row-actions { display: flex; gap: 4px; opacity: 0; transition: opacity .12s; }
.doc-card:hover .row-actions, .doc-card:focus-within .row-actions { opacity: 1; }
.row-action { padding: 4px 8px; background: transparent; }
.retry-btn { padding: 2px 8px; font-size: 12px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
