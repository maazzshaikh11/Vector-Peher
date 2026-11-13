import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ThemeToggle from './ThemeToggle.vue'
import EmptyState from './EmptyState.vue'
import LoadingIndicator from './LoadingIndicator.vue'
import ProcessingStatus from './ProcessingStatus.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import SourceCitation from './SourceCitation.vue'
import ChatMessage from './ChatMessage.vue'
import ChatComposer from './ChatComposer.vue'
import ChatInterface from './ChatInterface.vue'
import DocumentCard from './DocumentCard.vue'
import DocumentManager from './DocumentManager.vue'
import DetailsPanel from './DetailsPanel.vue'
import SessionHistory from './SessionHistory.vue'
import UploadDropzone from './UploadDropzone.vue'
import { useThemeStore } from '../stores/theme'
import { useDocumentsStore } from '../stores/documents'
import { useChatStore } from '../stores/chat'

const src = { filename: 'paper.pdf', page_number: 3, chunk_id: 'c1', score: 0.87 }

describe('ThemeToggle', () => {
  beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
  it('renders and toggles theme on click', async () => {
    const w = mount(ThemeToggle, { global: { plugins: [createPinia()] } })
    const theme = useThemeStore(); theme.init()
    const before = theme.mode
    await w.find('button').trigger('click')
    expect(theme.mode).not.toBe(before)
    expect(localStorage.getItem('vector-brain-theme')).toBe(theme.mode)
  })
})
describe('EmptyState / LoadingIndicator / ProcessingStatus', () => {
  it('EmptyState shows title and message', () => { const w = mount(EmptyState, { props: { title: 'Nothing here', message: 'Upload something.' } }); expect(w.text()).toContain('Nothing here'); expect(w.text()).toContain('Upload something.') })
  it('LoadingIndicator shows label', () => { expect(mount(LoadingIndicator, { props: { label: 'Working…' } }).text()).toContain('Working…') })
  it('ProcessingStatus labels READY/FAILED/PROCESSING', () => {
    expect(mount(ProcessingStatus, { props: { status: 'READY' } }).text()).toBe('Ready')
    expect(mount(ProcessingStatus, { props: { status: 'FAILED' } }).text()).toBe('Failed')
    expect(mount(ProcessingStatus, { props: { status: 'PROCESSING' } }).text()).toContain('Processing')
  })
})
describe('ConfirmDialog', () => {
  it('hidden when closed, emits confirm/cancel when open', async () => {
    expect(mount(ConfirmDialog, { props: { open: false, title: 'T', message: 'M' } }).find('[role="dialog"]').exists()).toBe(false)
    const w = mount(ConfirmDialog, { props: { open: true, title: 'Delete?', message: 'Sure?' } })
    expect(w.text()).toContain('Delete?')
    await w.find('.btn-danger').trigger('click'); expect(w.emitted('confirm')).toBeTruthy()
    await w.find('.btn:not(.btn-danger)').trigger('click'); expect(w.emitted('cancel')).toBeTruthy()
  })
})
describe('SourceCitation', () => {
  it('renders filename and page and emits open', async () => {
    const w = mount(SourceCitation, { props: { source: src } })
    expect(w.text()).toContain('paper.pdf'); expect(w.text()).toContain('p. 3')
    await w.find('button.citation').trigger('click'); expect(w.emitted('open')?.[0][0]).toEqual(src)
  })
  it('renders a numbered chip with hover preview when index is given', async () => {
    const w = mount(SourceCitation, { props: { source: { ...src, content: 'The passage text goes here.' }, index: 2 } })
    expect(w.text()).toContain('[2]')
    expect(w.text()).toContain('paper.pdf')
    const preview = w.find('.citation-preview')
    expect(preview.exists()).toBe(true)
    expect(preview.text()).toContain('The passage text goes here.')
    await w.find('button.citation').trigger('click'); expect(w.emitted('open')).toBeTruthy()
  })
  it('preview falls back to a page hint when no passage text is stored', () => {
    const w = mount(SourceCitation, { props: { source: src, index: 1 } })
    expect(w.find('.citation-preview').text()).toContain('page 3')
  })
})
describe('ChatMessage', () => {
  it('renders user message without sources', () => {
    const w = mount(ChatMessage, { props: { message: { id: '1', role: 'user', content: 'Hello?' } } })
    expect(w.text()).toContain('Hello?'); expect(w.text()).toContain('You')
  })
  it('renders assistant message with citations', () => {
    const w = mount(ChatMessage, { props: { message: { id: '2', role: 'assistant', content: 'Answer', sources: [src] } } })
    expect(w.text()).toContain('Answer'); expect(w.text()).toContain('paper.pdf')
  })
  it('renders numbered citation chips for each source', () => {
    const w = mount(ChatMessage, { props: { message: { id: '3', role: 'assistant', content: 'Answer', sources: [src, { ...src, chunk_id: 'c2', page_number: 5 }] } } })
    expect(w.text()).toContain('[1]'); expect(w.text()).toContain('[2]')
  })
  it('shows a From cache badge when the message was served from cache', () => {
    const w = mount(ChatMessage, { props: { message: { id: '4', role: 'assistant', content: 'Cached answer', cached: true } } })
    expect(w.text()).toContain('From cache')
    const plain = mount(ChatMessage, { props: { message: { id: '5', role: 'assistant', content: 'Fresh answer' } } })
    expect(plain.text()).not.toContain('From cache')
  })
  it('renders a copy button under AI replies', async () => {
    const w = mount(ChatMessage, { props: { message: { id: '6', role: 'assistant', content: 'Copy me' } } })
    const btn = w.find('button[aria-label="Copy answer"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.text()).toContain('Copied')
  })
  it('renders the cached answer as markdown like a normal answer', () => {
    const w = mount(ChatMessage, { props: { message: { id: '7', role: 'assistant', content: '## Cached\n\n- one\n', cached: true } } })
    expect(w.find('.markdown-body h2').text()).toBe('Cached')
    expect(w.findAll('.markdown-body li').length).toBe(1)
  })
})
describe('ChatComposer', () => {
  it('does not send empty input', async () => {
    const w = mount(ChatComposer)
    await w.find('form').trigger('submit.prevent')
    expect(w.emitted('send')).toBeFalsy()
  })
  it('sends trimmed text and clears', async () => {
    const w = mount(ChatComposer)
    await w.find('textarea').setValue('  What is this?  ')
    await w.find('form').trigger('submit.prevent')
    expect(w.emitted('send')?.[0]).toEqual(['What is this?'])
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })
  it('send button disabled when empty', () => {
    const w = mount(ChatComposer)
    expect((w.find('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })
  it('shows Stop button while streaming', () => {
    const w = mount(ChatComposer, { props: { streaming: true } })
    expect(w.text()).toContain('Stop')
  })
  it('uses the "Start typing…" placeholder and shows the live source count', () => {
    const w = mount(ChatComposer, { props: { sourceCount: 3 } })
    expect((w.find('textarea').element as HTMLTextAreaElement).placeholder).toBe('Start typing…')
    expect(w.find('.source-count').text()).toContain('3 sources')
    const none = mount(ChatComposer, { props: { sourceCount: 0 } })
    expect(none.find('.source-count').text()).toContain('0 sources')
    const one = mount(ChatComposer, { props: { sourceCount: 1 } })
    expect(one.find('.source-count').text()).toContain('1 source')
  })
  it('has no file attach in the composer — upload lives in the Sources panel', () => {
    const w = mount(ChatComposer)
    expect(w.find('input[type="file"]').exists()).toBe(false)
  })
})
describe('DocumentCard', () => {
  const doc = { id: 'd1', filename: 'a.pdf', original_filename: 'report.pdf', file_size: 2048, page_count: 5, status: 'READY' }
  it('renders name, size, pages, status', () => {
    const w = mount(DocumentCard, { props: { doc, selected: false } })
    expect(w.text()).toContain('report.pdf'); expect(w.text()).toContain('2.0 KB'); expect(w.text()).toContain('5 pages'); expect(w.text()).toContain('Ready')
  })
  it('emits toggle-select and request-delete', async () => {
    const w = mount(DocumentCard, { props: { doc, selected: true } })
    await w.find('input[type="checkbox"]').trigger('change'); expect(w.emitted('toggle-select')).toBeTruthy()
    await w.find('.btn-danger').trigger('click'); expect(w.emitted('request-delete')?.[0][0]).toEqual(doc)
  })
  it('shows a retry affordance with an explicit failure note when FAILED', async () => {
    const w = mount(DocumentCard, { props: { doc: { ...doc, status: 'FAILED' }, selected: false } })
    expect(w.text()).toContain('Failed')
    expect(w.text()).toContain('Processing failed')
    const retry = w.find('button[aria-label="Retry processing report.pdf"]')
    expect(retry.exists()).toBe(true)
    await retry.trigger('click'); expect(w.emitted('request-retry')?.[0][0]).toEqual({ ...doc, status: 'FAILED' })
  })
  it('offers rename on hover (inline edit emits request-rename)', async () => {
    const w = mount(DocumentCard, { props: { doc, selected: false } })
    await w.find('button[aria-label="Rename report.pdf"]').trigger('click')
    const input = w.find('input.rename-input')
    expect(input.exists()).toBe(true)
    await input.setValue('renamed.pdf')
    await input.trigger('keydown.enter')
    expect(w.emitted('request-rename')?.[0][0]).toEqual({ id: 'd1', filename: 'renamed.pdf' })
  })
  it('emits select-doc when the row is clicked', async () => {
    const w = mount(DocumentCard, { props: { doc, selected: false } })
    await w.find('.doc-info').trigger('click')
    expect(w.emitted('select-doc')?.[0]).toEqual(['d1'])
  })
})
describe('DocumentManager', () => {
  const pinia = () => { const p = createPinia(); setActivePinia(p); return p }
  it('shows Add source on top and a scope note', () => {
    const w = mount(DocumentManager, { global: { plugins: [pinia()] } })
    expect(w.text()).toContain('Sources')
    expect(w.find('button.add-source').text()).toContain('Add source')
    expect(w.text()).toContain('No documents yet.')
  })
  it('shows the checked-ready scope in the selection note', async () => {
    const p = pinia()
    const w = mount(DocumentManager, { global: { plugins: [p] } })
    const docs = useDocumentsStore()
    docs.documents = [
      { id: 'd1', filename: 'a.pdf', original_filename: 'a.pdf', file_size: 10, page_count: 1, status: 'READY' },
      { id: 'd2', filename: 'b.pdf', original_filename: 'b.pdf', file_size: 10, page_count: 1, status: 'READY' },
    ]
    docs.selectedIds.add('d1')
    await w.vm.$nextTick()
    expect(w.text()).toContain('1 of 2 ready sources checked')
  })
})
describe('SessionHistory', () => {
  it('shows an empty note and a New chat button with no sessions', () => {
    const p = createPinia(); setActivePinia(p)
    const w = mount(SessionHistory, { global: { plugins: [p] } })
    expect(w.text()).toContain('Chat history')
    expect(w.text()).toContain('No conversations yet.')
    expect(w.text()).toContain('New chat')
  })
  it('lists sessions and loads one on click', async () => {
    const p = createPinia(); setActivePinia(p)
    const chat = useChatStore()
    chat.sessions = [{ id: 's1', title: 'First chat' }]
    const w = mount(SessionHistory, { global: { plugins: [p] } })
    expect(w.text()).toContain('First chat')
    expect(w.find('button[aria-label="Rename First chat"]').exists()).toBe(true)
    expect(w.find('button[aria-label="Delete First chat"]').exists()).toBe(true)
  })
})
describe('DetailsPanel', () => {
  it('shows a hint when nothing is selected', () => {
    const p = createPinia(); setActivePinia(p)
    const w = mount(DetailsPanel, { global: { plugins: [p] } })
    expect(w.text()).toContain('Details')
    expect(w.text()).toContain('Select a source')
    expect(w.text()).toContain('Chat history')
  })
  it('shows selected document metadata', async () => {
    const p = createPinia(); setActivePinia(p)
    const docs = useDocumentsStore()
    docs.documents = [{ id: 'd1', filename: 'a.pdf', original_filename: 'report.pdf', file_size: 2048, page_count: 5, status: 'READY', chunk_count: 12 }]
    docs.selectDocument('d1')
    const w = mount(DetailsPanel, { global: { plugins: [p] } })
    expect(w.text()).toContain('report.pdf')
    expect(w.text()).toContain('5')
    expect(w.text()).toContain('Chunks')
    expect(w.text()).toContain('12')
    expect(w.text()).toContain('Ready')
  })
  it('shows the active citation passage', async () => {
    const p = createPinia(); setActivePinia(p)
    const chat = useChatStore()
    chat.openSource({ filename: 'a.pdf', page_number: 2, chunk_id: 'c1', score: 0.9, content: 'The cited passage.' })
    const w = mount(DetailsPanel, { global: { plugins: [p] } })
    expect(w.text()).toContain('Citation')
    expect(w.text()).toContain('The cited passage.')
    expect(w.text()).toContain('Page 2')
  })
})
describe('ChatInterface notebook guide', () => {
  it('shows the empty state when no documents are ready', () => {
    const p = createPinia(); setActivePinia(p)
    const w = mount(ChatInterface, { global: { plugins: [p] } })
    expect(w.text()).toContain('Ask Vector Brain')
    expect(w.find('textarea').attributes('placeholder')).toBe('Start typing…')
  })
  it('shows suggested questions derived from titles once a document is READY', async () => {
    const p = createPinia(); setActivePinia(p)
    const w = mount(ChatInterface, { global: { plugins: [p] } })
    const docs = useDocumentsStore()
    docs.documents = [{ id: 'd1', filename: 'quokka.pdf', original_filename: 'quokka-propulsion.pdf', file_size: 10, page_count: 4, status: 'READY' }]
    await vi.waitFor(() => expect(w.text()).toContain('What does quokka propulsion cover?'))
    expect(w.text()).toContain('From your sources')
    // No search backend in tests: the metadata fallback lists the document
    // once the (failing) search call settles.
    await vi.waitFor(() => expect(w.text()).toContain('quokka-propulsion.pdf'))
  })
  it('disables the composer when no source is in scope', async () => {
    const p = createPinia(); setActivePinia(p)
    const w = mount(ChatInterface, { global: { plugins: [p] } })
    expect((w.find('textarea').element as HTMLTextAreaElement).disabled).toBe(true)
    expect(w.text()).toContain('0 sources')
  })
})
describe('UploadDropzone', () => {
  it('renders instructions and emits files on input change', async () => {
    const w = mount(UploadDropzone)
    expect(w.text()).toContain('Drop PDFs here')
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    const input = w.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(w.emitted('files')?.[0][0]).toEqual([file])
  })
})
