import { describe, it, expect, beforeEach } from 'vitest'
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
import DocumentCard from './DocumentCard.vue'
import UploadDropzone from './UploadDropzone.vue'
import { useThemeStore } from '../stores/theme'

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
    await w.trigger('click'); expect(w.emitted('open')?.[0][0]).toEqual(src)
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
