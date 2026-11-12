<template>
  <section class="chat" aria-label="Chat">
    <div ref="scrollEl" class="messages">
      <EmptyState v-if="!chat.messages.length && !chat.loadingMessages" title="Ask Vector Brain" message="Upload documents, then ask a question. Answers cite the exact pages they came from." icon="🧠">
        <p class="muted">Try: “What are the key findings in these documents?”</p>
      </EmptyState>
      <LoadingIndicator v-else-if="chat.loadingMessages" label="Loading conversation…" />
      <template v-else>
        <ChatMessage v-for="m in chat.messages" :key="m.id" :message="m" @open-source="chat.openSource($event)" />
        <div v-if="chat.streaming" class="streaming-note" role="status"><span class="dot" /> Vector Brain is thinking… <button type="button" class="btn btn-sm btn-danger" @click="chat.stop()">Stop</button></div>
      </template>
    </div>
    <div class="composer-wrap">
      <ChatComposer :streaming="chat.streaming" :disabled="!docsReady" :hint="docsReady ? '' : 'Upload at least one document before asking a question.'" @send="chat.sendQuestion($event)" @attach="docs.upload($event)" @stop="chat.stop()" />
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useChatStore } from '../stores/chat'
import { useDocumentsStore } from '../stores/documents'
import ChatMessage from './ChatMessage.vue'
import ChatComposer from './ChatComposer.vue'
import EmptyState from './EmptyState.vue'
import LoadingIndicator from './LoadingIndicator.vue'
const chat = useChatStore()
const docs = useDocumentsStore()
const docsReady = computed(() => docs.documents.length > 0)
const scrollEl = ref<HTMLElement | null>(null)
watch(() => chat.messages.length, async () => { await nextTick(); scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight }) })
watch(() => chat.messages[chat.messages.length - 1]?.content, async () => { await nextTick(); if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight })
</script>
<style scoped>
.chat { display: flex; flex-direction: column; height: 100%; min-width: 0; }
.messages { flex: 1; overflow-y: auto; padding: 8px 24px; }
.composer-wrap { padding: 12px 24px 18px; border-top: 1px solid var(--border); background: var(--bg); }
.streaming-note { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); padding: 8px 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 1s infinite; }
@keyframes pulse { 50% { opacity: .3; } }
</style>
