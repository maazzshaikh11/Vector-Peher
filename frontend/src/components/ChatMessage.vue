<template>
  <article :class="['message', `message-${message.role}`]">
    <div class="avatar" aria-hidden="true">{{ message.role === 'user' ? '🧑' : '🧠' }}</div>
    <div class="body">
      <div class="meta"><strong>{{ message.role === 'user' ? 'You' : 'Vector Brain' }}</strong> <span v-if="message.created_at" class="muted">{{ formatTime(message.created_at) }}</span></div>
      <p class="content">{{ message.content }}</p>
      <div v-if="message.role === 'assistant' && message.sources?.length" class="sources">
        <span class="muted sources-label">Sources:</span>
        <SourceCitation v-for="s in message.sources" :key="s.chunk_id" :source="s" @open="$emit('open-source', $event)" />
      </div>
    </div>
  </article>
</template>
<script setup lang="ts">
import type { ChatMessageItem, Source } from '../types'
import SourceCitation from './SourceCitation.vue'
defineProps<{ message: ChatMessageItem }>()
defineEmits<{ (e: 'open-source', source: Source): void }>()
function formatTime(iso: string) { try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
</script>
<style scoped>
.message { display: flex; gap: 12px; padding: 14px 0; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--surface-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.content { white-space: pre-wrap; margin: 4px 0; }
.meta { font-size: 13px; }
.sources { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
</style>
