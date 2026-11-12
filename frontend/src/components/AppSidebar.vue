<template>
  <aside :class="['sidebar', { collapsed }]" aria-label="Sidebar">
    <div class="logo"><span class="logo-mark" aria-hidden="true">🧠</span><span v-if="!collapsed" class="logo-text"><strong>VECTOR BRAIN</strong><small class="muted">Research workspace</small></span></div>
    <button type="button" class="btn btn-primary new-chat" @click="onNewChat">＋ New Chat</button>
    <nav v-if="!collapsed" class="recent" aria-label="Recent conversations">
      <h2>Recent conversations</h2>
      <LoadingIndicator v-if="chat.loadingSessions" label="Loading chats…" />
      <p v-else-if="!chat.sessions.length" class="muted empty-note">No conversations yet.</p>
      <ul v-else>
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
    </nav>
    <div v-if="!collapsed" class="sidebar-footer">
      <span class="muted">{{ docs.documents.length }} document{{ docs.documents.length === 1 ? '' : 's' }} · {{ docs.readyDocuments.length }} ready</span>
      <ThemeToggle />
      <button type="button" class="btn btn-sm" @click="$emit('toggle-collapse')">{{ collapsed ? 'Expand' : 'Collapse' }}</button>
    </div>
    <ConfirmDialog :open="!!pendingDelete" title="Delete chat?" :message="pendingDelete ? `Delete “${pendingDelete.title}”? Its messages will be removed.` : ''" confirm-label="Delete" @confirm="confirmDelete" @cancel="pendingDelete = null" />
  </aside>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '../stores/chat'
import { useDocumentsStore } from '../stores/documents'
import type { ChatSession } from '../types'
import ThemeToggle from './ThemeToggle.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import ConfirmDialog from './ConfirmDialog.vue'
defineProps<{ collapsed?: boolean }>()
defineEmits<{ (e: 'toggle-collapse'): void }>()
const chat = useChatStore()
const docs = useDocumentsStore()
const renaming = ref<ChatSession | null>(null)
const renameTitle = ref('')
const pendingDelete = ref<ChatSession | null>(null)
async function onNewChat() { await chat.newChat() }
function startRename(s: ChatSession) { renaming.value = s; renameTitle.value = s.title }
async function confirmRename() { if (renaming.value) await chat.rename(renaming.value.id, renameTitle.value); renaming.value = null }
async function confirmDelete() { if (pendingDelete.value) await chat.removeSession(pendingDelete.value.id); pendingDelete.value = null }
</script>
<style scoped>
.sidebar { width: 280px; flex-shrink: 0; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 16px; gap: 14px; height: 100%; }
.sidebar.collapsed { width: 76px; }
.logo { display: flex; gap: 10px; align-items: center; }
.logo-mark { font-size: 26px; }
.logo-text { display: flex; flex-direction: column; }
.new-chat { width: 100%; }
.recent { flex: 1; overflow-y: auto; min-height: 0; }
.recent h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-secondary); margin: 0 0 8px; }
.recent ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.recent li { display: flex; align-items: center; gap: 4px; border-radius: 8px; }
.recent li.active { background: var(--accent-soft); }
.session-btn { flex: 1; min-width: 0; text-align: left; background: none; border: none; color: var(--text); padding: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.icon-btn { background: none; border: none; padding: 4px; font-size: 13px; }
.sidebar-footer { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; font-size: 13px; }
.rename-row { display: flex; gap: 6px; margin-top: 8px; }
.empty-note { font-size: 13px; }
</style>
