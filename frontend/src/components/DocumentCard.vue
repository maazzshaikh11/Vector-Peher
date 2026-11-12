<template>
  <article class="doc-card card" :class="{ selected }">
    <label class="select"><input type="checkbox" :checked="selected" :aria-label="`Select ${displayName} for chat`" @change="$emit('toggle-select', doc.id)" /> <span class="sr">Select</span></label>
    <div class="doc-info">
      <strong class="doc-name" :title="displayName">{{ displayName }}</strong>
      <span class="muted doc-meta">{{ formatFileSize(doc.file_size) }} · {{ doc.page_count }} pages</span>
      <ProcessingStatus :status="doc.status" />
    </div>
    <button type="button" class="btn btn-sm btn-danger" :aria-label="`Delete ${displayName}`" @click="$emit('request-delete', doc)">Delete</button>
  </article>
</template>
<script setup lang="ts">
import type { DocumentItem } from '../types'
import { formatFileSize } from '../types'
import ProcessingStatus from './ProcessingStatus.vue'
import { computed } from 'vue'
const props = defineProps<{ doc: DocumentItem; selected: boolean }>()
defineEmits<{ (e: 'toggle-select', id: string): void; (e: 'request-delete', doc: DocumentItem): void }>()
const displayName = computed(() => props.doc.original_filename || props.doc.filename)
</script>
<style scoped>
.doc-card { display: flex; gap: 10px; align-items: flex-start; padding: 10px; }
.doc-card.selected { border-color: var(--accent); }
.doc-info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.doc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-meta { font-size: 12px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
