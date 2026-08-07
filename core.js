/* ═══════════════════════════════════════════════════════════
   Ridge core — shared by music.html and shorts.html
   Mood analysis · providers · vault (IndexedDB) · Drive backup
   ═══════════════════════════════════════════════════════════ */
'use strict';

export const store = {
  get: k => { try { return JSON.parse(localStorage.getItem('ridge.' + k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem('ridge.' + k, JSON.stringify(v)); } catch {} }
};

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ───────────────── mood analysis ─────────────────
   Runs on the decoded AudioBuffer. Everything here is plain
   arithmetic over the samples — no FFT library, no network. */

export function analyseAudio(buf){
  const ch = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const win = Math.floor(sr * 0.046);           // ~46 ms windows
  const hop = Math.floor(win / 2);
  const frames = Math.floor((ch.length - win) / hop);
  if (frames < 8) return fallbackMood();

  const rms = new Float32Array(frames);
  const zcr = new Float32Array(frames);

  for (let f = 0; f < frames; f++){
    const s = f * hop;
    let sum = 0, cross = 0, prev = ch[s];
    for (let i = 0; i < win; i++){
      const v = ch[s + i];
      sum += v * v;
      if ((v >= 0) !== (prev >= 0)) cross++;
      prev = v;
    }
    rms[f] = Math.sqrt(sum / win);
    zcr[f] = cross / win;
  }

  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const std = (a, m) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);

  const rMean = mean(rms), rStd = std(rms, rMean);
  const zMean = mean(zcr);

  // onset envelope: positive energy flux
  const flux = new Float32Array(frames - 1);
  for (let f = 1; f < frames; f++) flux[f - 1] = Math.max(0, rms[f] - rms[f - 1]);
  const fMean = mean(flux);

  // A sustained pad has almost no onset flux. Autocorrelating that just
  // finds noise, so decide first whether there is any beat to look for.
  const percussive = fMean / (rMean || 1e-6);
  let bpm = 0;

  if (percussive > 0.035){
    const fps = sr / hop;
    const scores = [];
    for (let cand = 60; cand <= 180; cand++){
      const lag = Math.round(fps * 60 / cand);
      if (lag < 2 || lag >= flux.length) continue;
      let acc = 0;
      for (let i = 0; i + lag < flux.length; i++) acc += flux[i] * flux[i + lag];
      scores.push({ cand, score: acc / (flux.length - lag) });
    }
    if (scores.length){
      const best = scores.reduce((a, b) => b.score > a.score ? b : a);
      const avg = mean(scores.map(s => s.score));
      // only trust it if the peak genuinely stands out from the field
      if (best.score > avg * 1.18) bpm = best.cand;
    }
  }

  // normalised 0..1 descriptors
  const energy     = clamp(rMean * 5.5, 0, 1);
  const brightness = clamp(zMean * 14, 0, 1);
  const dynamics   = clamp(rStd / (rMean || 1e-6), 0, 1.6) / 1.6;
  // no detectable beat means the track is never "fast", whatever else it is
  const pace       = bpm ? clamp((bpm - 60) / 120, 0, 1) : clamp(energy * 0.45, 0, 0.45);

  return { bpm, energy, brightness, dynamics, pace, ...classify({ bpm, energy, brightness, dynamics, pace }) };
}

function fallbackMood(){
  return { bpm: 0, energy: .5, brightness: .5, dynamics: .5, pace: .5,
           mood: 'cinematic', label: 'Cinematic', visual: 'nebula',
           palette: ['#7C6CFF', '#FF7A9C'], sceneMood: 'wide cinematic landscapes, soft haze, golden hour' };
}

/* mood → a visualiser, a palette and a scene direction */
const MOODS = {
  serene:    { label:'Serene',     visual:'aurora',  palette:['#8FD9C9','#7C6CFF'],
               sceneMood:'still misty landscapes at dawn, soft pastel light, wide empty space, calm' },
  melancholy:{ label:'Melancholy', visual:'strings', palette:['#7C6CFF','#5AC8FA'],
               sceneMood:'rain on windows, empty streets at blue hour, muted desaturated palette, solitude' },
  cinematic: { label:'Cinematic',  visual:'nebula',  palette:['#FF7A9C','#FFC257'],
               sceneMood:'sweeping mountain vistas, volumetric light, dramatic clouds, golden hour, epic scale' },
  warm:      { label:'Warm',       visual:'ridge',   palette:['#FFC257','#FF7A9C'],
               sceneMood:'sunlit interiors, warm analogue film grain, terracotta and amber, nostalgic' },
  driving:   { label:'Driving',    visual:'bars',    palette:['#FF7A9C','#FFC257'],
               sceneMood:'motion blur, night highways, neon reflections, kinetic energy, long exposure' },
  electric:  { label:'Electric',   visual:'grid',    palette:['#5AC8FA','#FF7A9C'],
               sceneMood:'chrome and neon, synthwave horizon, laser grids, high contrast, retro-futurist' },
  euphoric:  { label:'Euphoric',   visual:'pulse',   palette:['#FF7A9C','#8FD9C9'],
               sceneMood:'festival crowds, confetti light, bright saturated colour, celebration, bloom' },
  hypnotic:  { label:'Hypnotic',   visual:'orbit',   palette:['#8FD9C9','#5AC8FA'],
               sceneMood:'slow geometric patterns, kaleidoscopic symmetry, deep space, meditative' }
};

export function classify(d){
  const { energy, brightness, dynamics, pace } = d;
  let key;
  if (energy < .3 && pace < .35)                    key = brightness < .4 ? 'melancholy' : 'serene';
  else if (energy < .45 && dynamics > .55)          key = 'cinematic';
  else if (energy < .5)                             key = brightness > .55 ? 'hypnotic' : 'warm';
  else if (pace > .65 && brightness > .55)          key = energy > .75 ? 'euphoric' : 'electric';
  else if (pace > .5)                               key = 'driving';
  else                                              key = dynamics > .5 ? 'cinematic' : 'warm';
  return { mood: key, ...MOODS[key] };
}

export const MOOD_LIST = Object.entries(MOODS).map(([k, v]) => ({ key: k, ...v }));

/* ───────────────── providers ─────────────────
   Every one of these was checked as browser-reachable.
   Cerebras is deliberately absent — its API blocks CORS. */

export const IMAGE_PROVIDERS = {
  pollinations: {
    label: 'Pollinations — free, no key',
    needsKey: false,
    maxEdge: 1024,
    pace: 15500,
    async make(prompt, w, h, seed){
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
                  `?width=${w}&height=${h}&nologo=true&seed=${seed}&model=flux`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Pollinations ' + r.status);
      const b = await r.blob();
      if (!b.type.startsWith('image/')) throw new Error('Pollinations returned an error page');
      return b;
    }
  },
  gemini: {
    label: 'Gemini 2.5 Flash Image — free key, 500/day',
    needsKey: 'geminiKey',
    maxEdge: 1024,
    pace: 1200,
    async make(prompt, w, h, seed){
      const key = store.get('geminiKey');
      if (!key) throw new Error('No Gemini key saved');
      const ratio = w > h ? '16:9' : h > w ? '9:16' : '1:1';
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(key)}`,
        { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            contents:[{ parts:[{ text: `${prompt}\n\nAspect ratio ${ratio}. No text, letters or watermark anywhere in the image.` }] }],
            generationConfig:{ responseModalities:['IMAGE'] }
          }) });
      if (!r.ok){
        const t = await r.text();
        throw new Error(r.status === 429 ? 'Gemini daily quota reached' : 'Gemini ' + r.status + ' ' + t.slice(0,90));
      }
      const j = await r.json();
      const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
      const inline = part?.inlineData || part?.inline_data;
      if (!inline) throw new Error('Gemini returned no image');
      const bin = atob(inline.data);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return new Blob([buf], { type: inline.mimeType || inline.mime_type || 'image/png' });
    }
  }
};

export const TEXT_PROVIDERS = {
  groq: {
    label: 'Groq — free key, fastest',
    keyName: 'groqKey', keyPrefix: 'gsk_',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b']
  },
  openrouter: {
    label: 'OpenRouter — free models',
    keyName: 'orKey', keyPrefix: 'sk-or-',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free', 'qwen/qwen3-235b-a22b:free']
  }
};

export async function think(messages, { temperature = 0.85 } = {}){
  const which = store.get('textProvider') || 'groq';
  const p = TEXT_PROVIDERS[which];
  const key = store.get(p.keyName);
  if (!key) throw new Error(`No ${which} key saved — add one under Setup`);
  const model = store.get('textModel') || p.models[0];

  const r = await fetch(p.url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + key },
    body: JSON.stringify({ model, messages, temperature, response_format:{ type:'json_object' } })
  });
  if (!r.ok){
    const t = await r.text();
    if (r.status === 401) throw new Error(`${which} rejected the key`);
    if (r.status === 429) throw new Error(`${which} rate limit — wait a minute`);
    throw new Error(`${which} ${r.status}: ${t.slice(0,120)}`);
  }
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content || '';
  return JSON.parse(txt.replace(/^```json\s*|\s*```$/g, ''));
}

export async function makeImage(prompt, w, h, seed, tries = 3){
  const which = store.get('imageProvider') || 'pollinations';
  const p = IMAGE_PROVIDERS[which] || IMAGE_PROVIDERS.pollinations;
  let last;
  for (let a = 0; a < tries; a++){
    try { return await p.make(prompt, w, h, seed); }
    catch (e){
      last = e;
      if (/quota|No .* key/i.test(e.message)) throw e;   // no point retrying these
      if (a < tries - 1) await sleep(6000 * (a + 1));
    }
  }
  throw last;
}
export const imagePace = () =>
  (IMAGE_PROVIDERS[store.get('imageProvider') || 'pollinations'] || IMAGE_PROVIDERS.pollinations).pace;

/* ───────────────── vault: survive a crash ─────────────────
   IndexedDB holds audio, rendered video and job state so a
   refresh, a crash or a closed laptop doesn't lose the work. */

const DB = 'ridge-vault', VER = 1;
let _db;
function db(){
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    const q = indexedDB.open(DB, VER);
    q.onupgradeneeded = () => {
      const d = q.result;
      if (!d.objectStoreNames.contains('blobs'))  d.createObjectStore('blobs');
      if (!d.objectStoreNames.contains('state'))  d.createObjectStore('state');
    };
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  return _db;
}
async function tx(name, mode, fn){
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(name, mode);
    const s = t.objectStore(name);
    const out = fn(s);
    t.oncomplete = () => {
      // An IDBRequest for a missing key has result === undefined, so
      // `out?.result ?? out` would fall through and hand back the request
      // object itself — truthy, and mistaken for real data downstream.
      const isReq = out && typeof out === 'object' && 'result' in out;
      res(isReq ? out.result : out);
    };
    t.onerror = () => rej(t.error);
  });
}

export const vault = {
  putBlob:  (k, b) => tx('blobs', 'readwrite', s => s.put(b, k)),
  getBlob:  k      => tx('blobs', 'readonly',  s => s.get(k)),
  delBlob:  k      => tx('blobs', 'readwrite', s => s.delete(k)),
  keys:     ()     => tx('blobs', 'readonly',  s => s.getAllKeys()),
  putState: (k, v) => tx('state', 'readwrite', s => s.put(v, k)),
  getState: k      => tx('state', 'readonly',  s => s.get(k)),
  async clear(){
    await tx('blobs', 'readwrite', s => s.clear());
    await tx('state', 'readwrite', s => s.clear());
  },
  async usage(){
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return { used: e.usage || 0, quota: e.quota || 0 };
  },
  // ask the browser not to evict this data under storage pressure
  persist: () => navigator.storage?.persist ? navigator.storage.persist() : Promise.resolve(false)
};

/* ───────────────── Google Drive backup ─────────────────
   Scope drive.file — the app can only ever see files it made. */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export async function driveFolder(token, name = 'Ridge'){
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    { headers:{ Authorization:'Bearer ' + token } }).then(r => r.json());
  if (found.files?.length) return found.files[0].id;

  const made = await fetch('https://www.googleapis.com/drive/v3/files', {
    method:'POST',
    headers:{ Authorization:'Bearer ' + token, 'Content-Type':'application/json' },
    body: JSON.stringify({ name, mimeType:'application/vnd.google-apps.folder' })
  }).then(r => r.json());
  if (!made.id) throw new Error('Could not create the Drive folder');
  return made.id;
}

export async function driveUpload(token, folderId, name, blob, onProgress){
  const meta = { name, parents:[folderId] };
  const init = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink', {
      method:'POST',
      headers:{ Authorization:'Bearer ' + token, 'Content-Type':'application/json',
                'X-Upload-Content-Type': blob.type || 'application/octet-stream',
                'X-Upload-Content-Length': String(blob.size) },
      body: JSON.stringify(meta)
    });
  if (!init.ok) throw new Error('Drive rejected the upload: ' + (await init.text()).slice(0,120));
  const url = init.headers.get('Location') || init.headers.get('location');
  if (!url) throw new Error('Drive did not return an upload URL');

  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url, true);
    x.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    x.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => x.status < 300 ? res(JSON.parse(x.responseText)) : rej(new Error('Drive upload failed, status ' + x.status));
    x.onerror = () => rej(new Error('network dropped during the Drive upload'));
    x.send(blob);
  });
}

export async function driveQuota(token){
  const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota',
    { headers:{ Authorization:'Bearer ' + token } });
  if (!r.ok) return null;
  const q = (await r.json()).storageQuota || {};
  return { used: Number(q.usage || 0), limit: Number(q.limit || 0) };
}

/* ───────────────── resumable YouTube upload ─────────────────
   The session URL is durable for a week. Store it and an
   interrupted upload picks up from the byte it stopped at. */

export async function ytSession(token, blob, meta){
  const r = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method:'POST',
      headers:{ Authorization:'Bearer ' + token, 'Content-Type':'application/json',
                'X-Upload-Content-Type': blob.type || 'video/webm',
                'X-Upload-Content-Length': String(blob.size) },
      body: JSON.stringify(meta)
    });
  if (!r.ok){
    const t = await r.text();
    throw new Error(r.status === 403 ? 'quota spent or upload not permitted' : t.slice(0,160));
  }
  const url = r.headers.get('Location') || r.headers.get('location');
  if (!url) throw new Error('YouTube did not return an upload URL');
  return url;
}

/** Ask YouTube how many bytes it already has. Returns -1 if the session is dead. */
export async function ytProgress(url, size){
  const r = await fetch(url, { method:'PUT', headers:{ 'Content-Range': `bytes */${size}` } });
  if (r.status === 200 || r.status === 201) return size;          // already finished
  if (r.status !== 308) return -1;                                 // expired or gone
  const range = r.headers.get('Range');
  return range ? Number(range.split('-')[1]) + 1 : 0;
}

export function ytPut(url, blob, from, onProgress){
  return new Promise((res, rej) => {
    const slice = from > 0 ? blob.slice(from) : blob;
    const x = new XMLHttpRequest();
    x.open('PUT', url, true);
    x.setRequestHeader('Content-Type', blob.type || 'video/webm');
    if (from > 0) x.setRequestHeader('Content-Range', `bytes ${from}-${blob.size - 1}/${blob.size}`);
    x.upload.onprogress = e => e.lengthComputable && onProgress?.((from + e.loaded) / blob.size);
    x.onload = () => x.status < 300 ? res(JSON.parse(x.responseText))
                                    : rej(new Error('upload failed, status ' + x.status));
    x.onerror = () => rej(new Error('network dropped'));
    x.send(slice);
  });
}

/* ───────────────── release timing ─────────────────
   Two sources: what actually worked on this channel, and the
   published consensus for Indian audiences. Own data wins once
   there is enough of it. All hours are IST. */

// India peaks 18:00–21:00. Publish 2–3h before so indexing finishes first.
export const DEFAULT_SLOTS = {
  long:   [{ dow:3, hour:16 }, { dow:5, hour:16 }, { dow:0, hour:10 }, { dow:6, hour:11 }, { dow:2, hour:17 }],
  shorts: [{ dow:3, hour:12 }, { dow:5, hour:19 }, { dow:6, hour:13 }, { dow:0, hour:19 }, { dow:1, hour:12 }]
};
const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const istParts = iso => {
  const d = new Date(iso);
  const s = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
  return { dow: s.getDay(), hour: s.getHours() };
};

/**
 * Rank publishing slots from this channel's own history.
 * Views are age-normalised — a video from last year has had far longer
 * to accumulate views than one from Tuesday, and comparing them raw
 * would just rank "oldest" first.
 */
export function bestSlots(videos, { shorts = null } = {}){
  const pool = (videos || []).filter(v =>
    v.published && Number.isFinite(v.views) && (shorts === null || !!v.isShort === shorts));
  if (pool.length < 6) return { slots: null, confidence: 'none', n: pool.length };

  const scored = pool.map(v => {
    const ageDays = Math.max(1, (Date.now() - new Date(v.published)) / 864e5);
    return { ...istParts(v.published), rate: v.views / Math.pow(ageDays, 0.6) };
  });

  const all = scored.map(s => s.rate).sort((a, b) => a - b);
  const median = all[Math.floor(all.length / 2)] || 1;

  const bucket = {};
  for (const s of scored){
    const band = Math.floor(s.hour / 3) * 3;                 // 3-hour bands
    const k = `${s.dow}:${band}`;
    (bucket[k] ||= { dow: s.dow, band, n: 0, total: 0 });
    bucket[k].n++; bucket[k].total += s.rate;
  }

  const ranked = Object.values(bucket)
    .map(b => ({ ...b, index: (b.total / b.n) / (median || 1) }))
    .filter(b => b.n >= 2)
    .sort((a, b) => b.index - a.index);

  if (!ranked.length) return { slots: null, confidence: 'none', n: pool.length };

  const confidence = pool.length >= 25 && ranked[0].n >= 4 ? 'good'
                   : pool.length >= 12 ? 'thin' : 'weak';

  // A band can top the ranking simply because few videos landed there.
  // Nobody in India is watching at 2am, so a dead-hour slot has to clear a
  // much higher bar than a plausible one before it is worth scheduling into.
  const dead = b => b.band < 7 || b.band >= 23;
  const usable = ranked.filter(b => !dead(b) || (b.index > 1.6 && b.n >= 4 && confidence === 'good'));
  if (!usable.length) return { slots: null, confidence: 'none', n: pool.length, reason: 'only dead-hour slots ranked' };

  return {
    confidence, n: pool.length,
    slots: usable.slice(0, 5).map(b => ({
      dow: b.dow, hour: b.band + 1, samples: b.n,
      index: Number(b.index.toFixed(2)),
      label: `${DOW[b.dow]} ${String(b.band).padStart(2,'0')}:00–${String(b.band+3).padStart(2,'0')}:00`
    })),
    worst: ranked.slice(-2).map(b => ({
      label: `${DOW[b.dow]} ${String(b.band).padStart(2,'0')}:00–${String(b.band+3).padStart(2,'0')}:00`,
      index: Number(b.index.toFixed(2))
    }))
  };
}

/** Next occurrence of a {dow,hour} slot in IST, as a real Date. */
export function nextSlot(slot, after = new Date(), minLeadMinutes = 20){
  const floor = new Date(after.getTime() + minLeadMinutes * 60000);
  for (let add = 0; add < 21; add++){
    const probe = new Date(floor.getTime() + add * 864e5);
    const ist = new Date(probe.getTime() + (330 + probe.getTimezoneOffset()) * 60000);
    if (add === 0 || ist.getDay() === slot.dow){
      if (ist.getDay() !== slot.dow) continue;
      ist.setHours(slot.hour, 0, 0, 0);
      const back = new Date(ist.getTime() - (330 + probe.getTimezoneOffset()) * 60000);
      if (back > floor) return back;
    }
  }
  return new Date(floor.getTime() + 864e5);
}

/**
 * Lay n videos across the best slots without stacking two in one day —
 * a burst on one day reads as a dump and performs worse than a trickle.
 */
export function planReleases(n, slots, { from = new Date(), perDay = 2, confidence = 'good', kind = 'long' } = {}){
  const fallback = DEFAULT_SLOTS[kind] || DEFAULT_SLOTS.long;
  // Thin evidence is worse than no evidence if trusted blindly, so below
  // "good" the channel's own slots only lead and the defaults fill in.
  const lead = !slots || !slots.length ? [] : confidence === 'good' ? slots : slots.slice(0, 2);
  // Even a strong single slot needs company — one slot means one release a
  // week, which spreads a batch over months instead of days.
  const use = [...lead];
  for (const f of fallback)
    if (use.length < 5 && !use.some(s => s.dow === f.dow && Math.abs(s.hour - f.hour) < 3)) use.push(f);
  if (!use.length) use.push(...fallback);
  const out = [];
  let cursor = new Date(from.getTime() + 20 * 60000);
  const perDayCount = {};

  while (out.length < n){
    let placed = false;
    for (const s of use){
      if (out.length >= n) break;
      const when = nextSlot(s, cursor);
      const dayKey = when.toISOString().slice(0, 10);
      if ((perDayCount[dayKey] || 0) >= perDay) continue;
      if (out.some(o => Math.abs(o.at - when) < 3 * 3600e3)) continue;  // keep 3h apart
      perDayCount[dayKey] = (perDayCount[dayKey] || 0) + 1;
      out.push({ at: when, slot: s });
      placed = true;
    }
    if (!placed) cursor = new Date(cursor.getTime() + 864e5);
    if (cursor - from > 40 * 864e5) break;
  }
  return out.sort((a, b) => a.at - b.at).slice(0, n);
}

export const istLabel = d => new Date(d).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

/* ───────────────── daily upload budget ─────────────────
   Two separate ceilings sit on top of each other:

   1. The API's Video Uploads bucket — 100 calls a day, documented.
   2. YouTube's per-channel daily cap — undocumented, varies with account
      age and standing. Community reporting puts it near 10-15 for
      unverified channels and around 100 once verified.

   Whichever is lower binds. Going past it returns uploadLimitExceeded and
   locks uploads for 24 hours — not a ban, but a wasted day.

   Scheduling does NOT get around this. publishAt only moves when a video
   goes live; the upload itself still happens today and still counts. */

export const API_UPLOAD_BUCKET = 100;

export const ACCOUNT_TIERS = {
  unverified: { label:'Unverified — no phone verification', limit: 12,
                note:'Community reports put unverified channels near 10–15 a day. 12 leaves headroom.' },
  verified:   { label:'Verified — phone verified, established', limit: 100,
                note:'Matches the API bucket, so both ceilings land in the same place.' },
  cautious:   { label:'Verified but pacing deliberately', limit: 20,
                note:'Well inside every limit. Spam review looks at rate, not just totals.' },
  custom:     { label:'Set it myself', limit: null, note:'' }
};

const dayKey = d => new Date(d).toISOString().slice(0, 10);
/** YouTube's day rolls at midnight Pacific — 12:30 PM IST. */
export function nextReset(now = new Date()){
  const pac = new Date(now.toLocaleString('en-US', { timeZone:'America/Los_Angeles' }));
  const midnight = new Date(pac); midnight.setHours(24, 0, 0, 0);
  return new Date(now.getTime() + (midnight - pac));
}

export const budget = {
  limit(){
    const tier = store.get('accountTier') || 'verified';
    const set = tier === 'custom' ? Number(store.get('customLimit')) || 20
                                  : ACCOUNT_TIERS[tier]?.limit || 100;
    return Math.min(set, API_UPLOAD_BUCKET);
  },
  usedToday(){ return (store.get('uploads') || {})[dayKey(Date.now())] || 0; },
  record(){
    const d = store.get('uploads') || {};
    d[dayKey(Date.now())] = (d[dayKey(Date.now())] || 0) + 1;
    // keep a fortnight so the pattern is visible, drop the rest
    for (const k of Object.keys(d)) if ((Date.now() - new Date(k)) > 14 * 864e5) delete d[k];
    store.set('uploads', d);
  },
  remaining(){ return Math.max(0, this.limit() - this.usedToday() - (this.cooldown() ? 1e6 : 0)); },
  /** Returns the Date uploads unlock, or null if not blocked. */
  cooldown(){
    const until = store.get('uploadCooldown');
    if (!until) return null;
    const d = new Date(until);
    if (d <= new Date()){ store.set('uploadCooldown', null); return null; }
    return d;
  },
  /** Called when YouTube itself says stop. Believe it over our own count. */
  startCooldown(){
    const until = nextReset();
    store.set('uploadCooldown', until.toISOString());
    // whatever we thought the limit was, the channel's real one is lower
    const observed = this.usedToday();
    if (observed > 0 && observed < this.limit()){
      store.set('observedLimit', observed);
    }
    return until;
  },
  observed(){ return Number(store.get('observedLimit')) || null; },
  /** Why an upload can't run right now, or null if it can. */
  block(){
    const cd = this.cooldown();
    if (cd) return { reason:'cooldown', until: cd,
      message:`YouTube has paused uploads on this channel. They unlock at ${istLabel(cd)}.` };
    const left = this.limit() - this.usedToday();
    if (left <= 0) return { reason:'limit', until: nextReset(),
      message:`You've hit your ${this.limit()}-a-day setting. Resets at ${istLabel(nextReset())}.` };
    return null;
  }
};

/** YouTube's own signal that the channel is done for the day. */
export const isUploadLimit = err =>
  /uploadLimitExceeded|exceeded the number of videos/i.test(String(err?.message || err));

/* ───────────────── local folder storage ─────────────────
   The File System Access API lets the app write straight into a folder
   you choose, once, with permission that survives reloads. No OAuth, no
   API to enable, no 15 GB cap — it is bounded by your disk.

   Point it at your Google Drive or OneDrive desktop folder and you get
   cloud sync for free, without any of the API plumbing. */

const FS_OK = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
export const folderSupported = () => FS_OK;

let _dir = null;

export const folder = {
  supported: FS_OK,
  handle: () => _dir,
  name: () => _dir?.name || null,

  async choose(){
    if (!FS_OK) throw new Error('This browser has no folder access — use Chrome, Edge or Opera on desktop.');
    _dir = await window.showDirectoryPicker({ id:'ridge-out', mode:'readwrite', startIn:'videos' });
    await idbPutHandle(_dir);
    return _dir.name;
  },

  /** Reconnect to last session's folder. Chrome may still ask once per visit. */
  async reconnect({ prompt = false } = {}){
    if (!FS_OK) return null;
    const saved = await idbGetHandle();
    if (!saved) return null;
    let perm = await saved.queryPermission({ mode:'readwrite' });
    if (perm === 'prompt' && prompt) perm = await saved.requestPermission({ mode:'readwrite' });
    if (perm !== 'granted') return null;
    _dir = saved;
    return saved.name;
  },

  async forget(){ _dir = null; await idbDelHandle(); },

  /** Write a blob into <folder>/<sub>/<name>, creating the subfolder. */
  async write(name, blob, sub = null){
    if (!_dir) throw new Error('No folder chosen yet');
    let target = _dir;
    if (sub) target = await _dir.getDirectoryHandle(sub, { create:true });
    const fh = await target.getFileHandle(name, { create:true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return `${_dir.name}/${sub ? sub + '/' : ''}${name}`;
  },

  async list(sub = null){
    if (!_dir) return [];
    let target = _dir;
    try { if (sub) target = await _dir.getDirectoryHandle(sub); } catch { return []; }
    const out = [];
    for await (const [name, h] of target.entries())
      if (h.kind === 'file'){ const f = await h.getFile(); out.push({ name, size:f.size, at:f.lastModified }); }
    return out.sort((a, b) => b.at - a.at);
  }
};

/* Directory handles are structured-cloneable, so IndexedDB can hold them
   across sessions — localStorage cannot, it only takes strings. */
const HDB = 'ridge-fs';
function hdb(){
  return new Promise((res, rej) => {
    const q = indexedDB.open(HDB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore('h');
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
const idbPutHandle = async h => { const d = await hdb();
  return new Promise(r => { const t = d.transaction('h','readwrite'); t.objectStore('h').put(h,'dir'); t.oncomplete = r; }); };
const idbGetHandle = async () => { const d = await hdb();
  return new Promise(r => { const t = d.transaction('h','readonly'); const g = t.objectStore('h').get('dir'); g.onsuccess = () => r(g.result); g.onerror = () => r(null); }); };
const idbDelHandle = async () => { const d = await hdb();
  return new Promise(r => { const t = d.transaction('h','readwrite'); t.objectStore('h').delete('dir'); t.oncomplete = r; }); };

/** Turn a raw Google API failure into something a person can act on. */
export function explainGoogleError(status, body){
  const text = String(body || '');
  if (/has not been used in project|is disabled/i.test(text)){
    const m = text.match(/project\s+(\d+)/i);
    return `The Drive API is switched off in your Cloud project${m ? ' ' + m[1] : ''}. ` +
           `Open console.cloud.google.com → APIs & Services → Library → search "Google Drive API" → Enable. ` +
           `It can take a minute to take effect. Enabling the YouTube API does not enable Drive.`;
  }
  if (status === 403 && /insufficient|scope/i.test(text))
    return 'That token does not carry the Drive scope. Press Connect Drive — it is a separate sign-in from YouTube.';
  if (status === 401) return 'The Drive sign-in expired. Press Connect Drive again.';
  if (status === 404) return 'Drive could not find that folder. Press Connect Drive again to recreate it.';
  return `Drive returned ${status}. ${text.slice(0, 180)}`;
}

/* ───────────────── Pexels: real footage and photographs ─────────────────
   Verified reachable from a browser origin. Free key from pexels.com/api.
   Unlike every free AI image service, this returns full-resolution assets —
   4K video clips and 5000px photographs — so it is the only route to
   genuinely sharp material in this app. */

export const PEXELS_SIZES = { photo:'large2x', video:'hd' };

async function pexels(path){
  const key = store.get('pexelsKey');
  if (!key) throw new Error('No Pexels key saved — get a free one at pexels.com/api');
  const r = await fetch('https://api.pexels.com/' + path, { headers:{ Authorization: key } });
  if (r.status === 401) throw new Error('Pexels rejected the key');
  if (r.status === 429) throw new Error('Pexels hourly limit reached — it resets on the hour');
  if (!r.ok) throw new Error('Pexels ' + r.status);
  return r.json();
}

export async function pexelsPhotos(query, { count = 15, orientation = 'landscape', page = 1 } = {}){
  const j = await pexels(`v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(count,80)}` +
                         `&orientation=${orientation}&page=${page}`);
  return (j.photos || []).map(p => ({
    id:'px-'+p.id, kind:'photo',
    url: p.src.large2x || p.src.large,
    thumb: p.src.medium,
    w: p.width, h: p.height,
    credit: p.photographer, creditUrl: p.url
  }));
}

export async function pexelsVideos(query, { count = 10, orientation = 'landscape', page = 1 } = {}){
  const j = await pexels(`videos/search?query=${encodeURIComponent(query)}&per_page=${Math.min(count,80)}` +
                         `&orientation=${orientation}&page=${page}`);
  return (j.videos || []).map(v => {
    // prefer the largest file that is not absurd to download
    const files = (v.video_files || [])
      .filter(f => f.link && f.width)
      .sort((a,b) => b.width - a.width);
    const pick = files.find(f => f.width <= 1920) || files[files.length-1];
    return pick && {
      id:'pxv-'+v.id, kind:'video',
      url: pick.link, thumb: v.image,
      w: pick.width, h: pick.height, dur: v.duration,
      credit: v.user?.name, creditUrl: v.url
    };
  }).filter(Boolean);
}

/* ───────────────── asset library ─────────────────
   A local, growing store of clips and stills tagged by genre and mood.
   Nothing ships in the repo — a repo cannot carry gigabytes, and GitHub
   Pages caps a site at 1 GB. This fills up on your machine instead,
   bounded only by disk. */

export const library = {
  async put(asset, blob, tags){
    const rec = { id:asset.id, kind:asset.kind, w:asset.w, h:asset.h, dur:asset.dur || null,
                  credit:asset.credit || null, creditUrl:asset.creditUrl || null,
                  tags, size:blob.size, at:Date.now() };
    await vault.putBlob('asset:'+asset.id, blob);
    const idx = (await vault.getState('libIndex')) || [];
    const i = idx.findIndex(x => x.id === rec.id);
    if (i >= 0) idx[i] = rec; else idx.push(rec);
    await vault.putState('libIndex', idx);
    return rec;
  },
  async index(){ return (await vault.getState('libIndex')) || []; },
  async get(id){ return vault.getBlob('asset:'+id); },
  async remove(id){
    await vault.delBlob('asset:'+id).catch(()=>{});
    const idx = (await vault.getState('libIndex')) || [];
    await vault.putState('libIndex', idx.filter(x => x.id !== id));
  },
  async stats(){
    const idx = await this.index();
    return {
      count: idx.length,
      photos: idx.filter(a => a.kind === 'photo').length,
      videos: idx.filter(a => a.kind === 'video').length,
      bytes: idx.reduce((a, x) => a + (x.size || 0), 0)
    };
  },
  /** Everything matching a genre or mood, newest first. */
  async find({ genre = null, mood = null, kind = null } = {}){
    const idx = await this.index();
    return idx.filter(a =>
      (!kind  || a.kind === kind) &&
      (!genre || a.tags?.genre === genre) &&
      (!mood  || a.tags?.mood === mood)
    ).sort((a, b) => b.at - a.at);
  },
  async has(id){ return (await this.index()).some(x => x.id === id); }
};

/** Download an asset and file it. Skips anything already held. */
export async function cacheAsset(asset, tags){
  if (await library.has(asset.id)) return { cached:false, reason:'already held' };
  const r = await fetch(asset.url);
  if (!r.ok) throw new Error('download failed: ' + r.status);
  const blob = await r.blob();
  await library.put(asset, blob, tags);
  return { cached:true, size:blob.size };
}

/* ───────────────── storage budget ─────────────────
   Chrome grants roughly 60% of free disk to a persisted origin, so a
   phone with 100 GB free can hold tens of gigabytes. That is plenty,
   but "plenty" silently becomes "full", so the app keeps its own
   ceiling and clears the oldest already-published videos first. */

export const budgetGB = () => Number(store.get('storageBudgetGB')) || 20;

export async function storageReport(){
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  const pinned = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const cap = budgetGB() * 1073741824;
  return {
    used: est?.usage || 0,
    grant: est?.quota || 0,           // what the browser is willing to give
    cap,                              // what we choose to use
    pinned,
    pct: cap ? Math.min(1, (est?.usage || 0) / cap) : 0,
    over: (est?.usage || 0) > cap
  };
}

/**
 * Free space by removing published videos, oldest first. Never touches
 * anything unpublished — that is the work you would have to redo.
 */
export async function reclaim(need, tracks){
  const safe = (tracks || [])
    .filter(t => t.blob && t.state === 'done')
    .sort((a,b) => (a.publishedAt || 0) - (b.publishedAt || 0));
  let freed = 0;
  const gone = [];
  for (const t of safe){
    if (freed >= need) break;
    freed += t.blob.size;
    await vault.delBlob('video:' + t.id).catch(()=>{});
    t.blob = null;
    gone.push(t.meta?.title || t.name);
  }
  return { freed, gone };
}

/* ───────────────── footage reels ─────────────────
   Stock clips cut to the beat. The LLM writes search terms rather than
   image prompts, Pexels returns real footage, and the renderer draws
   whichever clip is current straight onto the canvas. */

/** Load a clip blob into a <video> ready to be drawn. */
export function loadClip(blob){
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true;
    v.preload = 'auto';
    v.src = URL.createObjectURL(blob);
    v.onloadeddata = () => res(v);
    v.onerror = () => rej(new Error('clip would not decode'));
    setTimeout(() => rej(new Error('clip timed out')), 30000);
  });
}

/**
 * Cut points across a track. With a tempo it cuts on bar lines, which is
 * what makes a montage feel deliberate rather than arbitrary; without one
 * it falls back to even spacing.
 */
export function cutPlan(duration, bpm, clips, { barsPerCut = 2 } = {}){
  if (!clips) return [];
  const cuts = [];
  if (bpm && bpm > 40){
    const bar = (60 / bpm) * 4;
    let step = bar * barsPerCut;
    // keep cuts between 1.2s and 6s however odd the tempo
    while (step < 1.2) step *= 2;
    while (step > 6)   step /= 2;
    for (let t = 0; t < duration; t += step) cuts.push(t);
  } else {
    // clips repeat rather than sitting on screen for half a minute
    const step = Math.min(5, Math.max(2.5, duration / Math.max(clips, 1)));
    for (let t = 0; t < duration; t += step) cuts.push(t);
  }
  return cuts.map((at, i) => ({ at, clip: i % clips }));
}

/** Which clip should be on screen, and how far into this cut we are. */
export function cutAt(plan, t){
  if (!plan.length) return null;
  let i = 0;
  while (i + 1 < plan.length && plan[i + 1].at <= t) i++;
  const start = plan[i].at;
  const end = i + 1 < plan.length ? plan[i + 1].at : start + 4;
  return { clip: plan[i].clip, local: (t - start) / Math.max(0.001, end - start), index: i };
}

/* ───────────────── transcription ─────────────────
   Groq hosts Whisper and — unlike most audio APIs — answers browser
   requests. That gives word-level timings from the song itself, which
   is the difference between lyrics that land on the beat and lyrics
   that drift. */

export async function transcribe(file, { language = null, onProgress = null } = {}){
  const key = store.get('groqKey');
  if (!key) throw new Error('Transcription needs a Groq key — add one under Setup');
  if (file.size > 24 * 1048576)
    throw new Error(`That file is ${(file.size/1048576).toFixed(0)} MB. Groq's limit is 25 MB — export a smaller MP3.`);

  const fd = new FormData();
  fd.append('file', file, file.name || 'audio.mp3');
  fd.append('model', 'whisper-large-v3');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  fd.append('timestamp_granularities[]', 'segment');
  if (language) fd.append('language', language);

  onProgress?.('Sending the audio to Whisper…');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method:'POST', headers:{ Authorization:'Bearer ' + key }, body: fd
  });
  if (!r.ok){
    const t = await r.text();
    if (r.status === 401) throw new Error('Groq rejected the key');
    if (r.status === 413) throw new Error('The file is too large for Groq — export a smaller MP3');
    if (r.status === 429) throw new Error('Groq rate limit — wait a minute and try again');
    throw new Error('Whisper ' + r.status + ': ' + t.slice(0, 140));
  }
  const j = await r.json();
  return {
    text: j.text || '',
    language: j.language || null,
    words: (j.words || []).map(w => ({ w: String(w.word || '').trim(), start: w.start, end: w.end }))
                          .filter(w => w.w),
    segments: (j.segments || []).map(s => ({ text: String(s.text || '').trim(), start: s.start, end: s.end }))
  };
}

/* ───────────────── lyric alignment ───────────────── */

const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Map lyrics you pasted onto the words Whisper heard.
 *
 * Whisper mishears, and a lyric sheet has words a singer skipped, so this
 * walks both sequences and only trusts a match when the normalised text
 * agrees. Unmatched words inherit timing from their neighbours, which
 * keeps a line moving even where the transcript is wrong.
 */
export function alignLyrics(text, heard, duration){
  const lines = String(text).split(/\r?\n/).map(s => s.trim())
    .filter(l => l && !/^\[.*\]$/.test(l));            // drop [Verse] markers
  if (!lines.length) return { lines: [], source:'empty' };

  if (!heard?.length) return evenLyrics(lines, duration);

  const flat = [];
  lines.forEach((line, li) =>
    line.split(/\s+/).forEach(w => flat.push({ w, li, start:null, end:null })));

  let hi = 0;
  for (const tok of flat){
    const target = norm(tok.w);
    if (!target) continue;
    // look a little way ahead for the same word
    for (let k = hi; k < Math.min(heard.length, hi + 8); k++){
      if (norm(heard[k].w) === target){
        tok.start = heard[k].start; tok.end = heard[k].end;
        hi = k + 1; break;
      }
    }
  }

  // fill gaps by interpolating between the words that did match
  const anchored = flat.map((t,i) => t.start !== null ? i : -1).filter(i => i >= 0);
  if (anchored.length < 2) return evenLyrics(lines, duration);

  for (let i = 0; i < flat.length; i++){
    if (flat[i].start !== null) continue;
    const before = anchored.filter(a => a < i).pop();
    const after  = anchored.find(a => a > i);
    if (before === undefined){ flat[i].start = 0; flat[i].end = flat[after].start; }
    else if (after === undefined){
      const last = flat[before];
      flat[i].start = last.end; flat[i].end = Math.min(duration, last.end + 0.4);
    } else {
      const span = flat[after].start - flat[before].end;
      const share = span / (after - before);
      flat[i].start = flat[before].end + share * (i - before - 1);
      flat[i].end = flat[i].start + share * 0.9;
    }
  }

  const out = lines.map((text, li) => {
    const words = flat.filter(f => f.li === li);
    return { text, words: words.map(w => ({ w:w.w, start:w.start, end:w.end })),
             start: words[0]?.start ?? 0, end: words[words.length-1]?.end ?? 0 };
  });
  const hit = flat.filter(f => anchored.includes(flat.indexOf(f))).length;
  return { lines: out, source:'aligned', matched: anchored.length, total: flat.length };
}

/** No transcript — spread the lines evenly and let the user nudge them. */
export function evenLyrics(lines, duration){
  const arr = Array.isArray(lines) ? lines
    : String(lines).split(/\r?\n/).map(s => s.trim()).filter(l => l && !/^\[.*\]$/.test(l));
  if (!arr.length) return { lines: [], source:'empty' };
  const per = duration / arr.length;
  return {
    source:'even',
    lines: arr.map((text, i) => {
      const start = i * per, end = start + per * 0.92;
      const ws = text.split(/\s+/);
      const wper = (end - start) / ws.length;
      return { text, start, end,
               words: ws.map((w, j) => ({ w, start: start + j*wper, end: start + (j+1)*wper*0.95 })) };
    })
  };
}

/** Straight from Whisper, no lyric sheet — group its words into readable lines. */
export function linesFromHeard(heard, { maxWords = 7, maxGap = 0.7 } = {}){
  const lines = [];
  let cur = [];
  for (let i = 0; i < heard.length; i++){
    cur.push(heard[i]);
    const gap = heard[i+1] ? heard[i+1].start - heard[i].end : 99;
    if (cur.length >= maxWords || gap > maxGap || i === heard.length - 1){
      lines.push({ text: cur.map(w => w.w).join(' '),
                   start: cur[0].start, end: cur[cur.length-1].end,
                   words: cur.map(w => ({ ...w })) });
      cur = [];
    }
  }
  return { lines, source:'heard' };
}

/** Which line, and which word inside it, at time t. */
export function lyricAt(lyric, t){
  if (!lyric?.lines?.length) return null;
  let i = lyric.lines.findIndex(l => t >= l.start && t <= l.end + 0.35);
  if (i < 0){
    const next = lyric.lines.findIndex(l => l.start > t);
    i = next < 0 ? lyric.lines.length - 1 : Math.max(0, next - 1);
    if (t < lyric.lines[i].start - 2.5 || t > lyric.lines[i].end + 2.5) return null;
  }
  const line = lyric.lines[i];
  const wi = line.words.findIndex(w => t >= w.start && t <= w.end);
  return { line, index:i, wordIndex: wi,
           progress: clamp((t - line.start) / Math.max(0.2, line.end - line.start), 0, 1),
           next: lyric.lines[i+1] || null };
}

/* ───────────────── what the song is about ─────────────────
   Genre and mood describe how a track sounds. They say nothing about
   whether it is a love song, a lament for a place, or somebody counting
   money. Reading the lyrics and cutting to their meaning is the whole
   difference between a montage and a music video. */

/** Split a timed lyric into sections that share a subject. */
export function lyricSections(lyric, count){
  const lines = lyric?.lines || [];
  if (!lines.length) return [];
  const n = Math.max(1, Math.min(count, lines.length));
  const per = Math.ceil(lines.length / n);
  const out = [];
  for (let i = 0; i < lines.length; i += per){
    const chunk = lines.slice(i, i + per);
    out.push({
      text: chunk.map(l => l.text).join(' / '),
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      lines: chunk.length
    });
  }
  return out;
}

/**
 * Build the visual brief from the words. Returns a shot per section,
 * each carrying the lyric it illustrates and the time it appears, so
 * the picture changes when the subject does rather than on a timer.
 */
export async function readSong(ask, { name, lyricText, sections, mood, genre, dur, kind = 'art' }){
  const wantsQueries = kind === 'reel';
  const brief = await ask([
    { role:'system', content:
      'You are a music video director reading a song and deciding what the audience should see.\n' +
      'Reply with JSON only: {"subject","arc","palette","shots"}.\n' +
      '"subject" — one sentence naming what this song is actually about. Be specific and literal: ' +
      'a love song, a lament for a place left behind, someone counting money they do not have, ' +
      'a parent watching a child leave. Not "emotional journey".\n' +
      '"arc" — one sentence on how it moves from beginning to end.\n' +
      '"palette" — two or three colour words that suit the subject, not the genre.\n' +
      '"shots" — one object per section given, in order, each with:\n' +
      (wantsQueries
        ? '  "query": a two-to-four-word stock-footage search phrase. Concrete nouns and settings only, ' +
          'the kind that actually returns results — "empty train station", "hands counting coins", ' +
          '"monsoon street night". No abstractions, no brand names.\n'
        : '  "prompt": one vivid sentence describing a cinematic frame — subject, setting, light, camera.\n') +
      '  "why": a few words naming which line or idea it illustrates.\n' +
      'The shots must ILLUSTRATE THE LYRIC OF THAT SECTION. If the section is about leaving home, ' +
      'show leaving home. Do not fall back on generic mood imagery when the words give you something ' +
      'concrete. Keep one consistent world across all of them — same place, same time of day ' +
      'progressing naturally, same palette — so it reads as one film.\n' +
      'Never show text, letters, logos or watermarks. Never name a real person, brand or franchise.' },
    { role:'user', content:
      `Song: "${name}"${genre?`\nGenre: ${genre}`:''}${mood?`\nMood the audio suggests: ${mood}`:''}\n` +
      `Length: ${Math.round(dur)}s\n\n` +
      (lyricText?.trim()
        ? `Lyrics:\n${lyricText.trim().slice(0, 4000)}\n\n`
        : 'No lyrics were provided — infer the subject from the title alone and say so in "subject".\n\n') +
      `Sections to illustrate, in order:\n` +
      sections.map((s,i) => `${i+1}. [${s.start.toFixed(0)}s–${s.end.toFixed(0)}s] ${s.text.slice(0,200)}`).join('\n') +
      `\n\nGive exactly ${sections.length} shots.` }
  ], { temperature: 0.85 });

  const shots = (brief.shots || []).slice(0, sections.length).map((s, i) => ({
    ...sections[i],
    query: String(s.query || s.prompt || '').slice(0, 120),
    prompt: String(s.prompt || s.query || ''),
    why: String(s.why || '')
  }));
  return { subject:String(brief.subject||''), arc:String(brief.arc||''),
           palette:brief.palette||[], shots };
}

/** Cut points that land on section boundaries, subdivided to the bar. */
export function storyPlan(sections, duration, bpm, { barsPerCut = 2 } = {}){
  if (!sections?.length) return [];
  const bar = bpm > 40 ? (60/bpm)*4 : 3;
  let step = bar * barsPerCut;
  while (step < 1.5) step *= 2;
  while (step > 8)   step /= 2;

  const plan = [];
  sections.forEach((sec, i) => {
    const from = i === 0 ? 0 : sec.start;
    const to   = i === sections.length-1 ? duration : sections[i+1]?.start ?? sec.end;
    // always cut at the section boundary, then subdivide inside it
    for (let t = from; t < to - 0.4; t += step) plan.push({ at: t, clip: i, section: i });
  });
  return plan.sort((a,b) => a.at - b.at);
}

/* ───────────────── picking the best frame ─────────────────
   For a thumbnail, "first image" is rarely the right image. This scores
   contrast, colour and how much of the frame is doing something, and
   returns the strongest. */
export function scoreImage(bitmap){
  const c = document.createElement('canvas');
  c.width = 64; c.height = 36;
  const x = c.getContext('2d', { willReadFrequently:true });
  x.drawImage(bitmap, 0, 0, 64, 36);
  const d = x.getImageData(0,0,64,36).data;

  let lum = [], sat = 0;
  for (let i = 0; i < d.length; i += 4){
    const r=d[i]/255, g=d[i+1]/255, b=d[i+2]/255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    sat += mx === 0 ? 0 : (mx-mn)/mx;
    lum.push(0.2126*r + 0.7152*g + 0.0722*b);
  }
  const n = lum.length;
  const mean = lum.reduce((a,b)=>a+b,0)/n;
  const sd = Math.sqrt(lum.reduce((a,l)=>a+(l-mean)**2,0)/n);

  // edge energy — a busy frame reads better small than a flat one
  let edge = 0;
  for (let y = 1; y < 35; y++) for (let px = 1; px < 63; px++){
    const i = y*64+px;
    edge += Math.abs(lum[i]-lum[i-1]) + Math.abs(lum[i]-lum[i-64]);
  }
  edge /= n;

  // mid luminance beats both crushed black and blown white
  const exposure = 1 - Math.abs(mean - 0.46) * 1.8;
  return { score: sd*2.4 + (sat/n)*1.5 + edge*3.2 + Math.max(0,exposure)*0.9,
           contrast:+sd.toFixed(3), saturation:+(sat/n).toFixed(3),
           edge:+edge.toFixed(3), mean:+mean.toFixed(3) };
}

export function bestImage(bitmaps){
  if (!bitmaps?.length) return { index:-1, image:null };
  let best = -1, bi = 0, all = [];
  bitmaps.forEach((b,i) => {
    const s = scoreImage(b);
    all.push(s.score);
    if (s.score > best){ best = s.score; bi = i; }
  });
  return { index: bi, image: bitmaps[bi], score:+best.toFixed(3), scores: all.map(s=>+s.toFixed(3)) };
}

/* ───────────────── transitions ─────────────────
   Applied in the first fraction of each cut. Every one of these is a
   geometric or alpha move — none of them flash, and the guard still
   runs afterwards regardless. */

export const TRANSITIONS = {
  cut:        { label:'Hard cut',   note:'no transition at all — the most confident choice' },
  dissolve:   { label:'Dissolve',   note:'the outgoing shot fades through' },
  dip:        { label:'Dip to dark',note:'a beat of black between shots' },
  slide:      { label:'Slide',      note:'the new shot pushes the old one out' },
  zoom:       { label:'Zoom punch', note:'the new shot lands slightly oversized and settles' },
  blur:       { label:'Blur through',note:'defocus across the join' },
  mix:        { label:'Mixed',      note:'varies by section so it never gets predictable' }
};

const PICK = ['dissolve','slide','zoom','dip','blur','cut'];

/**
 * Returns how to draw the incoming shot at this instant.
 * `local` is 0..1 through the current cut.
 */
export function transitionAt(kind, local, index, { length = 0.30 } = {}){
  const k = kind === 'mix' ? PICK[index % PICK.length] : kind;
  if (k === 'cut' || local > length) return { kind:'none', t:1, alpha:1, zoom:1, dx:0, blur:0, dim:0 };
  const t = local / length;                       // 0 at the join, 1 when settled
  const e = 1 - Math.pow(1 - t, 3);               // ease out
  switch (k){
    case 'dissolve': return { kind:k, t, alpha:e, zoom:1, dx:0, blur:0, dim:0 };
    case 'dip':      return { kind:k, t, alpha:1, zoom:1, dx:0, blur:0,
                              dim: Math.max(0, 1 - t*1.8) };
    case 'slide':    return { kind:k, t, alpha:1, zoom:1, dx:(1-e), blur:0, dim:0 };
    case 'zoom':     return { kind:k, t, alpha:e, zoom:1 + (1-e)*0.16, dx:0, blur:0, dim:0 };
    // peaks mid-transition then clears — must never go negative, a
    // negative filter value silently disables the whole filter string
    case 'blur':     return { kind:k, t, alpha:1, zoom:1, dx:0,
                              blur: Math.max(0, (1 - Math.abs(t-0.35)*2.4)) * 7, dim:0 };
    default:         return { kind:'none', t:1, alpha:1, zoom:1, dx:0, blur:0, dim:0 };
  }
}
