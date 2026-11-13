<template>
  <section class="session-history" aria-label="Chat history">
    <div class="history-head"><h3>Chat history</h3><button type="button" class="btn btn-sm btn-primary" @click="onNewChat">＋ New chat</button></div>
    <LoadingIndicator v-if="chat.loadingSessions" label="Loading chats…" />
    <p v-else-if="!chat.sessions.length" class="muted empty-note">No conversations yet.</p>
    <ul v-else class="session-list">
      <li v-for="s in chat.sessions" :key="s.id" :class="{ active: s.id === chat.currentSessionId }">
        <button type="button" class="session-btn" :title="s.title" @click="chat.loadSession(s.id)">{{ s.title || 'Untitled chat' }}</button>
        <button type="button" class="icon-btn" :aria-label="`Rename ${s.title}`" title="Rename" @click="startRename(s)">✏️</button>
        <button type="button" class="icon-btn" :aria-label="`Delete ${s.title}`" title="Delete" @click="pendingDelete = s">🗑️</button>
      </li>
    </ul>
    <div v-if="renaming" class="rename-row">
      <input v-model="renameTitle" class="input" aria-label="New chat title" @keydown.enter="confirmRename" @keydown.escape="renaming = null" />
      <button type="button" class="btn btn-sm btn-primary" @click="confirmRename">Save</button>
    </div>
    <ConfirmDialog :open="!!pendingDelete" title="Delete chat?" :message="pendingDelete ? `Delete “${pendingDelete.title}”? Its messages will be removed.` : ''" confirm-label="Delete" @confirm="confirmDelete" @cancel="pendingDelete = null" />
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '../stores/chat'
import type { ChatSession } from '../types'
import LoadingIndicator from './LoadingIndicator.vue'
import ConfirmDialog from './ConfirmDialog.vue'
const chat = useChatStore()
const renaming = ref<ChatSession | null>(null)
const renameTitle = ref('')
const pendingDelete = ref<ChatSession | null>(null)
async function onNewChat() { await chat.newChat() }
function startRename(s: ChatSession) { renaming.value = s; renameTitle.value = s.title }
async function confirmRename() { if (renaming.value) await chat.rename(renaming.value.id, renameTitle.value); renaming.value = null }
async function confirmDelete() { if (pendingDelete.value) await chat.removeSession(pendingDelete.value.id); pendingDelete.value = null }
</script>
<style scoped>
.session-history { display: flex; flex-direction: column; gap: 8px; }
.history-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.history-head h3 { margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); }
.session-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: 320px; overflow-y: auto; }
.session-list li { display: flex; align-items: center; gap: 4px; border-radius: 8px; }
.session-list li.active { background: var(--accent-soft); }
.session-btn { flex: 1; min-width: 0; text-align: left; background: none; border: none; color: var(--text); padding: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icon-btn { background: none; border: none; padding: 4px; font-size: 13px; }
.rename-row { display: flex; gap: 6px; margin-top: 4px; }
.empty-note { font-size: 13px; margin: 0; }
</style>
