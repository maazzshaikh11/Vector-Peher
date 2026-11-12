<template>
  <button type="button" class="citation" :title="`${source.filename} — page ${source.page_number} (score ${source.score.toFixed(2)})`" @click="$emit('open', source)">
    {{ source.filename }} · p. {{ source.page_number }}
  </button>
</template>
<script setup lang="ts">
import type { Source } from '../types'
defineProps<{ source: Source }>()
defineEmits<{ (e: 'open', source: Source): void }>()
</script>
<style scoped>
.citation { border: 1px solid var(--border); background: var(--accent-soft); color: var(--accent); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
.citation:hover { border-color: var(--accent); }
</style>
