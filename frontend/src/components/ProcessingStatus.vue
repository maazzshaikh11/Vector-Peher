<template>
  <span :class="['badge', badgeClass]" role="status">{{ label }}</span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ status: string }>()
const label = computed(() => { const s = props.status.toUpperCase(); return s === 'READY' ? 'Ready' : s === 'FAILED' ? 'Failed' : s === 'INDEXING' ? 'Indexing…' : s === 'PROCESSING' ? 'Processing…' : props.status })
const badgeClass = computed(() => { const s = props.status.toUpperCase(); return s === 'READY' ? 'badge-success' : s === 'FAILED' ? 'badge-error' : 'badge-processing' })
</script>
