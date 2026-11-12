// Vector Brain live E2E (Playwright, headless-shell Chromium).
// Journey: open app -> upload quokka PDF -> wait READY -> ask -> honest
// Groq-unconfigured error (no fabricated answer) -> follow-up -> dark mode
// -> reload persistence -> delete doc via UI -> verify gone via API.
const { chromium } = require('/home/hatch/.npm/_npx/411d535eabdf86de/node_modules/playwright');

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000';
const PDF = '/tmp/quokka-propulsion-e2e.pdf';
const DOC = 'quokka-propulsion-e2e.pdf';
const Q1 = 'What is quokka propulsion and what thrust-to-weight ratio does it achieve?';
const Q2 = 'How far did the QuokkaJet rover travel in field trials?';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
  try {
    // 1. Open app
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#app', { timeout: 10000 });
    const title = await page.title();
    check('app loads', title.includes('Vector Brain'), `title="${title}"`);
    await page.waitForSelector('text=Drop PDFs here', { timeout: 15000 });
    check('dropzone visible', true);

    // 2. Upload via UI dropzone file input
    await page.setInputFiles('.dropzone input[type="file"]', PDF);
    const card = page.locator('.doc-card', { hasText: DOC });
    await card.waitFor({ timeout: 20000 });
    check('doc card appears after UI upload', true);
    await page.waitForSelector('.doc-card:has-text("quokka-propulsion-e2e.pdf") >> text=Ready', { timeout: 120000 });
    check('doc reaches READY in UI', true);

    // 3. Select doc for chat, ask Q1
    await page.check('input[aria-label="Select quokka-propulsion-e2e.pdf for chat"]');
    const composer = page.locator('textarea[aria-label="Ask a question about your documents"]');
    await composer.waitFor({ timeout: 10000 });
    const disabled = await composer.isDisabled();
    check('composer enabled once doc READY', !disabled);
    await composer.fill(Q1);
    await page.click('button[type="submit"]:has-text("Send")');

    // 4. Honest Groq-unconfigured state, no fabricated answer
    const errMsg = page.locator('.chat-message, [class*="message"]', { hasText: 'GROQ_API_KEY not configured' });
    await errMsg.first().waitFor({ timeout: 60000 });
    const errText = (await errMsg.first().innerText()).trim();
    check('assistant shows honest Groq-unconfigured error', errText.includes('GROQ_API_KEY not configured'), JSON.stringify(errText.slice(0, 200)));
    check('no fabricated answer text (no 4.2 / thrust ratio in reply)', !errText.includes('4.2') && !/thrust-to-weight ratio of 4\.2/i.test(errText));
    const toast = page.locator('[class*="toast"]', { hasText: 'Chat error' });
    const toastVisible = await toast.first().isVisible().catch(() => false);
    check('error toast shown', toastVisible);

    // 5. Follow-up question -> same honest error
    await composer.fill(Q2);
    await page.click('button[type="submit"]:has-text("Send")');
    await page.waitForFunction(
      () => document.body.innerText.split('GROQ_API_KEY not configured').length - 1 >= 2,
      { timeout: 60000 }
    );
    check('follow-up also gets honest error (2 error messages present)', true);

    // 6. Dark mode toggle + reload persistence
    const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('button[aria-label="Switch to dark theme"]');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 5000 });
    const stored = await page.evaluate(() => localStorage.getItem('vector-brain-theme'));
    check('dark mode toggles (data-theme=dark, localStorage=dark)', stored === 'dark', `before=${themeBefore} stored=${stored}`);
    await page.reload({ waitUntil: 'networkidle' });
    const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const storedAfter = await page.evaluate(() => localStorage.getItem('vector-brain-theme'));
    check('theme persists across reload', themeAfter === 'dark' && storedAfter === 'dark', `after reload data-theme=${themeAfter} stored=${storedAfter}`);
    // restore light for a clean leave-behind
    await page.click('button[aria-label="Switch to light theme"]');
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', { timeout: 5000 });
    check('restored light theme', true);

    // 7. Delete doc via UI + confirm dialog
    await page.click(`button[aria-label="Delete ${DOC}"]`);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.click('[role="dialog"] button:has-text("Delete")');
    await card.waitFor({ state: 'detached', timeout: 15000 });
    check('doc card removed from UI after delete', true);
    const docs = await (await fetch(`${API}/api/documents`)).json();
    const stillThere = (Array.isArray(docs) ? docs : docs.documents || []).some((d) => (d.original_filename || d.filename) === DOC);
    check('doc gone from backend after UI delete', !stillThere, `docs in backend: ${(Array.isArray(docs) ? docs : docs.documents || []).map((d) => d.original_filename).join(', ')}`);

    // 8. Search after UI delete -> no quokka chunks
    const sr = await (await fetch(`${API}/api/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: Q1 }) })).json();
    check('search returns no quokka chunks after UI delete', (sr.results || []).length === 0, `results=${(sr.results || []).length}`);

    await page.screenshot({ path: '/tmp/vb-e2e/final.png', fullPage: true });
  } catch (e) {
    check('journey completed without exception', false, String(e).split('\n').slice(0, 3).join(' | '));
    await page.screenshot({ path: '/tmp/vb-e2e/failure.png', fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} checks passed ====`);
  if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(' -', f.name, f.detail)); process.exit(1); }
})();
