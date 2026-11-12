<template>
  <form class="composer" @submit.prevent="submit">
    <button type="button" class="btn attach" aria-label="Attach PDF documents" title="Attach PDFs" @click="fileInput?.click()">📎</button>
    <input ref="fileInput" type="file" accept="application/pdf,.pdf" multiple hidden @change="onFiles" />
    <textarea v-model="draft" rows="1" aria-label="Ask a question about your documents" placeholder="Ask a question about your documents…" :disabled="disabled" @keydown.enter.exact.prevent="submit" />
    <button v-if="streaming" type="button" class="btn btn-danger" @click="$emit('stop')">Stop</button>
    <button v-else type="submit" class="btn btn-primary" :disabled="disabled || !draft.trim()">Send</button>
  </form>
  <p v-if="hint" class="hint muted">{{ hint }}</p>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
const props = withDefaults(defineProps<{ disabled?: boolean; streaming?: boolean; hint?: string }>(), { disabled: false, streaming: false, hint: '' })
const emit = defineEmits<{ (e: 'send', text: string): void; (e: 'attach', files: File[]): void; (e: 'stop'): void }>()
const draft = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const hint = computed(() => props.hint)
function submit() { const text = draft.value.trim(); if (!text || props.disabled) return; emit('send', text); draft.value = '' }
function onFiles(e: Event) { const files = [...((e.target as HTMLInputElement).files ?? [])]; if (files.length) emit('attach', files); (e.target as HTMLInputElement).value = '' }
</script>
<style scoped>
.composer { display: flex; gap: 8px; align-items: flex-end; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 8px; }
.composer textarea { flex: 1; border: none; background: transparent; resize: none; outline: none; max-height: 160px; padding: 8px; }
.attach { background: transparent; }
.hint { font-size: 12px; margin: 6px 4px 0; }
</style>
