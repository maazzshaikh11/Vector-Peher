<template>
  <article :class="['message', `message-${message.role}`]">
    <div class="avatar" aria-hidden="true">{{ message.role === 'user' ? '🧑' : '🧠' }}</div>
    <div class="body">
      <div class="meta"><strong>{{ message.role === 'user' ? 'You' : 'Vector Brain' }}</strong> <span v-if="message.created_at" class="muted">{{ formatTime(message.created_at) }}</span> <span v-if="message.role === 'assistant' && message.cached" class="badge cache-badge" title="This answer was served from the response cache">From cache</span></div>
      <!-- Assistant messages render as sanitized Markdown (headings, lists,
           tables, code). The same path serves live-streamed and reloaded
           (stored) messages: the whole accumulated string is re-rendered
           on every update, so partial Markdown mid-stream is harmless. -->
      <div v-if="message.role === 'assistant'" class="content markdown-body" v-html="renderedMarkdown"></div>
      <p v-else class="content">{{ message.content }}</p>
      <div v-if="message.role === 'assistant' && message.sources?.length" class="sources">
        <span class="muted sources-label">Sources:</span>
        <SourceCitation v-for="(s, i) in message.sources" :key="s.chunk_id" :source="s" :index="i + 1" @open="$emit('open-source', $event)" />
      </div>
      <div v-if="message.role === 'assistant' && message.content" class="message-actions">
        <button type="button" class="btn btn-sm" aria-label="Copy answer" @click="copyAnswer">{{ copied ? 'Copied ✓' : 'Copy' }}</button>
      </div>
    </div>
  </article>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChatMessageItem, Source } from '../types'
import SourceCitation from './SourceCitation.vue'
import { renderMarkdown } from '../composables/useMarkdown'
const props = defineProps<{ message: ChatMessageItem }>()
defineEmits<{ (e: 'open-source', source: Source): void }>()
const renderedMarkdown = computed(() => renderMarkdown(props.message.content))
const copied = ref(false)
async function copyAnswer() {
  const text = props.message.content
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
    else throw new Error('clipboard unavailable')
  } catch {
    // Fallback for non-secure contexts: select-and-copy via a textarea.
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy') } catch { /* best effort */ }
    ta.remove()
  }
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
function formatTime(iso: string) { try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
</script>
<style scoped>
.message { display: flex; gap: 12px; padding: 14px 0; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.content { white-space: pre-wrap; margin: 4px 0; }
.meta { font-size: 13px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cache-badge { background: color-mix(in srgb, var(--accent-2) 18%, transparent); color: var(--warning); }
.message-actions { margin-top: 8px; display: flex; gap: 8px; }
.sources { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }

/* Rendered assistant Markdown — uses the existing CSS-variable theme so
   both light and dark modes pick it up automatically. */
.markdown-body { white-space: normal; line-height: 1.6; overflow-wrap: break-word; }
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) { margin: 16px 0 8px; font-weight: 700; line-height: 1.3; color: var(--text); }
.markdown-body :deep(h1) { font-size: 1.35em; }
.markdown-body :deep(h2) { font-size: 1.2em; }
.markdown-body :deep(h3) { font-size: 1.1em; }
.markdown-body :deep(h4) { font-size: 1em; }
.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child),
.markdown-body :deep(p:first-child) { margin-top: 0; }
.markdown-body :deep(p) { margin: 0 0 10px; }
.markdown-body :deep(p:last-child) { margin-bottom: 0; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) { margin: 0 0 10px; padding-left: 22px; }
.markdown-body :deep(li) { margin-bottom: 4px; line-height: 1.55; }
.markdown-body :deep(li > ul),
.markdown-body :deep(li > ol) { margin: 4px 0 0; }
.markdown-body :deep(strong) { font-weight: 700; }
.markdown-body :deep(em) { font-style: italic; }
.markdown-body :deep(a) { color: var(--text); text-decoration: underline; }
.markdown-body :deep(code) { background: var(--surface-2); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.88em; font-family: ui-monospace, 'SF Mono', 'Fira Code', Menlo, monospace; }
.markdown-body :deep(pre) { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; overflow-x: auto; margin: 0 0 10px; }
.markdown-body :deep(pre code) { background: none; padding: 0; font-size: 0.85em; }
.markdown-body :deep(blockquote) { margin: 0 0 10px; padding: 4px 0 4px 14px; border-left: 3px solid var(--border); color: var(--text-secondary); }
.markdown-body :deep(table) { border-collapse: collapse; margin: 0 0 10px; width: 100%; font-size: 0.92em; }
.markdown-body :deep(th),
.markdown-body :deep(td) { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
.markdown-body :deep(th) { background: var(--surface-2); font-weight: 700; }
.markdown-body :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 14px 0; }
</style>
