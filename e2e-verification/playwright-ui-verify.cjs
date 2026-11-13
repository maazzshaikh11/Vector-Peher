// Vector Brain UI verification (Playwright, headless-shell Chromium).
// Journey: open app -> upload quokka PDF -> wait READY -> verify the
// NotebookLM-style three-panel layout, auto-summary + suggested chips,
// N-sources indicator -> mock the /api/chat SSE stream (no real Groq key)
// with a structured Markdown answer + cache-hit events -> verify rendered
// headings/bullets/table, numbered citation chips, From-cache badge and
// copy button in the DOM -> dark mode + panel collapse + mobile tabs.
const { chromium } = require('/home/hatch/.npm/_npx/411d535eabdf86de/node_modules/playwright');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000';
const PDF = '/tmp/quokka-propulsion-e2e.pdf';
const DOC = 'quokka-propulsion-e2e.pdf';
const Q1 = 'What is quokka propulsion and what thrust-to-weight ratio does it achieve?';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

function sseEvent(obj) { return `data: ${JSON.stringify(obj)}\n`; }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#app', { timeout: 10000 });
    check('app loads', (await page.title()).includes('Vector Brain'));

    // Upload + READY
    await page.setInputFiles('.dropzone input[type="file"]', PDF);
    const card = page.locator('.doc-card', { hasText: DOC });
    await card.waitFor({ timeout: 20000 });
    await page.waitForSelector('.doc-card:has-text("quokka-propulsion-e2e.pdf") >> text=Ready', { timeout: 120000 });
    check('doc reaches READY in UI', true);

    // Three-panel layout
    check('Sources panel visible', await page.locator('.panel-sources').isVisible());
    check('Chat panel visible', await page.locator('.chat').isVisible());
    check('Details panel visible', await page.locator('.details-panel').isVisible());
    check('composer shows 1 source', (await page.locator('.source-count').innerText()).includes('1 source'));
    await page.locator('.guide-chip').first().waitFor({ timeout: 30000 });
    check('auto-summary guide + suggested chips shown', await page.locator('.notebook-guide').isVisible());

    // Click a source row -> Details panel shows its metadata.
    await card.locator('.doc-info').click();
    await page.waitForFunction(() => document.querySelector('.details-panel')?.innerText.includes('Document'), { timeout: 5000 });
    check('Details panel shows selected document metadata', true);

    // Collapse / reopen the Details panel from the top bar.
    await page.click('.app-header button:has-text("Details")');
    await page.waitForFunction(() => !document.querySelector('.details-panel')?.offsetParent, { timeout: 5000 }).catch(() => {});
    const detailsHidden = await page.evaluate(() => { const el = document.querySelector('.details-panel'); return !el || getComputedStyle(el).display === 'none'; });
    check('Details panel collapses from top bar', detailsHidden);
    await page.click('.app-header button:has-text("Details")');
    await page.waitForFunction(() => { const el = document.querySelector('.details-panel'); return el && getComputedStyle(el).display !== 'none'; }, { timeout: 5000 });
    check('Details panel reopens from top bar', true);

    // Mock the chat SSE stream: sources + cached + structured markdown tokens.
    const structured =
      '## Summary\n\nThe quokka propulsion system delivers:\n\n- thrust-to-weight ratio of 4.2\n- range of 120 km in field trials\n\n| Metric | Value |\n| --- | --- |\n| Thrust-to-weight | 4.2 |\n| Range | 120 km |\n';
    await page.route('**/api/chat', async (route) => {
      const body =
        sseEvent({ type: 'sources', sources: [{ filename: DOC, page_number: 2, chunk_id: 'c1', score: 0.91, document_id: 'd1', content: 'Quokka thrust passage: the rover achieved a thrust-to-weight ratio of 4.2.' }] }) +
        sseEvent({ type: 'cached', cached: true }) +
        sseEvent({ type: 'token', text: structured }) +
        sseEvent({ type: 'done', session_id: 'mock-session' });
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body });
    });

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
    // Click the citation chip -> Details panel shows the passage.
    await answer.locator('.citation').first().click();
    await page.waitForFunction(() => document.querySelector('.details-panel')?.innerText.includes('Citation'), { timeout: 5000 });
    check('clicking a citation opens its passage in Details', (await page.locator('.details-panel').innerText()).includes('Quokka thrust passage'));

    await page.screenshot({ path: '/tmp/vb-e2e/ui-desktop.png', fullPage: false });
    check('desktop screenshot saved', true);

    // Dark mode keeps the layout readable.
    await page.click('button[aria-label="Switch to dark theme"]');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 5000 });
    check('dark mode toggles', true);
    await page.screenshot({ path: '/tmp/vb-e2e/ui-dark.png', fullPage: false });
    await page.click('button[aria-label="Switch to light theme"]');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', { timeout: 5000 });
    check('light mode restored', true);

    // Mobile: panels become switchable tabs.
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
  } catch (e) {
    check('journey completed without exception', false, String(e).split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: '/tmp/vb-e2e/ui-failure.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} checks passed ====`);
  if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(' -', f.name, f.detail)); process.exit(1); }
})();
