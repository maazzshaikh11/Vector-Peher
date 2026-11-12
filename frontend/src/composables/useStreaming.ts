import { ref } from 'vue'
import { chatStreamUrl, parseSseLine } from '../services/api'
import type { Source } from '../types'

export interface StreamCallbacks {
  onToken?: (text: string) => void
  onSources?: (sources: Source[]) => void
  onDone?: (sessionId?: string) => void
  onError?: (message: string) => void
}

export function useStreaming() {
  const streaming = ref(false)
  const controller = ref<AbortController | null>(null)

  async function streamChat(question: string, opts: { sessionId?: string; documentIds?: string[] | null; topK?: number }, cb: StreamCallbacks): Promise<void> {
    const ac = new AbortController()
    controller.value = ac
    streaming.value = true
    try {
      const res = await fetch(chatStreamUrl(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, session_id: opts.sessionId, document_ids: opts.documentIds ?? null, top_k: opts.topK ?? 5 }),
        signal: ac.signal,
      })
      if (!res.ok) throw new Error(`Chat request failed (${res.status})`)
      if (!res.body) throw new Error('Streaming is not supported by this response.')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let doneCalled = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const ev = parseSseLine(line)
          if (!ev) continue
          if (ev.type === 'token' && ev.text) cb.onToken?.(ev.text)
          else if (ev.type === 'sources' && Array.isArray(ev.sources)) cb.onSources?.(ev.sources as Source[])
          else if (ev.type === 'done') { doneCalled = true; cb.onDone?.(ev.session_id as string | undefined) }
          else if (ev.type === 'error') cb.onError?.(ev.message || 'Streaming error')
        }
      }
      if (buffer.trim()) { const ev = parseSseLine(buffer); if (ev?.type === 'token' && ev.text) cb.onToken?.(ev.text) }
      if (!doneCalled) cb.onDone?.()
    } catch (err) {
      if ((err as Error).name === 'AbortError') { cb.onDone?.(); return }
      cb.onError?.((err as Error).message || 'Streaming failed')
    } finally {
      streaming.value = false
      controller.value = null
    }
  }

  function stop() { controller.value?.abort() }
  return { streaming, streamChat, stop }
}
