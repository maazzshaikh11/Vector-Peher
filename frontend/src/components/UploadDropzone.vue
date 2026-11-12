<template>
  <div class="dropzone" :class="{ dragging }" role="button" tabindex="0" aria-label="Upload PDF documents"
    @click="input?.click()" @keydown.enter="input?.click()" @keydown.space.prevent="input?.click()"
    @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
    <input ref="input" type="file" accept="application/pdf,.pdf" multiple hidden @change="onPick" />
    <p><strong>Drop PDFs here</strong> or click to browse</p>
    <p class="muted">PDF only · up to 50 MB each · multiple files supported</p>
    <div v-if="uploading" class="progress" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
      <div class="bar" :style="{ width: `${progress}%` }" /> <span class="muted">Uploading… {{ progress }}%</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ uploading?: boolean; progress?: number }>()
const emit = defineEmits<{ (e: 'files', files: File[]): void }>()
const dragging = ref(false)
const input = ref<HTMLInputElement | null>(null)
function onDrop(e: DragEvent) { dragging.value = false; const files = [...(e.dataTransfer?.files ?? [])]; if (files.length) emit('files', files) }
function onPick(e: Event) { const files = [...((e.target as HTMLInputElement).files ?? [])]; if (files.length) emit('files', files); (e.target as HTMLInputElement).value = '' }
</script>
<style scoped>
.dropzone { border: 2px dashed var(--border); border-radius: var(--radius); padding: 18px; text-align: center; cursor: pointer; background: var(--surface); }
.dropzone.dragging { border-color: var(--accent); background: var(--accent-soft); }
.progress { margin-top: 10px; }
.bar { height: 6px; background: var(--accent); border-radius: 3px; }
</style>
