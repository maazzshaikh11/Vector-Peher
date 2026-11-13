import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from './ChatMessage.vue'
import { renderMarkdown } from '../composables/useMarkdown'

const assistant = (content: string) => ({
  id: 'a1',
  role: 'assistant' as const,
  content,
})

describe('renderMarkdown (useMarkdown)', () => {
  it('renders headings, bullets and paragraphs', () => {
    const html = renderMarkdown('## Overview\n\nIntro line.\n\n- one\n- two\n')
    expect(html).toContain('<h2>Overview</h2>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>one</li>')
    expect(html).toContain('<p>Intro line.</p>')
  })

  it('renders tables and code blocks', () => {
    const html = renderMarkdown(
      '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst x = 1\n```\n',
    )
    expect(html).toContain('<table>')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<td>2</td>')
    expect(html).toContain('<pre><code')
    expect(html).toContain('const x = 1')
  })

  it('renders blockquotes, bold and italic', () => {
    const html = renderMarkdown('> quoted\n\n**bold** and *italic*\n')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('handles partial streaming markdown without breaking', () => {
    // Incomplete fence / list mid-stream must still produce output.
    const partial = renderMarkdown('## Head\n\n- item one\n- it')
    expect(partial).toContain('<h2>Head</h2>')
    expect(partial).toContain('<li>')
    const fence = renderMarkdown('```js\nconst x =')
    expect(fence).toContain('<pre>')
  })

  it('neutralizes a script payload', () => {
    // DOMPurify removes the <script> element and its contents entirely.
    const html = renderMarkdown('Hello\n\n<script>alert(1)</script>\n')
    expect(html).toContain('Hello')
    expect(html).not.toContain('script')
    expect(html).not.toContain('alert(1)')
  })

  it('neutralizes an onerror image payload', () => {
    // DOMPurify strips the onerror handler; the harmless <img> may remain.
    const html = renderMarkdown('<img src=x onerror=alert(1)>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert(1)')
  })

  it('neutralizes a javascript: link', () => {
    // markdown-it rejects javascript: URLs, so no <a> is produced at all.
    const html = renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('href="javascript:')
  })
})

describe('ChatMessage markdown rendering', () => {
  it('renders assistant markdown as HTML (headings, bullets, table)', () => {
    const w = mount(ChatMessage, {
      props: {
        message: assistant(
          '## Summary\n\nShort intro.\n\n- point one\n- point two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n',
        ),
      },
    })
    const body = w.find('.markdown-body')
    expect(body.exists()).toBe(true)
    expect(body.find('h2').exists()).toBe(true)
    expect(body.find('h2').text()).toBe('Summary')
    expect(body.findAll('li').length).toBe(2)
    expect(body.find('table').exists()).toBe(true)
  })

  it('renders a code block in an assistant message', () => {
    const w = mount(ChatMessage, {
      props: { message: assistant('```\nconst x = 1\n```') },
    })
    expect(w.find('.markdown-body pre code').exists()).toBe(true)
    expect(w.find('.markdown-body pre code').text()).toContain('const x = 1')
  })

  it('renders stored (reloaded) assistant messages as markdown too', () => {
    const w = mount(ChatMessage, {
      props: {
        message: { ...assistant('## Reloaded\n\n- saved\n'), created_at: '2026-11-12T10:00:00Z' },
      },
    })
    expect(w.find('.markdown-body h2').text()).toBe('Reloaded')
  })

  it('sanitizes malicious content in an assistant message', () => {
    const w = mount(ChatMessage, {
      props: {
        message: assistant(
          'Safe text\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n',
        ),
      },
    })
    const html = w.find('.markdown-body').html()
    // No trace of either payload: no <script> element, no onerror handler.
    expect(html).not.toContain('script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert(1)')
    expect(w.find('script').exists()).toBe(false)
    expect(w.find('img').attributes('onerror')).toBeUndefined()
    expect(w.text()).toContain('Safe text')
  })

  it('keeps user messages as plain text (no markdown rendering)', () => {
    const w = mount(ChatMessage, {
      props: { message: { id: 'u1', role: 'user', content: '## not a heading\n\n- not a list' } },
    })
    expect(w.find('.markdown-body').exists()).toBe(false)
    expect(w.find('p.content').exists()).toBe(true)
    expect(w.text()).toContain('## not a heading')
    expect(w.find('h2').exists()).toBe(false)
  })
})
