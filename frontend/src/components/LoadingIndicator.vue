<template>
  <div class="loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true" /> <span>{{ label }}</span></div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' })
</script>
<style scoped>
.loading { display: flex; align-items: center; gap: 10px; padding: 16px; color: var(--text-secondary); }
.spinner { width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
