<template>
  <div class="workspace">
    <AppSidebar v-if="sidebarOpen" :collapsed="sidebarCollapsed" @toggle-collapse="sidebarCollapsed = !sidebarCollapsed" />
    <main class="main">
      <AppHeader :healthy="healthy" :title="chat.currentSession?.title || 'Research Workspace'" @toggle-sidebar="sidebarOpen = !sidebarOpen" @toggle-doc-panel="docPanelOpen = !docPanelOpen" />
      <div class="content">
        <ChatInterface />
        <SourcePanel v-if="chat.selectedSource" :source="chat.selectedSource" @close="chat.closeSource()" />
      </div>
    </main>
    <aside :class="['doc-panel', { 'open-mobile': docPanelOpen }]" aria-label="Document panel">
      <div class="doc-panel-head"><h2>Documents</h2><button type="button" class="btn btn-sm" @click="docPanelOpen = false">Close</button></div>
      <DocumentManager />
    </aside>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '../components/AppSidebar.vue'
import AppHeader from '../components/AppHeader.vue'
import ChatInterface from '../components/ChatInterface.vue'
import DocumentManager from '../components/DocumentManager.vue'
import SourcePanel from '../components/SourcePanel.vue'
import { useChatStore } from '../stores/chat'
import { useDocumentsStore } from '../stores/documents'
import { checkHealth } from '../services/api'

const chat = useChatStore()
const docs = useDocumentsStore()
const route = useRoute()
const sidebarOpen = ref(true)
const sidebarCollapsed = ref(false)
const docPanelOpen = ref(false)
const healthy = ref<boolean | null>(null)

onMounted(async () => {
  try { const h = await checkHealth(); healthy.value = h.status === 'ok' } catch { healthy.value = false }
  await Promise.allSettled([docs.fetchDocuments(), chat.fetchSessions()])
  const id = route.params.id as string | undefined
  if (id) await chat.loadSession(id)
})
</script>
<style scoped>
.workspace { display: flex; height: 100vh; overflow: hidden; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.content { flex: 1; display: flex; min-height: 0; }
.doc-panel { width: 340px; flex-shrink: 0; background: var(--surface); border-left: 1px solid var(--border); padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.doc-panel-head { display: flex; justify-content: space-between; align-items: center; }
.doc-panel-head h2 { margin: 0; font-size: 16px; }
</style>
