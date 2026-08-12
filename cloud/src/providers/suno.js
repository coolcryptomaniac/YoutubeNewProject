const trimSlash = s => String(s || '').replace(/\/+$/, '');
const pathOf = (env, key, fallback) => String(env[key] || fallback || '').trim();
const clip = (v, n = 4000) => String(v ?? '').slice(0, n);

export class SunoProviderError extends Error {
  constructor(message, { status = 502, code = 'SUNO_UPSTREAM', detail = '', retryable = false } = {}) {
    super(message);
    this.name = 'SunoProviderError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.retryable = retryable;
  }
}

/**
 * Ridge-side contract for Suno's official developer platform.
 *
 * Why the endpoint paths are environment-driven:
 * Suno publicly advertises a REST API, but its authenticated endpoint schema
 * is not exposed on the public login page. We therefore normalize Suno behind
 * a stable Ridge contract and only bind concrete paths once an approved account
 * can see the official docs.
 *
 * Required to enable:
 *   SUNO_API_KEY
 *   SUNO_API_BASE
 *
 * Optional path overrides after approval:
 *   SUNO_GENERATE_PATH   default: /v1/generations
 *   SUNO_STATUS_PATH     default: /v1/generations/{id}
 *   SUNO_CANCEL_PATH     default: /v1/generations/{id}/cancel
 *
 * Auth can be changed without code if Suno's docs require something other
 * than Bearer:
 *   SUNO_AUTH_HEADER     default: Authorization
 *   SUNO_AUTH_SCHEME     default: Bearer
 */
export class SunoProvider {
  constructor(env) {
    this.env = env;
    this.base = trimSlash(env.SUNO_API_BASE);
    this.key = String(env.SUNO_API_KEY || '').trim();
    this.authHeader = String(env.SUNO_AUTH_HEADER || 'Authorization').trim();
    this.authScheme = String(env.SUNO_AUTH_SCHEME ?? 'Bearer').trim();
  }

  get enabled() {
    return Boolean(this.base && this.key);
  }

  capabilities() {
    return {
      provider: 'suno-official',
      enabled: this.enabled,
      mode: this.enabled ? 'official-api' : 'manual',
      contract: 'ridge-suno-v1',
      supports: {
        textToSong: true,
        customLyrics: true,
        instrumental: true,
        status: true,
        cancel: true,
        covers: null,
        mashups: null,
        webhooks: null
      },
      note: this.enabled
        ? 'Official Suno credentials are configured on the Worker.'
        : 'Manual Suno handoff remains active until official API credentials are configured.'
    };
  }

  headers(extra = {}) {
    const h = { Accept: 'application/json', 'Content-Type': 'application/json', ...extra };
    if (this.authHeader && this.key) {
      h[this.authHeader] = this.authScheme ? `${this.authScheme} ${this.key}` : this.key;
    }
    return h;
  }

  async request(path, init = {}) {
    if (!this.enabled) {
      throw new SunoProviderError('Official Suno API is not enabled for this Ridge deployment', {
        status: 503,
        code: 'SUNO_NOT_CONFIGURED'
      });
    }
    const url = this.base + (path.startsWith('/') ? path : `/${path}`);
    let r;
    try {
      r = await fetch(url, { ...init, headers: this.headers(init.headers || {}) });
    } catch (e) {
      throw new SunoProviderError('Could not reach the official Suno API', {
        status: 503,
        code: 'SUNO_NETWORK',
        detail: clip(e?.message || e, 500),
        retryable: true
      });
    }
    const raw = await r.text();
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    if (!r.ok) {
      const retryable = r.status === 408 || r.status === 409 || r.status === 425 || r.status === 429 || r.status >= 500;
      throw new SunoProviderError(`Suno API returned ${r.status}`, {
        status: r.status === 401 || r.status === 403 ? 502 : (retryable ? 503 : 502),
        code: r.status === 429 ? 'SUNO_RATE_LIMIT' : 'SUNO_UPSTREAM',
        detail: clip(typeof body === 'string' ? body : JSON.stringify(body), 1000),
        retryable
      });
    }
    return body;
  }

