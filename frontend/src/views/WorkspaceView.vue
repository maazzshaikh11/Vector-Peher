<template>
  <div class="workspace">
    <AppHeader :healthy="healthy" :sources-open="sourcesOpen" :details-open="detailsOpen" @toggle-sources="toggleSources" @toggle-details="toggleDetails" />
    <div class="panels">
      <aside :class="['panel-sources', { collapsed: !sourcesOpen, 'mobile-active': mobileView === 'sources' }]" aria-label="Sources panel">
        <button type="button" class="panel-close" aria-label="Close sources panel" @click="mobileView = 'chat'">✕</button>
        <DocumentManager />
      </aside>
      <div v-if="!sourcesOpen" class="rail rail-left"><button type="button" aria-label="Show sources panel" title="Show sources" @click="sourcesOpen = true">›</button></div>
      <main class="main">
        <ChatInterface />
      </main>
      <div v-if="!detailsOpen" class="rail rail-right"><button type="button" aria-label="Show details panel" title="Show details" @click="detailsOpen = true">‹</button></div>
      <DetailsPanel :class="{ collapsed: !detailsOpen, 'mobile-active': mobileView === 'details' }" @close="closeDetails" />
    </div>
    <nav class="mobile-tabs" aria-label="Panels">
      <button type="button" :class="{ active: mobileView === 'sources' }" @click="mobileView = 'sources'">Sources</button>
      <button type="button" :class="{ active: mobileView === 'chat' }" @click="mobileView = 'chat'">Chat</button>
      <button type="button" :class="{ active: mobileView === 'details' }" @click="mobileView = 'details'">Details</button>
    </nav>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import ChatInterface from '../components/ChatInterface.vue'
import DocumentManager from '../components/DocumentManager.vue'
import DetailsPanel from '../components/DetailsPanel.vue'
import { useChatStore } from '../stores/chat'
import { useDocumentsStore } from '../stores/documents'
import { checkHealth } from '../services/api'

const chat = useChatStore()
const docs = useDocumentsStore()
const route = useRoute()
const sourcesOpen = ref(true)
const detailsOpen = ref(true)
/** Small-screen active view: panels become switchable tabs/views. */
const mobileView = ref<'sources' | 'chat' | 'details'>('chat')
const healthy = ref<boolean | null>(null)

function isMobile() { return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches }
function toggleSources() { if (isMobile()) mobileView.value = mobileView.value === 'sources' ? 'chat' : 'sources'; else sourcesOpen.value = !sourcesOpen.value }
function toggleDetails() { if (isMobile()) mobileView.value = mobileView.value === 'details' ? 'chat' : 'details'; else detailsOpen.value = !detailsOpen.value }
function closeDetails() { detailsOpen.value = false; mobileView.value = 'chat' }

onMounted(async () => {
  try { const h = await checkHealth(); healthy.value = h.status === 'ok' } catch { healthy.value = false }
  await Promise.allSettled([docs.fetchDocuments(), chat.fetchSessions()])
  const id = route.params.id as string | undefined
  if (id) await chat.loadSession(id)
})
</script>
<style scoped>
.workspace { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--bg); }
.panels { flex: 1; display: flex; min-height: 0; }
.panel-sources { width: 300px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border); padding: 16px; overflow-y: auto; }
.panel-sources.collapsed { display: none; }
.workspace :deep(.details-panel.collapsed) { display: none; }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; padding: 12px; }
.main :deep(.chat) { flex: 1; min-height: 0; }
.rail { width: 28px; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 12px; }
.rail button { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 4px 8px; color: var(--text-secondary); }
.mobile-tabs { display: none; }
.panel-close { display: none; }
@media (max-width: 900px) {
  .panel-sources, .workspace :deep(.details-panel) { display: none; }
  .panel-sources.mobile-active, .workspace :deep(.details-panel.mobile-active) { display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; z-index: 40; box-shadow: var(--shadow); width: min(340px, 92vw); }
  .panel-sources.mobile-active { left: 0; border-right: 1px solid var(--border); }
  .workspace :deep(.details-panel.mobile-active) { right: 0; border-left: 1px solid var(--border); }
  .rail { display: none; }
  .mobile-tabs { display: flex; gap: 4px; padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); background: var(--surface); border-top: 1px solid var(--border); position: relative; z-index: 50; }
  .panel-close { display: block; align-self: flex-end; background: none; border: 1px solid var(--border); border-radius: 8px; padding: 4px 10px; color: var(--text-secondary); margin-bottom: 4px; }
  .mobile-tabs button { flex: 1; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 8px 0; }
  .mobile-tabs button.active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
}
</style>
