<template>
  <div class="toasts" aria-live="polite">
    <div v-for="t in toast.toasts" :key="t.id" :class="['toast', `toast-${t.kind}`]" role="status">
      <span>{{ t.message }}</span>
      <button type="button" aria-label="Dismiss notification" @click="toast.dismiss(t.id)">✕</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useToastStore } from '../stores/toast'
const toast = useToastStore()
</script>
<style scoped>
.toasts { position: fixed; bottom: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 70; max-width: min(420px, 90vw); }
.toast { display: flex; gap: 12px; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 8px; padding: 10px 12px; box-shadow: var(--shadow); }
.toast-error { border-left-color: var(--error); }
.toast-success { border-left-color: var(--success); }
.toast button { background: none; border: none; color: var(--text-secondary); }
</style>
