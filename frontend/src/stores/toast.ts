import { defineStore } from 'pinia'
import { ref } from 'vue'
export interface Toast { id: number; message: string; kind: 'success' | 'error' | 'info' }
let nextId = 1
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  function push(message: string, kind: Toast['kind'] = 'info', ms = 4000) {
    const id = nextId++
    toasts.value.push({ id, message, kind })
    setTimeout(() => dismiss(id), ms)
    return id
  }
  function dismiss(id: number) { toasts.value = toasts.value.filter((t) => t.id !== id) }
  return { toasts, push, dismiss }
})
