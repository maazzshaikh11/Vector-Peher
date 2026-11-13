import MarkdownIt from 'markdown-it'
import createDOMPurify from 'dompurify'

// markdown-it with raw HTML enabled, because DOMPurify is the sanitizer:
// html:false would escape payloads to visible inert text (the literal
// strings "script"/"onerror" would still appear in the output), while
// html:true + DOMPurify strips <script> entirely and drops event-handler
// attributes, so a malicious payload leaves no trace in the output.
// This is markdown-it's documented pattern for untrusted input.
const md = new MarkdownIt({
  html: true, // raw HTML passed through, then stripped/sanitized by DOMPurify
  breaks: true, // convert \n to <br> inside paragraphs
  linkify: true, // auto-link URLs
})

// DOMPurify needs a window; in jsdom tests `window` is the jsdom window.
const purify =
  typeof window !== 'undefined' ? createDOMPurify(window) : null

/** Render Markdown to sanitized HTML. Safe for streaming partial input:
 *  markdown-it re-renders the whole accumulated string on every call, so
 *  an incomplete fence or list mid-stream just renders as far as it can
 *  and is fixed by the next update — it never breaks the layout. */
export function renderMarkdown(source: string): string {
  const raw = md.render(source ?? '')
  return purify ? purify.sanitize(raw) : raw
}

export function useMarkdown() {
  return { renderMarkdown }
}
