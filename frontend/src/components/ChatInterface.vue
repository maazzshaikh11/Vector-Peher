<template>
  <section class="chat" aria-label="Chat">
    <div class="chat-head">
      <h2>Chat</h2>
      <button type="button" class="btn btn-sm" title="Clear responses and start a new chat" @click="chat.newChat()">Refresh</button>
    </div>
    <div ref="scrollEl" class="messages">
      <EmptyState v-if="!chat.messages.length && !chat.loadingMessages && !docs.readyDocuments.length" title="Ask Vector Brain" message="Upload documents, then ask a question. Answers cite the exact pages they came from." icon="🧠">
        <p class="muted">Try: “What are the key findings in these documents?”</p>
      </EmptyState>
      <LoadingIndicator v-else-if="chat.loadingMessages" label="Loading conversation…" />
      <!-- Notebook-guide empty state: once the first document is READY,
           show an extractive auto-summary + suggested questions instead of
           a blank page. The summary quotes retrieved chunks verbatim; the
           questions come from the documents' titles only. -->
      <div v-else-if="!chat.messages.length" class="notebook-guide" aria-label="Document summary and suggested questions">
        <h3>From your sources</h3>
        <LoadingIndicator v-if="guideLoading" label="Reading your sources…" />
        <ul v-else-if="guideItems.length" class="guide-summary">
          <li v-for="item in guideItems" :key="item.excerpt.slice(0, 40)">
            <span class="guide-excerpt">“{{ item.excerpt }}”</span>
            <span class="muted guide-attribution">{{ item.filename }} · p. {{ item.page_number }}</span>
          </li>
        </ul>
        <ul v-else class="guide-summary guide-meta">
          <li v-for="d in docs.readyDocuments" :key="d.id">
            <strong>{{ d.original_filename || d.filename }}</strong>
            <span class="muted"> — {{ d.page_count }} pages · Ready</span>
          </li>
        </ul>
        <div class="guide-questions" aria-label="Suggested questions">
          <button v-for="q in guideQuestions" :key="q" type="button" class="btn guide-chip" @click="askSuggested(q)">{{ q }}</button>
        </div>
      </div>
      <template v-else>
        <ChatMessage v-for="m in chat.messages" :key="m.id" :message="m" @open-source="chat.openSource($event)" />
        <div v-if="chat.streaming" class="streaming-note" role="status"><span class="dot" /> Vector Brain is thinking… <button type="button" class="btn btn-sm btn-danger" @click="chat.stop()">Stop</button></div>
      </template>
    </div>
    <div class="composer-wrap">
      <ChatComposer :streaming="chat.streaming" :disabled="!docsReady" :source-count="docs.scopedSourceCount" :hint="docsReady ? '' : 'Upload at least one document and select it before asking a question.'" @send="chat.sendQuestion($event)" @stop="chat.stop()" />
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useChatStore } from '../stores/chat'
import { useDocumentsStore } from '../stores/documents'
import { searchDocuments } from '../services/api'
import { buildSuggestedQuestions, buildSummaryItems, type SummaryItem } from '../composables/useNotebookGuide'
import ChatMessage from './ChatMessage.vue'
import ChatComposer from './ChatComposer.vue'
import EmptyState from './EmptyState.vue'
import LoadingIndicator from './LoadingIndicator.vue'
const chat = useChatStore()
const docs = useDocumentsStore()
const docsReady = computed(() => docs.scopedSourceCount > 0)
const scrollEl = ref<HTMLElement | null>(null)
const guideItems = ref<SummaryItem[]>([])
const guideQuestions = ref<string[]>([])
const guideLoading = ref(false)
const guideKey = ref('')
watch(() => chat.messages.length, async () => { await nextTick(); scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight }) })
watch(() => chat.messages[chat.messages.length - 1]?.content, async () => { await nextTick(); if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight })

/** (Re)build the notebook guide when the READY set changes and no
 *  conversation is open yet. Summary chunks come from the search API —
 *  never invented; on failure the metadata list is shown instead. */
async function refreshGuide() {
  const ready = docs.readyDocuments
  if (chat.messages.length || !ready.length) return
  const key = ready.map((d) => d.id).sort().join(',')
  if (key === guideKey.value) return
  guideKey.value = key
  guideQuestions.value = buildSuggestedQuestions(ready)
  guideLoading.value = true
  try {
    const results = await searchDocuments('What are the main topics and key points covered in these documents?', docs.selectedDocumentIds, 5)
    if (guideKey.value === key) guideItems.value = buildSummaryItems(results)
  } catch { if (guideKey.value === key) guideItems.value = [] }
  finally { if (guideKey.value === key) guideLoading.value = false }
}
watch(() => docs.readyDocuments.map((d) => `${d.id}:${d.status}`).join(','), refreshGuide, { immediate: true })
watch(() => chat.messages.length, (n) => { if (n === 0) refreshGuide() })

function askSuggested(q: string) { void chat.sendQuestion(q) }
</script>
<style scoped>
.chat { display: flex; flex-direction: column; height: 100%; min-width: 0; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); }
.chat-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border); }
.chat-head h2 { margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); }
.messages { flex: 1; overflow-y: auto; padding: 8px 24px; }
.composer-wrap { padding: 12px 24px 18px; border-top: 1px solid var(--border); background: var(--bg); border-radius: 0 0 var(--radius) var(--radius); }
.streaming-note { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); padding: 8px 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 1s infinite; }
@keyframes pulse { 50% { opacity: .3; } }
.notebook-guide { padding: 16px 0; max-width: 720px; margin: 0 auto; }
.notebook-guide h3 { font-size: 16px; margin: 0 0 12px; }
.guide-summary { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.guide-summary li { background: var(--surface-2); border-radius: 8px; padding: 10px 12px; line-height: 1.55; }
.guide-excerpt { display: block; }
.guide-attribution { font-size: 12px; }
.guide-questions { display: flex; flex-wrap: wrap; gap: 8px; }
.guide-chip { border-radius: 999px; background: var(--surface); text-align: left; }
</style>
