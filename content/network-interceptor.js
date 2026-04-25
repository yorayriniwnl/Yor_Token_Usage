// Yor Token Usage — Network Interceptor
// Runs in MAIN world (page context). Wraps fetch + XHR to read real token
// counts and rate-limit headers from AI API responses, then dispatches them
// to the isolated-world content script via CustomEvent.
(function () {
  'use strict';

  // ─── URL matchers ────────────────────────────────────────────────────────────

  const PATTERNS = {
    claude: [
      /\/api\/organizations\/[^/]+.*\/completion/,
      /\/api\/append_message/,
      /\/api\/chat_message/,
    ],
    chatgpt: [
      /\/backend-api\/conversation/,
      /\/v1\/chat\/completions/,
    ],
    gemini: [
      /gemini\.google\.com.*streamGenerateContent/,
      /generativelanguage\.googleapis\.com.*generateContent/,
    ],
    grok: [
      /\/rest\/app-chat\/conversations\/[^/]+\/responses/,
      /\/2\/grok\/add_response/,
      /api\.x\.com.*grok/,
    ],
    perplexity: [
      /perplexity\.ai\/socket\.io/,
      /perplexity\.ai\/api\/ask/,
      /perplexity\.ai\/search/,
    ],
  };

  function detectSite(url) {
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) return 'chatgpt';
    if (url.includes('gemini.google.com') || url.includes('generativelanguage.googleapis.com')) return 'gemini';
    if (url.includes('grok.com') || (url.includes('x.com') && url.includes('grok'))) return 'grok';
    if (url.includes('perplexity.ai')) return 'perplexity';
    return null;
  }

  function isAIApiCall(url, site) {
    const list = PATTERNS[site];
    if (!list) return false;
    return list.some((re) => re.test(url));
  }

  // ─── Header parsing ──────────────────────────────────────────────────────────

  function parseRateLimitHeaders(headers) {
    const out = {};
    // Anthropic
    const aTokensLeft = headers.get('anthropic-ratelimit-tokens-remaining');
    const aTokensReset = headers.get('anthropic-ratelimit-tokens-reset');
    const aReqLeft = headers.get('anthropic-ratelimit-requests-remaining');
    if (aTokensLeft != null) out.rateLimitTokensRemaining = parseInt(aTokensLeft, 10);
    if (aTokensReset) { const t = new Date(aTokensReset).getTime(); if (!isNaN(t)) out.rateLimitResetAt = t; }
    if (aReqLeft != null) out.rateLimitRequestsRemaining = parseInt(aReqLeft, 10);
    // OpenAI
    const oTokensLeft = headers.get('x-ratelimit-remaining-tokens');
    const oReset = headers.get('x-ratelimit-reset-tokens');
    if (oTokensLeft != null) out.rateLimitTokensRemaining = parseInt(oTokensLeft, 10);
    if (oReset) out.rateLimitResetDelta = oReset;
    // Model
    const model = headers.get('anthropic-model') || headers.get('x-model');
    if (model) out.detectedModel = model;
    return out;
  }

  // ─── SSE stream parser ───────────────────────────────────────────────────────

  async function parseSseStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let inputTokens = 0, outputTokens = 0;
    let cacheRead = 0, cacheCreate = 0;
    let model = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const ev = JSON.parse(raw);
            // ── Claude SSE ──
            if (ev.type === 'message_start' && ev.message?.usage) {
              inputTokens = ev.message.usage.input_tokens ?? 0;
              cacheRead = ev.message.usage.cache_read_input_tokens ?? 0;
              cacheCreate = ev.message.usage.cache_creation_input_tokens ?? 0;
              if (ev.message.model) model = ev.message.model;
            }
            if (ev.type === 'message_delta' && ev.usage) {
              outputTokens = ev.usage.output_tokens ?? 0;
            }
            // ── OpenAI SSE (stream_options: {include_usage: true}) ──
            if (ev.usage && typeof ev.usage.prompt_tokens === 'number') {
              inputTokens = ev.usage.prompt_tokens;
              outputTokens = ev.usage.completion_tokens ?? 0;
              cacheRead = ev.usage.prompt_tokens_details?.cached_tokens ?? 0;
            }
            if (ev.model && !model) model = ev.model;
          } catch { /* not JSON */ }
        }
      }
    } catch { /* stream closed */ } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
    }

    if (inputTokens > 0 || outputTokens > 0) {
      return { inputTokens, outputTokens, cacheRead, cacheCreate, model, accuracy: 'exact' };
    }
    return null;
  }

  // ─── JSON body parser (non-streaming) ───────────────────────────────────────

  function parseJsonBody(text) {
    try {
      const parsed = JSON.parse(text);
      // Gemini
      if (parsed.usageMetadata) {
        return {
          inputTokens: parsed.usageMetadata.promptTokenCount ?? 0,
          outputTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
          cacheRead: parsed.usageMetadata.cachedContentTokenCount ?? 0,
          cacheCreate: 0,
          model: parsed.modelVersion || null,
          accuracy: 'exact',
        };
      }
      // OpenAI non-streaming
      if (parsed.object === 'chat.completion' && parsed.usage) {
        return {
          inputTokens: parsed.usage.prompt_tokens ?? 0,
          outputTokens: parsed.usage.completion_tokens ?? 0,
          cacheRead: parsed.usage.prompt_tokens_details?.cached_tokens ?? 0,
          cacheCreate: 0,
          model: parsed.model || null,
          accuracy: 'exact',
        };
      }
      // Claude non-streaming
      if (parsed.type === 'message' && parsed.usage) {
        return {
          inputTokens: parsed.usage.input_tokens ?? 0,
          outputTokens: parsed.usage.output_tokens ?? 0,
          cacheRead: parsed.usage.cache_read_input_tokens ?? 0,
          cacheCreate: parsed.usage.cache_creation_input_tokens ?? 0,
          model: parsed.model || null,
          accuracy: 'exact',
        };
      }
    } catch { /* not JSON or unexpected shape */ }
    return null;
  }

  // ─── Dispatch helper ─────────────────────────────────────────────────────────

  function emit(site, url, tokenData, headers, requestBody) {
    if (!tokenData && Object.keys(headers).length === 0) return;
    window.dispatchEvent(new CustomEvent('YOR_NETWORK_TOKENS', {
      detail: { site, url, tokenData, headers, requestBody, timestamp: Date.now() },
    }));
  }

  // Try to read request body for model info when headers don't have it
  function tryParseRequestModel(body) {
    try {
      if (typeof body === 'string') {
        const parsed = JSON.parse(body);
        return parsed.model || null;
      }
    } catch { /* ignore */ }
    return null;
  }

  // ─── fetch() wrapper ─────────────────────────────────────────────────────────

  const _fetch = window.fetch.bind(window);

  window.fetch = async function yorFetch(input, init) {
    const url = typeof input === 'string' ? input
      : input instanceof URL ? input.href
      : (input && input.url) ? input.url : String(input);

    const site = detectSite(url);
    if (!site || !isAIApiCall(url, site)) return _fetch(input, init);

    const requestModel = tryParseRequestModel(init?.body);
    let response;
    try {
      response = await _fetch(input, init);
    } catch (err) {
      throw err;
    }

    if (!response.ok || !response.body) return response;

    const rlHeaders = parseRateLimitHeaders(response.headers);
    if (requestModel && !rlHeaders.detectedModel) rlHeaders.detectedModel = requestModel;

    const ct = response.headers.get('content-type') ?? '';
    const isStream = ct.includes('text/event-stream') || ct.includes('application/x-ndjson');

    if (isStream) {
      let streamA, streamB;
      try {
        [streamA, streamB] = response.body.tee();
      } catch {
        return response;
      }

      parseSseStream(streamB).then((tokenData) => {
        emit(site, url, tokenData, rlHeaders, null);
      }).catch(() => {});

      return new Response(streamA, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } else {
      const clone = response.clone();
      clone.text().then((text) => {
        const tokenData = parseJsonBody(text);
        emit(site, url, tokenData, rlHeaders, null);
      }).catch(() => {});
      return response;
    }
  };

  // ─── XHR wrapper (fallback for older patterns) ───────────────────────────────

  const _XHR = window.XMLHttpRequest;
  class YorXHR extends _XHR {
    constructor() { super(); this._url = ''; }
    open(method, url, ...rest) { this._url = String(url); return super.open(method, url, ...rest); }
    send(...args) {
      const url = this._url;
      const site = detectSite(url);
      if (site && isAIApiCall(url, site)) {
        this.addEventListener('load', () => {
          try {
            const tokenData = parseJsonBody(this.responseText);
            emit(site, url, tokenData, {}, null);
          } catch { /* ignore */ }
        });
      }
      return super.send(...args);
    }
  }
  window.XMLHttpRequest = YorXHR;

})();
