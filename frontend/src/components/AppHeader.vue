<template>
  <header class="app-header">
    <div class="brand">
      <span class="logo-mark" aria-hidden="true">🧠</span>
      <div class="title">
        <h1>{{ title }}</h1>
        <span class="muted subtitle">{{ subtitle }}</span>
      </div>
    </div>
    <div class="header-actions">
      <span :class="['badge', healthy === true ? 'badge-success' : healthy === false ? 'badge-error' : '']" role="status">{{ healthy === true ? 'Backend connected' : healthy === false ? 'Backend unreachable' : 'Checking backend…' }}</span>
      <button type="button" class="btn btn-sm" :aria-pressed="sourcesOpen" @click="$emit('toggle-sources')">Sources</button>
      <button type="button" class="btn btn-sm" :aria-pressed="detailsOpen" @click="$emit('toggle-details')">Details</button>
      <ThemeToggle />
      <div class="settings-wrap">
        <button type="button" class="btn btn-sm" aria-label="Settings" aria-haspopup="menu" :aria-expanded="settingsOpen" @click="settingsOpen = !settingsOpen">⚙️ Settings</button>
        <div v-if="settingsOpen" class="settings-menu" role="menu">
          <button type="button" role="menuitem" @click="toggleTheme">Theme: {{ theme.mode === 'dark' ? 'Dark' : 'Light' }} — switch</button>
          <button type="button" role="menuitem" @click="emitToggle('toggle-sources')">{{ sourcesOpen ? 'Hide' : 'Show' }} Sources panel</button>
          <button type="button" role="menuitem" @click="emitToggle('toggle-details')">{{ detailsOpen ? 'Hide' : 'Show' }} Details panel</button>
          <button type="button" role="menuitem" @click="newChat">New chat</button>
        </div>
      </div>
    </div>
  </header>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import ThemeToggle from './ThemeToggle.vue'
import { useThemeStore } from '../stores/theme'
import { useChatStore } from '../stores/chat'
withDefaults(defineProps<{ title?: string; subtitle?: string; healthy?: boolean | null; sourcesOpen?: boolean; detailsOpen?: boolean }>(), { title: 'Vector Brain', subtitle: 'Research workspace', healthy: null, sourcesOpen: true, detailsOpen: true })
const emit = defineEmits<{ (e: 'toggle-sources'): void; (e: 'toggle-details'): void }>()
const theme = useThemeStore()
const chat = useChatStore()
const settingsOpen = ref(false)
function toggleTheme() { theme.toggle(); settingsOpen.value = false }
function emitToggle(e: 'toggle-sources' | 'toggle-details') { if (e === 'toggle-sources') emit('toggle-sources'); else emit('toggle-details'); settingsOpen.value = false }
async function newChat() { settingsOpen.value = false; await chat.newChat() }
</script>
<style scoped>
.app-header { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.logo-mark { font-size: 24px; }
.title { min-width: 0; }
.title h1 { font-size: 18px; margin: 0; white-space: nowrap; }
.subtitle { font-size: 13px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.settings-wrap { position: relative; }
.settings-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 50; display: flex; flex-direction: column; min-width: 220px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); padding: 4px; }
.settings-menu button { text-align: left; background: none; border: none; color: var(--text); padding: 8px 10px; border-radius: 6px; }
.settings-menu button:hover { background: var(--surface-2); }
@media (max-width: 700px) { .subtitle { display: none; } .header-actions .badge { display: none; } }
</style>
