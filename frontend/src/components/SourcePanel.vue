<template>
  <aside v-if="source" class="source-panel card" aria-label="Source detail">
    <div class="source-head"><h3>Source</h3><button type="button" class="btn btn-sm" aria-label="Close source panel" @click="$emit('close')">✕</button></div>
    <p><strong>{{ source.filename }}</strong></p>
    <p class="muted">Page {{ source.page_number }} · Chunk {{ source.chunk_id }} · Score {{ source.score.toFixed(3) }}</p>
    <p v-if="source.content" class="excerpt">{{ source.content }}</p>
    <p v-else class="muted">Open the document to page {{ source.page_number }} to read this passage in full.</p>
  </aside>
</template>
<script setup lang="ts">
import type { Source } from '../types'
defineProps<{ source: Source | null }>()
defineEmits<{ (e: 'close'): void }>()
</script>
<style scoped>
.source-panel { padding: 16px; width: 320px; flex-shrink: 0; border-left: 1px solid var(--border); overflow-y: auto; }
.source-head { display: flex; justify-content: space-between; align-items: center; }
.source-head h3 { margin: 0; }
.excerpt { background: var(--surface-2); border-radius: 8px; padding: 10px; white-space: pre-wrap; }
</style>
