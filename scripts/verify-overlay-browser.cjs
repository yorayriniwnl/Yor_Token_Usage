// Run with Playwright installed (or available through NODE_PATH).
// Provider HTML is a deterministic fixture; the extension and service worker are real.
const assert = require('node:assert/strict');
const { mkdtemp } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const profile = await mkdtemp(path.join(tmpdir(), 'yor-overlay-regression-'));
  const browserOptions = {
    headless: process.env.YOR_TEST_HEADLESS !== 'false', channel: 'chromium', viewport: { width: 1047, height: 760 }, reducedMotion: process.env.YOR_TEST_MOTION === 'normal' ? 'no-preference' : 'reduce',
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  };
  if (process.env.YOR_CHROME_PATH) {
    delete browserOptions.channel;
    browserOptions.executablePath = process.env.YOR_CHROME_PATH;
  }
  const context = await chromium.launchPersistentContext(profile, browserOptions);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://claude.ai' });
  const errors = [];
  try {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await context.route('https://claude.ai/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html><head><meta charset="utf-8"><title>YOR regression fixture — not live Claude</title><style>
      *{box-sizing:border-box}body{background:#171717;color:#dedbd4;font:16px system-ui;margin:0}
      main{padding:28px}article{max-width:720px;margin:20px 0;padding:12px;background:#242424;border-radius:12px}
      form{position:fixed;bottom:24px;left:16px;right:16px;border:1px solid #555;border-radius:22px;background:#222;padding:16px}
      .ProseMirror{min-height:38px;outline:none}.ProseMirror:empty:before{content:'Write a message…';color:#999}
      footer{display:flex;justify-content:space-between;margin-top:16px;color:#999;font-size:14px}
      button{background:#333;color:#eee;border:0;padding:8px;border-radius:8px}
      </style></head><body><main><h2>Controlled composer regression</h2>
      <article data-testid="user-message">Explain why an appointment in 11 hours is not a quota signal.</article>
      <article data-testid="assistant-message">Conversation text: 12 messages remaining and 80% remaining must not be scraped as account data.</article>
      <form onsubmit="event.preventDefault()"><div><div class="ProseMirror" contenteditable="true" aria-label="Message"></div></div>
      <footer><span>Session estimate</span><span>Reset in: 2h 32m · Messages left: 1595.4</span><button aria-label="Send">Send</button></footer></form>
      </main></body></html>` }));
    await page.goto('https://claude.ai/chat/yor-regression');
    console.log(`extension-workers=${context.serviceWorkers().map(worker => worker.url()).join(',') || 'none'}`);
    if (errors.length) console.log(`page-errors=${errors.join(' | ')}`);
    const ref = name => page.locator(`[data-ref="${name}"]`);
    await ref('pageMeter').waitFor({ state: 'visible' });
    assert.equal(await ref('meterPercent').innerText(), 'Unknown');
    assert.equal(await ref('meterReset').innerText(), 'Unknown');
    assert.notEqual(await ref('meterTokens').innerText(), '0');
    const nonOverlap = async name => {
      // Resize events and layout are delivered on the next animation frame.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const widget = await ref(name).boundingBox();
      const composer = await page.locator('form').boundingBox();
      const style = await ref(name).evaluate(node => ({ css: node.style.cssText, placement: node.dataset.placement, position: getComputedStyle(node).position }));
      assert.notEqual(style.placement, 'hidden', `${name} must remain usable when space is available`);
      assert.ok(widget && composer);
      assert.ok(widget.y + widget.height <= composer.y || widget.y >= composer.y + composer.height, `${name} overlaps composer: ${JSON.stringify({ widget, composer, style })}`);
      const viewport = page.viewportSize();
      assert.ok(widget.x >= 0 && widget.y >= 0 && widget.x + widget.width <= viewport.width && widget.y + widget.height <= viewport.height, `${name} exceeds viewport`);
    };
    await nonOverlap('pageMeter');
    const initialTokens = await ref('meterTokens').innerText();
    await page.locator('[contenteditable]').fill('A new draft that should increase the visible token estimate without claiming any provider credits.');
    await page.waitForFunction(initial => document.querySelector('.yor-token-usage-root').shadowRoot.querySelector('[data-ref="meterTokens"]').textContent !== initial, initialTokens);
    await ref('pageMeter').click();
    await ref('card').waitFor({ state: 'visible' });
    await nonOverlap('card');
    await ref('copyShorterButton').scrollIntoViewIfNeeded();
    assert.ok(await ref('copyShorterButton').isVisible(), 'expanded panel actions must be reachable');
    const sourceDraft = 'First line.\n\n\n\nSecond line.';
    await page.locator('[contenteditable]').fill(sourceDraft);
    const composerBeforeCopy = await page.locator('[contenteditable]').innerText();
    await ref('copyShorterButton').click();
    await page.waitForFunction(() => document.querySelector('.yor-token-usage-root').shadowRoot.querySelector('[data-ref="copyShorterStatus"]').textContent !== '');
    assert.equal(await ref('copyShorterStatus').innerText(), 'Shorter prompt copied; original unchanged.');
    await nonOverlap('card');
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(clipboardText.replace(/\r\n/g, '\n'), 'First line.\n\n\nSecond line.');
    assert.equal(await page.locator('[contenteditable]').innerText(), composerBeforeCopy, 'copying must not modify the composer');
    await page.locator('[contenteditable]').fill('One line with no redundant whitespace.');
    await ref('copyShorterButton').click();
    await page.waitForFunction(() => document.querySelector('.yor-token-usage-root').shadowRoot.querySelector('[data-ref="copyShorterStatus"]').textContent === 'No shorter version available.');
    assert.equal(await ref('copyShorterStatus').innerText(), 'No shorter version available.');
    await nonOverlap('card');
    await ref('toggleButton').scrollIntoViewIfNeeded();
    assert.match(await ref('quickCost').innerText(), /unavailable/);
    await page.screenshot({ path: path.join(profile, 'overlay-details.png') });
    await ref('toggleButton').click();
    const screenshot = path.join(profile, 'overlay-desktop.png');
    await page.screenshot({ path: screenshot });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 740 });
      await nonOverlap('pageMeter');
      await ref('pageMeter').click();
      await nonOverlap('card');
      await ref('toggleButton').click();
    }
    await page.screenshot({ path: path.join(profile, 'overlay-mobile.png') });
    await page.setViewportSize({ width: 1047, height: 760 });
    await page.evaluate(() => {
      const alert = document.createElement('div'); alert.setAttribute('role', 'alert');
      alert.textContent = 'You have reached your usage limit. Resets in 2h 32m.';
      document.querySelector('main').prepend(alert);
    });
    await page.waitForFunction(() => document.querySelector('.yor-token-usage-root').shadowRoot.querySelector('[data-ref="meterReset"]').textContent.startsWith('~2h'));
    await page.evaluate(() => {
      document.querySelector('[role="alert"]').remove();
      document.querySelectorAll('article').forEach(node => node.remove());
      document.querySelector('[contenteditable]').textContent = '';
    });
    await page.waitForFunction(() => document.querySelector('.yor-token-usage-root').shadowRoot.querySelector('[data-ref="meterTokens"]').textContent === 'Not detected');
    assert.equal(await ref('meterReset').innerText(), 'Unknown');
    const worker = context.serviceWorkers()[0];
    assert.ok(worker, 'real extension service worker must load');
    const extensionId = new URL(worker.url()).host;
    const settings = await context.newPage();
    settings.on('pageerror', error => errors.push(String(error)));
    await settings.goto(`chrome-extension://${extensionId}/settings/settings.html`);
    await settings.locator('.site-card[data-site="claude"]').waitFor();
    await settings.locator('#save-btn').click();
    const getRule = () => settings.evaluate(async () => (await chrome.runtime.sendMessage({type:'get-snapshot'})).state.preferences.sites.claude.resetRule);
    assert.equal((await getRule()).inferred, true, 'saving unrelated settings must not authorize guessed schedules');
    await settings.locator('.site-card[data-site="claude"] [data-key="resetKind"]').selectOption('daily');
    await settings.locator('.site-card[data-site="claude"] [data-key="anchorLocalTime"]').fill('09:15');
    await settings.locator('#save-btn').click();
    await settings.waitForFunction(async () => (await chrome.runtime.sendMessage({type:'get-snapshot'})).state.preferences.sites.claude.resetRule.inferred === false);
    assert.equal((await getRule()).anchorLocalTime, '09:15');
    await page.reload();
    await ref('pageMeter').waitFor({ state: 'visible' });
    assert.match(await ref('meterReset').innerText(), /^~/, 'custom settings must survive storage and reach the content script');
    assert.deepEqual(errors, [], 'browser runtime errors');
    console.log(`overlay-browser-check=pass (real unpacked extension; mocked provider page)\nartifacts=${profile}`);
  } finally {
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
