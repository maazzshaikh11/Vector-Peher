import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
vi.mock('../services/api', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  return { ...actual, listSessions: vi.fn(), createSession: vi.fn(), getSession: vi.fn(), renameSession: vi.fn(), deleteSession: vi.fn() }
})
import { listSessions, createSession, getSession } from '../services/api'
import { useChatStore } from './chat'

function sse(body: string) {
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(body)); c.close() } })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}

describe('chat store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks(); vi.restoreAllMocks() })
  it('loads sessions', async () => {
    vi.mocked(listSessions).mockResolvedValue([{ id: 's1', title: 'First chat' }])
    const c = useChatStore(); await c.fetchSessions()
    expect(c.sessions.length).toBe(1); expect(c.sessions[0].title).toBe('First chat')
  })
  it('loads a session messages', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 's1', title: 'T', messages: [{ id: 'm1', role: 'user', content: 'hi' }] })
    const c = useChatStore(); await c.loadSession('s1')
    expect(c.messages.length).toBe(1); expect(c.messages[0].content).toBe('hi')
  })
  it('does not send empty questions', async () => {
    const c = useChatStore(); await c.sendQuestion('   ')
    expect(c.messages.length).toBe(0); expect(createSession).not.toHaveBeenCalled()
  })
  it('streams an answer into the assistant message with citations', async () => {
    vi.mocked(createSession).mockResolvedValue({ id: 's9', title: 'New chat' })
    vi.mocked(listSessions).mockResolvedValue([{ id: 's9', title: 'New chat' }])
    const body = 'data: {"type":"token","text":"The answer "}\ndata: {"type":"token","text":"is 42."}\ndata: {"type":"sources","sources":[{"filename":"a.pdf","page_number":2,"chunk_id":"c1","score":0.91}]}\ndata: {"type":"done","session_id":"s9"}\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(body)))
    const c = useChatStore()
    await c.sendQuestion('What is the answer?')
    expect(c.messages.length).toBe(2)
    expect(c.messages[0].role).toBe('user')
    expect(c.messages[1].content).toBe('The answer is 42.')
    expect(c.messages[1].sources?.[0].filename).toBe('a.pdf')
    expect(c.streaming).toBe(false)
  })
  it('opens and closes a source', () => {
    const c = useChatStore()
    const s = { filename: 'a.pdf', page_number: 1, chunk_id: 'c1', score: 0.5 }
    c.openSource(s); expect(c.selectedSource).toEqual(s)
    c.closeSource(); expect(c.selectedSource).toBeNull()
  })
})
