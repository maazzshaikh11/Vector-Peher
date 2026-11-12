<template>
  <div class="empty" role="status">
    <div class="empty-icon" aria-hidden="true">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p class="muted">{{ message }}</p>
    <slot />
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ title: string; message: string; icon?: string }>(), { icon: '📄' })
</script>
<style scoped>
.empty { text-align: center; padding: 32px 16px; color: var(--text); }
.empty-icon { font-size: 36px; }
.empty h3 { margin: 8px 0 4px; }
.empty p { margin: 0 0 12px; }
</style>