  /** Stable Ridge input -> provider payload. Field names can be overridden
   * later in one place once the approved Suno docs are visible. */
  buildGeneratePayload(input = {}) {
    const lyrics = clip(input.lyrics, 16000).trim();
    const instrumental = Boolean(input.instrumental);
    const payload = {
      prompt: clip(input.prompt || input.style || '', 2000).trim(),
      title: clip(input.title || '', 160).trim(),
      instrumental,
      ...(instrumental || !lyrics ? {} : { lyrics })
    };
    if (input.model) payload.model = clip(input.model, 120);
    if (input.duration) payload.duration = Number(input.duration);
    if (input.metadata && typeof input.metadata === 'object') payload.metadata = input.metadata;
    return payload;
  }

  normalizeJob(raw) {
    const x = raw?.data ?? raw?.generation ?? raw?.job ?? raw ?? {};
    const id = x.id ?? x.generation_id ?? x.generationId ?? x.job_id ?? x.jobId ?? null;
    const stateRaw = String(x.status ?? x.state ?? raw?.status ?? 'queued').toLowerCase();
    const state = ['complete','completed','succeeded','success','done','ready'].includes(stateRaw) ? 'completed'
      : ['failed','error','errored'].includes(stateRaw) ? 'failed'
      : ['cancelled','canceled'].includes(stateRaw) ? 'cancelled'
      : ['running','processing','generating','in_progress'].includes(stateRaw) ? 'running'
      : 'queued';

    const items = x.outputs ?? x.songs ?? x.tracks ?? x.audio ?? raw?.outputs ?? [];
    const list = Array.isArray(items) ? items : (items ? [items] : []);
    const outputs = list.map((o, i) => ({
      id: o?.id ?? o?.song_id ?? o?.songId ?? `${id || 'suno'}-${i}`,
      title: o?.title ?? x.title ?? '',
      audioUrl: o?.audio_url ?? o?.audioUrl ?? o?.url ?? o?.download_url ?? o?.downloadUrl ?? '',
      imageUrl: o?.image_url ?? o?.imageUrl ?? o?.cover_url ?? o?.coverUrl ?? '',
      duration: Number(o?.duration ?? o?.duration_seconds ?? 0) || null
    })).filter(o => o.audioUrl || o.id);

    return {
      provider: 'suno-official',
      id,
      state,
      outputs,
      error: x.error ?? raw?.error ?? null,
      rawStatus: stateRaw
    };
  }

  async generate(input) {
    const path = pathOf(this.env, 'SUNO_GENERATE_PATH', '/v1/generations');
    const raw = await this.request(path, {
      method: 'POST',
      body: JSON.stringify(this.buildGeneratePayload(input))
    });
    return this.normalizeJob(raw);
  }

  async status(id) {
    if (!id) throw new SunoProviderError('generation id required', { status: 400, code: 'SUNO_BAD_REQUEST' });
    const template = pathOf(this.env, 'SUNO_STATUS_PATH', '/v1/generations/{id}');
    const raw = await this.request(template.replace('{id}', encodeURIComponent(id)), { method: 'GET' });
    return this.normalizeJob(raw);
  }

  async cancel(id) {
    if (!id) throw new SunoProviderError('generation id required', { status: 400, code: 'SUNO_BAD_REQUEST' });
    const template = pathOf(this.env, 'SUNO_CANCEL_PATH', '/v1/generations/{id}/cancel');
    const raw = await this.request(template.replace('{id}', encodeURIComponent(id)), { method: 'POST', body: '{}' });
    return this.normalizeJob(raw);
  }
}

export function sunoProvider(env) {
  return new SunoProvider(env);
}
