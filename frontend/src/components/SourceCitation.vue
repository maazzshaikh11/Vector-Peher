<template>
  <span class="citation-wrap">
    <button type="button" class="citation" :title="`${source.filename} — page ${source.page_number} (score ${source.score.toFixed(2)})`" @click="$emit('open', source)">
      <span v-if="index != null" class="citation-num" :aria-label="`Citation ${index}`">[{{ index }}]</span>
      <span class="citation-label">{{ source.filename }} · p. {{ source.page_number }}</span>
    </button>
    <span v-if="index != null" class="citation-preview" role="tooltip">
      <strong>{{ source.filename }} · p. {{ source.page_number }}</strong>
      <span v-if="source.content" class="preview-text">{{ previewText }}</span>
      <span v-else class="muted">Open the document to page {{ source.page_number }} to read this passage in full.</span>
    </span>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { Source } from '../types'
const props = defineProps<{ source: Source; index?: number }>()
defineEmits<{ (e: 'open', source: Source): void }>()
const previewText = computed(() => {
  const text = (props.source.content ?? '').replace(/\s+/g, ' ').trim()
  return text.length > 280 ? text.slice(0, 280).trimEnd() + '…' : text
})
</script>
<style scoped>
.citation-wrap { position: relative; display: inline-flex; }
.citation { border: 1px solid var(--border); background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 3px 10px; font-size: 12px; display: inline-flex; gap: 5px; align-items: baseline; max-width: 280px; }
.citation:hover { border-color: var(--accent); }
.citation-num { font-weight: 700; }
.citation-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Hover preview of the cited passage (NotebookLM-style). */
.citation-preview { display: none; position: absolute; left: 0; bottom: calc(100% + 6px); z-index: 30; width: 320px; max-width: 80vw; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); padding: 10px 12px; font-size: 13px; line-height: 1.5; }
.citation-preview strong { display: block; margin-bottom: 4px; font-size: 12px; color: var(--text-secondary); }
.preview-text { display: block; white-space: normal; }
.citation-wrap:hover .citation-preview, .citation-wrap:focus-within .citation-preview { display: block; }
</style>
