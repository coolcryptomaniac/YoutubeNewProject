/* Ridge official Suno browser client.
   Secrets never live here: every call goes through the Ridge Worker. */
'use strict';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export class RidgeSunoError extends Error {
  constructor(message, { code = 'SUNO_ERROR', retryable = false, status = 0, detail = '' } = {}) {
    super(message);
    this.name = 'RidgeSunoError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.detail = detail;
  }
}

export class RidgeSunoClient {
  constructor({ workerBase = '', pollMs = 5000, maxPollMs = 12 * 60 * 1000 } = {}) {
    this.workerBase = String(workerBase || '').replace(/\/+$/, '');
    this.pollMs = pollMs;
    this.maxPollMs = maxPollMs;
  }

  url(path) {
    return `${this.workerBase}${path}`;
  }

  async request(path, init = {}) {
    let r;
    try {
      r = await fetch(this.url(path), {
        ...init,
        headers: { Accept: 'application/json', ...(init.headers || {}) }
      });
    } catch (e) {
      throw new RidgeSunoError('Could not reach the Ridge Suno gateway', {
        code: 'SUNO_GATEWAY_NETWORK', retryable: true, detail: String(e?.message || e)
      });
    }
    let body = null;
    try { body = await r.json(); } catch {}
    if (!r.ok) {
      throw new RidgeSunoError(body?.error || `Suno gateway returned ${r.status}`, {
        code: body?.code || 'SUNO_GATEWAY',
        retryable: Boolean(body?.retryable),
        status: r.status,
        detail: body?.detail || ''
      });
    }
    return body;
  }

  capabilities() {
    return this.request('/api/suno/capabilities');
  }

  generate({ prompt, style, title = '', lyrics = '', instrumental = false, model = '', metadata = null } = {}) {
    return this.request('/api/suno/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style, title, lyrics, instrumental, model, metadata })
    });
  }

  status(id) {
    return this.request(`/api/suno/status?id=${encodeURIComponent(id)}`);
  }

  cancel(id) {
    return this.request('/api/suno/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
  }

  async generateAndWait(input, { signal, onUpdate } = {}) {
    let job = await this.generate(input);
    onUpdate?.(job);
    if (!job?.id || ['completed', 'failed', 'cancelled'].includes(job.state)) return job;

    const started = Date.now();
    while (Date.now() - started < this.maxPollMs) {
      if (signal?.aborted) {
        try { await this.cancel(job.id); } catch {}
        throw new DOMException('Suno generation aborted', 'AbortError');
      }
      await sleep(this.pollMs);
      job = await this.status(job.id);
      onUpdate?.(job);
      if (['completed', 'failed', 'cancelled'].includes(job.state)) return job;
    }
    throw new RidgeSunoError('Suno generation is still running after the Ridge polling window', {
      code: 'SUNO_POLL_TIMEOUT', retryable: true
    });
  }
}

export async function chooseSunoMode(client = new RidgeSunoClient()) {
  try {
    const caps = await client.capabilities();
    return caps?.enabled ? { mode: 'official-api', caps } : { mode: 'manual', caps };
  } catch {
    return { mode: 'manual', caps: null };
  }
}
