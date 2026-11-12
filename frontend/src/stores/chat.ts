import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createSession, deleteSession, getSession, listSessions, renameSession } from '../services/api'
import type { ChatMessageItem, ChatSession, Source } from '../types'
import { useStreaming } from '../composables/useStreaming'
import { useToastStore } from './toast'
import { useDocumentsStore } from './documents'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const currentSessionId = ref<string | null>(null)
  const messages = ref<ChatMessageItem[]>([])
  const loadingSessions = ref(false)
  const loadingMessages = ref(false)
  const error = ref<string | null>(null)
  const selectedSource = ref<Source | null>(null)
  const { streaming, streamChat, stop } = useStreaming()
  const toast = useToastStore()

  const currentSession = computed(() => sessions.value.find((s) => s.id === currentSessionId.value) ?? null)
  const isStreaming = computed(() => streaming.value)

  async function fetchSessions() {
    loadingSessions.value = true
    try { sessions.value = await listSessions() } catch (e) { error.value = (e as Error).message }
    finally { loadingSessions.value = false }
  }
  async function newChat(): Promise<ChatSession | null> {
    try {
      const s = await createSession()
      sessions.value = [s, ...sessions.value]
      currentSessionId.value = s.id; messages.value = []
      return s
    } catch (e) { toast.push(`Could not create chat: ${(e as Error).message}`, 'error'); return null }
  }
  async function loadSession(id: string) {
    loadingMessages.value = true; error.value = null
    try { const s = await getSession(id); currentSessionId.value = s.id; messages.value = s.messages ?? [] }
    catch (e) { error.value = (e as Error).message; toast.push(`Could not load chat: ${error.value}`, 'error') }
    finally { loadingMessages.value = false }
  }
  async function rename(id: string, title: string) {
    const clean = title.trim(); if (!clean) return
    try { const s = await renameSession(id, clean); sessions.value = sessions.value.map((x) => (x.id === id ? s : x)) }
    catch (e) { toast.push(`Rename failed: ${(e as Error).message}`, 'error') }
  }
  async function removeSession(id: string) {
    try { await deleteSession(id); sessions.value = sessions.value.filter((s) => s.id !== id); if (currentSessionId.value === id) { currentSessionId.value = null; messages.value = [] } toast.push('Chat deleted.', 'success') }
    catch (e) { toast.push(`Delete failed: ${(e as Error).message}`, 'error') }
  }

  async function sendQuestion(question: string): Promise<void> {
    const q = question.trim()
    if (!q || streaming.value) return
    const docs = useDocumentsStore()
    if (!currentSessionId.value) { const s = await newChat(); if (!s) return }
    const userMsg: ChatMessageItem = { id: `u-${Date.now()}`, role: 'user', content: q, created_at: new Date().toISOString() }
    const aiMsg: ChatMessageItem = { id: `a-${Date.now()}`, role: 'assistant', content: '', sources: [], created_at: new Date().toISOString() }
    messages.value = [...messages.value, userMsg, aiMsg]
    const aiIndex = messages.value.length - 1
    await streamChat(q, { sessionId: currentSessionId.value ?? undefined, documentIds: docs.selectedDocumentIds, topK: 5 }, {
      onToken: (text) => { messages.value[aiIndex] = { ...messages.value[aiIndex], content: messages.value[aiIndex].content + text } },
      onSources: (sources) => { messages.value[aiIndex] = { ...messages.value[aiIndex], sources } },
      onDone: (sid) => { if (sid && !currentSessionId.value) currentSessionId.value = sid },
      onError: (msg) => {
        messages.value[aiIndex] = { ...messages.value[aiIndex], content: messages.value[aiIndex].content || `Sorry — I could not get an answer: ${msg}` }
        toast.push(`Chat error: ${msg}`, 'error')
      },
    })
    // Refresh session title list (backend may title the session from the first question).
    try { sessions.value = await listSessions() } catch { /* non-fatal */ }
  }

  function openSource(source: Source) { selectedSource.value = source }
  function closeSource() { selectedSource.value = null }

  return { sessions, currentSessionId, messages, loadingSessions, loadingMessages, error, selectedSource, streaming: isStreaming, fetchSessions, newChat, loadSession, rename, removeSession, sendQuestion, stop, openSource, closeSource, currentSession }
})
