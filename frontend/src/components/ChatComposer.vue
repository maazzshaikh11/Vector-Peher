<template>
  <form class="composer" @submit.prevent="submit">
    <textarea v-model="draft" rows="1" aria-label="Ask a question about your documents" placeholder="Start typing…" :disabled="disabled" @keydown.enter.exact.prevent="submit" />
    <button v-if="streaming" type="button" class="btn btn-danger" @click="$emit('stop')">Stop</button>
    <button v-else type="submit" class="btn btn-primary" :disabled="disabled || !draft.trim()">Send</button>
  </form>
  <div class="composer-foot">
    <p v-if="hint" class="hint muted">{{ hint }}</p>
    <span class="source-count muted" :title="sourceCountTitle">{{ sourceCount }} source{{ sourceCount === 1 ? '' : 's' }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
const props = withDefaults(defineProps<{ disabled?: boolean; streaming?: boolean; hint?: string; sourceCount?: number }>(), { disabled: false, streaming: false, hint: '', sourceCount: 0 })
const emit = defineEmits<{ (e: 'send', text: string): void; (e: 'stop'): void }>()
const draft = ref('')
const hint = computed(() => props.hint)
const sourceCountTitle = computed(() => props.sourceCount === 0 ? 'No sources selected — select at least one source to ask a question' : `${props.sourceCount} checked source${props.sourceCount === 1 ? '' : 's'} will be searched`)
function submit() { const text = draft.value.trim(); if (!text || props.disabled) return; emit('send', text); draft.value = '' }
</script>
<style scoped>
.composer { display: flex; gap: 8px; align-items: flex-end; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px; }
.composer textarea { flex: 1; border: none; background: transparent; resize: none; outline: none; max-height: 160px; padding: 8px; }
.composer-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.hint { font-size: 12px; margin: 6px 4px 0; }
.source-count { font-size: 12px; margin: 6px 4px 0; white-space: nowrap; }
</style>
