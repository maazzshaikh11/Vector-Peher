<template>
  <header class="app-header">
    <button type="button" class="btn btn-sm menu-btn" aria-label="Toggle sidebar" @click="$emit('toggle-sidebar')">☰</button>
    <div class="title">
      <h1>{{ title }}</h1>
      <span class="muted subtitle">{{ subtitle }}</span>
    </div>
    <div class="header-actions">
      <span :class="['badge', healthy === true ? 'badge-success' : healthy === false ? 'badge-error' : '']" role="status">{{ healthy === true ? 'Backend connected' : healthy === false ? 'Backend unreachable' : 'Checking backend…' }}</span>
      <button type="button" class="btn btn-sm" @click="$emit('toggle-doc-panel')">Documents</button>
      <ThemeToggle />
    </div>
  </header>
</template>
<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue'
withDefaults(defineProps<{ title?: string; subtitle?: string; healthy?: boolean | null }>(), { title: 'Research Workspace', subtitle: 'Chat with your documents', healthy: null })
defineEmits<{ (e: 'toggle-sidebar'): void; (e: 'toggle-doc-panel'): void }>()
</script>
<style scoped>
.app-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: var(--surface); border-bottom: 1px solid var(--border); }
.title { flex: 1; min-width: 0; }
.title h1 { font-size: 18px; margin: 0; }
.subtitle { font-size: 13px; }
.header-actions { display: flex; align-items: center; gap: 8px; }
@media (max-width: 700px) { .subtitle, .menu-btn { display: none; } }
</style>
