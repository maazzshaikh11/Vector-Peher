<template>
  <button type="button" class="theme-toggle" :aria-label="theme.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" :title="theme.mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'" @click="theme.toggle()">
    <span aria-hidden="true">{{ theme.mode === 'dark' ? '☀️' : '🌙' }}</span>
    <span class="theme-label">{{ theme.mode === 'dark' ? 'Light' : 'Dark' }}</span>
  </button>
</template>
<script setup lang="ts">
import { useThemeStore } from '../stores/theme'
const theme = useThemeStore()
</script>
<style scoped>
.theme-toggle { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 8px; padding: 6px 10px; }
.theme-toggle:hover { border-color: var(--accent); }
</style>
