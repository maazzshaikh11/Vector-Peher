<template>
  <div v-if="open" class="overlay" role="dialog" aria-modal="true" :aria-label="title" @click.self="$emit('cancel')">
    <div class="dialog card">
      <h3>{{ title }}</h3>
      <p class="muted">{{ message }}</p>
      <div class="actions">
        <button type="button" class="btn" @click="$emit('cancel')">Cancel</button>
        <button type="button" class="btn btn-danger" autofocus @click="$emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ open: boolean; title: string; message: string; confirmLabel?: string }>(), { confirmLabel: 'Delete' })
defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()
</script>
<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(16,23,34,.5); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
.dialog { padding: 20px; max-width: 420px; width: 100%; }
.dialog h3 { margin: 0 0 8px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
</style>
