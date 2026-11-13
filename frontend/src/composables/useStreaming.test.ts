import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStreaming } from './useStreaming'

function sseResponse(body: string): Response {
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(body)); c.close() } })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}

describe('useStreaming', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  it('accumulates tokens, sources and done', async () => {
    const body = 'data: {"type":"token","text":"Hello "}\ndata: {"type":"token","text":"world"}\ndata: {"type":"sources","sources":[{"filename":"a.pdf","page_number":1,"chunk_id":"c1","score":0.9}]}\ndata: {"type":"done","session_id":"s1"}\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(body)))
    const { streamChat, streaming } = useStreaming()
    const tokens: string[] = []; let sources: unknown = null; let doneId: string | undefined
    await streamChat('hi', {}, { onToken: (t) => tokens.push(t), onSources: (s) => { sources = s }, onDone: (id) => { doneId = id } })
    expect(tokens.join('')).toBe('Hello world')
    expect((sources as unknown[]).length).toBe(1)
    expect(doneId).toBe('s1'); expect(streaming.value).toBe(false)
  })
  it('handles plain-text SSE chunks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse('data: plain chunk\n')))
    const { streamChat } = useStreaming()
    const tokens: string[] = []
    await streamChat('hi', {}, { onToken: (t) => tokens.push(t) })
    expect(tokens).toEqual(['plain chunk'])
  })
  it('reports error events', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse('data: {"type":"error","message":"no docs"}\n')))
    const { streamChat } = useStreaming()
    let err = ''
    await streamChat('hi', {}, { onError: (m) => { err = m } })
    expect(err).toBe('no docs')
  })
  it('reports HTTP failure as error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })))
    const { streamChat } = useStreaming()
    let err = ''
    await streamChat('hi', {}, { onError: (m) => { err = m } })
    expect(err).toMatch(/500/)
  })
  it('fires onCached for the cached event', async () => {
    const body = 'data: {"type":"sources","sources":[]}\ndata: {"type":"cached","cached":true}\ndata: {"type":"token","text":"cached answer"}\ndata: {"type":"done"}\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(body)))
    const { streamChat } = useStreaming()
    let cached = false; const tokens: string[] = []
    await streamChat('hi', {}, { onToken: (t) => tokens.push(t), onCached: () => { cached = true } })
    expect(cached).toBe(true)
    expect(tokens.join('')).toBe('cached answer')
  })
})
