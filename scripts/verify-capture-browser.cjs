const assert = require('node:assert/strict');
const { mkdtemp } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const profile = await mkdtemp(path.join(tmpdir(), 'yor-capture-regression-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true, channel: 'chromium', reducedMotion: 'reduce',
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  const failures = [];
  try {
    await context.route('https://claude.ai/**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html><head><meta charset="utf-8"><style>body{background:#222;color:#eee;font:16px sans-serif} main{padding:20px}form{margin-top:30px} [contenteditable]{min-height:40px;background:#333}</style></head>
      <body><main><header><button data-testid="model-selector">Test model</button></header><div role="feed"></div>
      <form onsubmit="event.preventDefault()"><div class="ProseMirror" contenteditable="true" aria-label="Message"></div><button type="button" aria-label="Send">Send</button></form></main></body></html>` }));
    const page = await context.newPage();
    await page.goto('https://claude.ai/chat/capture-initial');
    await page.locator('[data-ref="pageMeter"]').waitFor();
    const worker = context.serviceWorkers()[0];
    const dashboard = await context.newPage();
    await dashboard.goto(`chrome-extension://${new URL(worker.url()).host}/dashboard/dashboard.html`);
    const snapshot = () => dashboard.evaluate(() => chrome.runtime.sendMessage({ type: 'get-snapshot' }));
    const events = async thread => (await snapshot()).state.usageEvents.filter(e => e.threadId.endsWith(thread));
    const addMessage = async (role, text) => page.evaluate(({role, text}) => {
      const article = document.createElement('article'); article.dataset.testid = `${role}-message`; article.textContent = text;
      document.querySelector('[role="feed"]').append(article);
    }, {role, text});
    const begin = async (thread, history = []) => {
      await page.goto(`https://claude.ai/chat/${thread}`);
      await page.locator('[data-ref="pageMeter"]').waitFor();
      for (const [role, text] of history) await addMessage(role, text);
      await page.locator('[contenteditable]').fill('Capture this submitted prompt.');
      await page.getByRole('button', {name:'Send', exact:true}).click();
      await addMessage('user', 'Capture this submitted prompt.');
      await page.locator('[contenteditable]').fill('');
    };
    const expectCaptured = async (thread, output, count = 1) => {
      const deadline = Date.now() + 6500;
      while (Date.now() < deadline) {
        if ((await events(thread)).some(e => e.outputChars === output.length)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const stored = await events(thread);
      assert.equal(stored.length, count, 'each submitted exchange must be durable exactly once');
      const captured = stored.find(event => event.outputChars === output.length);
      assert.ok(captured, `full response must be captured: expected ${output.length} chars; got ${stored.map(event => event.outputChars)}`);
      assert.equal(captured.totalTokens, captured.promptTokens + captured.outputTokens);
    };
    const check = async (name, fn) => {
      try { await fn(); console.log(`PASS ${name}`); }
      catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
    };
    await check('short answers are captured', async () => {
      await begin('short-answer'); await addMessage('assistant','OK'); await expectCaptured('short-answer','OK');
    });
    await check('long conversations continue capturing beyond the 40-message view', async () => {
      await begin('long-thread', Array.from({length:42}, (_, i) => [i%2 ? 'assistant':'user', `Historical message number ${i}`]));
      await addMessage('assistant','A complete fresh answer.'); await expectCaptured('long-thread','A complete fresh answer.');
    });
    await check('identical responses in different turns are distinct messages', async () => {
      await begin('repeated-answer', [['user','Earlier question'],['assistant','The answer is unchanged.']]);
      await addMessage('assistant','The answer is unchanged.'); await expectCaptured('repeated-answer','The answer is unchanged.');
    });
    await check('stream pauses do not finalize partial answers', async () => {
      await begin('streaming');
      await page.evaluate(() => {
        const stop = document.createElement('button'); stop.setAttribute('aria-label','Stop response'); document.querySelector('main').append(stop);
      });
      await addMessage('assistant','Partial answer that has not finished.');
      // Intentionally outlast the old 1600ms debounce while generation is still active.
      await page.waitForTimeout(2300);
      assert.equal((await events('streaming')).length, 0, 'must not commit during active generation');
      await page.locator('[data-testid="assistant-message"]').evaluate(node => {node.textContent = 'The complete final streamed answer.';});
      await page.getByRole('button',{name:'Stop response'}).evaluate(node => node.remove());
      await expectCaptured('streaming','The complete final streamed answer.');
    });
    await check('navigation cannot attach another chat response to the pending prompt', async () => {
      await begin('departed-chat');
      await page.evaluate(() => history.pushState({}, '', '/chat/different-chat'));
      await addMessage('assistant','An unrelated response in a different conversation.');
      await page.waitForTimeout(2300);
      assert.equal((await events('departed-chat')).length,0,'cross-chat contamination');
    });
    await check('semantic Claude articles exclude headings and action controls', async () => {
      await begin('semantic-articles');
      await page.evaluate(() => {
        const article = document.createElement('article'); article.setAttribute('aria-label','Message 2 of 2');
        article.innerHTML = '<h2>Claude responded: OK</h2><p>OK</p><div role="toolbar"><button>Copy</button><time>just now</time></div>';
        document.querySelector('[role="feed"]').append(article);
      });
      await expectCaptured('semantic-articles','OK');
    });
    await check('first-message URL assignment keeps its capture', async () => {
      await begin('new');
      await page.evaluate(() => history.pushState({}, '', '/chat/created-chat'));
      await addMessage('assistant','First answer in the created conversation.');
      await expectCaptured('created-chat','First answer in the created conversation.');
    });
    await check('replaced conversation roots remain observed', async () => {
      await begin('replaced-root');
      await page.evaluate(() => document.querySelector('main').replaceWith(document.querySelector('main').cloneNode(true)));
      await addMessage('assistant','Answer after the application remounted its main view.');
      await expectCaptured('replaced-root','Answer after the application remounted its main view.');
      await page.locator('[contenteditable]').fill('Second turn after a full view replacement.');
      await page.getByRole('button',{name:'Send',exact:true}).click();
      await addMessage('user','Second turn after a full view replacement.');
      await page.locator('[contenteditable]').fill('');
      await addMessage('assistant','Second captured response.');
      await expectCaptured('replaced-root','Second captured response.',2);
    });
    await dashboard.reload();
    await dashboard.locator('#metrics .metric-card').first().waitFor();
    const capturedSnapshot = await snapshot();
    assert.equal(capturedSnapshot.summary.promptsToday, 8, 'dashboard summary must count all eight completed test exchanges');
    assert.equal(capturedSnapshot.summary.tokensToday, capturedSnapshot.state.usageEvents.reduce((total, event) => total + event.totalTokens, 0));
    assert.equal(await dashboard.locator('#metrics .metric-card').filter({hasText:'Prompts today'}).locator('strong').innerText(), '8', 'rendered dashboard must reflect persisted captures');
    await dashboard.screenshot({path:path.join(profile,'capture-dashboard.png'), fullPage:true});
    console.log(`artifacts=${profile}`);
    assert.deepEqual(failures, [], 'capture regression failures');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
