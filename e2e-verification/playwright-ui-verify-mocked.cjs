// Vector Brain UI verification against MOCKED backend APIs (Playwright).
// Used when no PostgreSQL/backend is available in this VM: every /api/*
// call is intercepted, so this verifies the FRONTEND only — layout,
// upload journey at UI level, auto-summary + chips, N-sources, structured
// Markdown rendering, citation chips, From-cache badge, copy, dark mode,
// panel collapse, mobile tabs. It does NOT verify the real backend.
const { chromium } = require('/home/hatch/.npm/_npx/411d535eabdf86de/node_modules/playwright');

const BASE = 'http://localhost:5173';
const PDF = '/tmp/quokka-propulsion-e2e.pdf';
const DOC = 'quokka-propulsion-e2e.pdf';
const Q1 = 'What is quokka propulsion and what thrust-to-weight ratio does it achieve?';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
function sseEvent(obj) { return `data: ${JSON.stringify(obj)}\n`; }

const mockDoc = { id: 'd1', filename: DOC, original_filename: DOC, file_size: 2081, page_count: 2, status: 'PROCESSING' };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });

  // ---- Mock every backend call the UI makes (exact-path matchers) ----
  const path = (p) => (url) => new URL(url).pathname === p;
  await page.route(path('/api/health'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) }));
  await page.route((url) => new URL(url).pathname === '/api/documents' && new URL(url).search === '', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route(path('/api/documents/upload'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([mockDoc]) }));
  await page.route((url) => /^\/api\/documents\/[^/]+\/status$/.test(new URL(url).pathname), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'd1', status: 'READY' }) }));
  await page.route((url) => /^\/api\/documents\/(?!upload$)[^/]+$/.test(new URL(url).pathname), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }));
  await page.route(path('/api/search'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [
    { content: 'Quokka propulsion uses a novel hop-drive mechanism. In bench tests it achieved a thrust-to-weight ratio of 4.2.', filename: DOC, page_number: 1, score: 0.91, chunk_id: 'c1', document_id: 'd1' },
    { content: 'The QuokkaJet rover travelled 120 km across Rottnest Island.', filename: DOC, page_number: 2, score: 0.87, chunk_id: 'c2', document_id: 'd1' },
  ] }) }));
  await page.route(path('/api/chat/sessions'), async (r) => {
    if (r.request().method() === 'POST') return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 's-mock', title: 'New chat' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 's-mock', title: 'New chat' }]) });
  });
  await page.route(path('/api/chat'), async (r) => {
    const structured =
      '## Summary\n\nThe quokka propulsion system delivers:\n\n- thrust-to-weight ratio of 4.2\n- range of 120 km in field trials\n\n| Metric | Value |\n| --- | --- |\n| Thrust-to-weight | 4.2 |\n| Range | 120 km |\n';
    const body =
      sseEvent({ type: 'sources', sources: [{ filename: DOC, page_number: 2, chunk_id: 'c1', score: 0.91, document_id: 'd1', content: 'Quokka thrust passage: the rover achieved a thrust-to-weight ratio of 4.2.' }] }) +
      sseEvent({ type: 'cached', cached: true }) +
      sseEvent({ type: 'token', text: structured }) +
      sseEvent({ type: 'done', session_id: 's-mock' });
    await r.fulfill({ status: 200, contentType: 'text/event-stream', body });
  });

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#app', { timeout: 10000 });
    check('app loads', (await page.title()).includes('Vector Brain'));
    check('health badge shows Backend connected (mocked)', await page.locator('.app-header', { hasText: 'Backend connected' }).isVisible());

    // Upload via the UI dropzone; status polling flips it to READY.
    await page.setInputFiles('.dropzone input[type="file"]', PDF);
    const card = page.locator('.doc-card', { hasText: DOC });
    await card.waitFor({ timeout: 20000 });
    check('doc card appears after UI upload', true);
    await page.waitForSelector('.doc-card:has-text("quokka-propulsion-e2e.pdf") >> text=Ready', { timeout: 30000 });
    check('doc reaches READY in UI', true);

    // Three-panel layout + live counts.
    check('Sources panel visible', await page.locator('.panel-sources').isVisible());
    check('Chat panel visible', await page.locator('.chat').isVisible());
    check('Details panel visible', await page.locator('.details-panel').isVisible());
    check('Details panel shows chat history', await page.locator('.details-panel', { hasText: 'Chat history' }).isVisible());
    check('composer shows 1 source', (await page.locator('.source-count').innerText()).includes('1 source'));

    // Auto-summary (extractive, from mocked search chunks) + suggested chips.
    await page.locator('.guide-chip').first().waitFor({ timeout: 30000 });
    check('suggested-question chip appears after READY', (await page.locator('.guide-chip').first().innerText()).length > 0);
    await page.waitForFunction(() => document.body.innerText.includes('thrust-to-weight ratio of 4.2'), { timeout: 30000 });
    check('auto-summary quotes a retrieved chunk verbatim', true);

    // Unchecking the only source drops the count to 0 and disables asking.
    await page.uncheck('input[aria-label="Select quokka-propulsion-e2e.pdf for chat"]');
    await page.waitForFunction(() => document.querySelector('.source-count')?.textContent.includes('0 sources'), { timeout: 5000 });
    check('unchecking updates N sources to 0', true);
    check('composer disables with 0 sources in scope', await page.locator('textarea[aria-label="Ask a question about your documents"]').isDisabled());
    await page.check('input[aria-label="Select quokka-propulsion-e2e.pdf for chat"]');
    await page.waitForFunction(() => !document.querySelector('textarea[aria-label="Ask a question about your documents"]').disabled, { timeout: 5000 });
    check('re-checking re-enables the composer', true);

    // Row click -> Details metadata.
    await card.locator('.doc-info').click();
    await page.waitForFunction(() => document.querySelector('.details-panel')?.innerText.includes('Document'), { timeout: 5000 });
    check('Details panel shows selected document metadata', true);

    // Collapse / reopen the Details panel from the top bar.
    await page.click('.app-header button:has-text("Details")');
    await page.waitForFunction(() => { const el = document.querySelector('.details-panel'); return !el || getComputedStyle(el).display === 'none'; }, { timeout: 5000 });
    check('Details panel collapses from top bar', true);
    await page.click('.app-header button:has-text("Details")');
    await page.waitForFunction(() => { const el = document.querySelector('.details-panel'); return el && getComputedStyle(el).display !== 'none'; }, { timeout: 5000 });
    check('Details panel reopens from top bar', true);

    // Ask a question: mocked SSE carries sources + cached + structured tokens.
    const composer = page.locator('textarea[aria-label="Ask a question about your documents"]');
    await composer.fill(Q1);
    await page.click('button[type="submit"]:has-text("Send")');
    const answer = page.locator('.message-assistant').last();
    await answer.locator('.markdown-body h2').waitFor({ timeout: 15000 });
    check('structured answer renders an h2 in the DOM', (await answer.locator('.markdown-body h2').innerText()) === 'Summary');
    check('structured answer renders bullets', (await answer.locator('.markdown-body li').count()) === 2);
    check('structured answer renders a table', await answer.locator('.markdown-body table').isVisible());
    check('numbered citation chip [1] renders', (await answer.locator('.citation-num').first().innerText()).includes('[1]'));
    check('From cache badge renders on a cache hit', await answer.locator('.cache-badge').isVisible());
    check('copy button renders under the AI reply', await answer.locator('button[aria-label="Copy answer"]').isVisible());
    check('citation hover preview holds the passage text', (await answer.locator('.citation-preview').first().textContent())?.includes('Quokka thrust passage') ?? false);
    await answer.locator('.citation').first().click();
    await page.waitForFunction(() => document.querySelector('.details-panel')?.innerText.includes('Citation'), { timeout: 5000 });
    check('clicking a citation opens its passage in Details', (await page.locator('.details-panel').innerText()).includes('Quokka thrust passage'));

    await page.screenshot({ path: '/tmp/vb-e2e/ui-desktop.png' });
    check('desktop screenshot saved', true);

    // Dark mode.
    await page.click('button[aria-label="Switch to dark theme"]');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 5000 });
    check('dark mode toggles', true);
    await page.screenshot({ path: '/tmp/vb-e2e/ui-dark.png' });
    await page.click('button[aria-label="Switch to light theme"]');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', { timeout: 5000 });
    check('light mode restored', true);

    // Mobile tabs.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.mobile-tabs')).display !== 'none', { timeout: 5000 });
    check('mobile tab bar appears on small screens', true);
    await page.click('.mobile-tabs button:has-text("Sources")');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.panel-sources')).display !== 'none', { timeout: 5000 });
    check('Sources tab opens the sources overlay', true);
    await page.screenshot({ path: '/tmp/vb-e2e/ui-mobile-sources.png' });
    await page.click('.mobile-tabs button:has-text("Chat")');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.panel-sources')).display === 'none', { timeout: 5000 });
    check('Chat tab returns to chat', true);
    await page.screenshot({ path: '/tmp/vb-e2e/ui-mobile-chat.png' });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Delete via UI (row actions reveal on hover).
    await card.hover();
    await page.click(`button[aria-label="Delete ${DOC}"]`);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.click('[role="dialog"] button:has-text("Delete")');
    await card.waitFor({ state: 'detached', timeout: 15000 });
    check('doc card removed from UI after delete', true);
    check('composer shows 0 sources after delete', (await page.locator('.source-count').innerText()).includes('0 sources'));
  } catch (e) {
    check('journey completed without exception', false, String(e).split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: '/tmp/vb-e2e/ui-mocked-failure.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} checks passed ====`);
  if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(' -', f.name, f.detail)); process.exit(1); }
})();
