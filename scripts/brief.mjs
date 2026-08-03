#!/usr/bin/env node
/**
 * Ridge nightly brief.
 * Reads your channel's recent performance, asks a model what's working and what to
 * make next, pre-generates the panel art, and writes data/brief.json for the apps.
 *
 * Node 20+. No dependencies — global fetch only.
 */
import { writeFile, mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const {
  GROQ_API_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GROQ_MODEL = 'openai/gpt-oss-120b',
  GROQ_BASE = 'https://api.groq.com/openai/v1'
} = process.env;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = (...a) => console.log('·', ...a);
const warn = (...a) => console.log('!', ...a);

/* ─────────────── config ─────────────── */
const DEFAULTS = {
  handle: '@mohucool',
  clipsPerDay: 3,
  castSheet: 'Motu, a chubby golden-brown street dog with one floppy ear and a red collar; and Chotu, a small grumpy grey cat with white paws and green eyes. Both stay exactly this colour and shape in every panel.',
  artStyle: '3D Pixar-style animation, soft global illumination, expressive faces, vertical composition',
  seed: 4412,
  tone: 'warm slapstick, family safe',
  runningJoke: ''
};

async function loadConfig(){
  try {
    const raw = JSON.parse(await readFile('config.json', 'utf8'));
    return { ...DEFAULTS, ...raw };
  } catch {
    warn('config.json not found or unreadable — using defaults');
    return DEFAULTS;
  }
}

/* ─────────────── youtube ─────────────── */
async function accessToken(){
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  if (!r.ok) throw new Error('token refresh failed: ' + (await r.text()).slice(0, 200));
  return (await r.json()).access_token;
}

const yt = async (token, path) => {
  const r = await fetch('https://www.googleapis.com/youtube/v3/' + path, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!r.ok) throw new Error(`${path.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
};

async function pullStats(){
  if (!GOOGLE_REFRESH_TOKEN || !GOOGLE_CLIENT_SECRET){
    warn('YouTube secrets missing — the brief will have no performance data');
    return null;
  }
  const token = await accessToken();

  const ch = (await yt(token, 'channels?part=snippet,statistics,contentDetails&mine=true')).items?.[0];
  if (!ch) throw new Error('no channel on this account');

  const uploads = ch.contentDetails.relatedPlaylists.uploads;
  const list = await yt(token, `playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=30`);
  const ids = (list.items || []).map(i => i.contentDetails.videoId);

  let videos = [];
  if (ids.length){
    const v = await yt(token, `videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`);
    videos = (v.items || []).map(x => ({
      id: x.id,
      title: x.snippet.title,
      published: x.snippet.publishedAt,
      tags: x.snippet.tags || [],
      duration: x.contentDetails.duration,
      isShort: /PT(\d+S|[0-5]?\dS)$/.test(x.contentDetails.duration) ||
               /^PT([0-5]?\d)S$/.test(x.contentDetails.duration),
      views: Number(x.statistics.viewCount || 0),
      likes: Number(x.statistics.likeCount || 0),
      comments: Number(x.statistics.commentCount || 0)
    }));
  }

  return {
    title: ch.snippet.title,
    thumb: ch.snippet.thumbnails?.default?.url || null,
    subs: Number(ch.statistics.subscriberCount || 0),
    totalViews: Number(ch.statistics.viewCount || 0),
    videoCount: Number(ch.statistics.videoCount || 0),
    recent: videos.sort((a, b) => new Date(b.published) - new Date(a.published))
  };
}

/* ─────────────── analysis ─────────────── */
function analyse(stats){
  if (!stats?.recent?.length) return null;
  const v = stats.recent;
  const views = v.map(x => x.views).sort((a, b) => a - b);
  const median = views[Math.floor(views.length / 2)] || 0;
  const mean = Math.round(views.reduce((a, b) => a + b, 0) / views.length);

  const byViews = [...v].sort((a, b) => b.views - a.views);
  const shorts = v.filter(x => x.isShort);
  const longs = v.filter(x => !x.isShort);
  const avg = arr => arr.length ? Math.round(arr.reduce((a, x) => a + x.views, 0) / arr.length) : 0;

  // which tags show up on the videos that beat the median
  const tally = {};
  for (const x of v)
    for (const t of x.tags.map(s => s.toLowerCase()))
      (tally[t] ||= { n: 0, total: 0 }), tally[t].n++, tally[t].total += x.views;
  const tagRank = Object.entries(tally)
    .filter(([, d]) => d.n >= 2)
    .map(([t, d]) => ({ tag: t, uses: d.n, avgViews: Math.round(d.total / d.n) }))
    .sort((a, b) => b.avgViews - a.avgViews);

  const last14 = v.filter(x => (Date.now() - new Date(x.published)) < 14 * 864e5);
  const engage = x => x.views ? ((x.likes + x.comments) / x.views * 100) : 0;

  return {
    median, mean,
    top: byViews.slice(0, 5).map(x => ({ title: x.title, views: x.views, id: x.id, engagement: +engage(x).toFixed(2) })),
    weakest: byViews.slice(-3).map(x => ({ title: x.title, views: x.views })),
    shortsAvg: avg(shorts), longAvg: avg(longs),
    shortsCount: shorts.length, longCount: longs.length,
    uploadsLast14: last14.length,
    bestTags: tagRank.slice(0, 8),
    worstTags: tagRank.slice(-4).reverse()
  };
}

/* ─────────────── groq ─────────────── */
async function groq(messages, temperature = 0.9){
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  for (let attempt = 0; attempt < 3; attempt++){
    const r = await fetch(GROQ_BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_API_KEY },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature, response_format: { type: 'json_object' } })
    });
    if (r.ok) return JSON.parse((await r.json()).choices[0].message.content);
    if (r.status === 429 && attempt < 2){ warn('Groq rate limit, backing off'); await sleep(20000); continue; }
    throw new Error('Groq ' + r.status + ': ' + (await r.text()).slice(0, 200));
  }
}

async function think(cfg, stats, an){
  const context = an ? `
Channel: ${stats.title} — ${stats.subs} subscribers, ${stats.videoCount} videos, ${stats.totalViews} lifetime views.
Last ${stats.recent.length} uploads: median ${an.median} views, mean ${an.mean}.
Shorts: ${an.shortsCount} uploads averaging ${an.shortsAvg} views. Long videos: ${an.longCount} averaging ${an.longAvg}.
Uploads in the last 14 days: ${an.uploadsLast14}.
Best performers: ${an.top.map(t => `"${t.title}" ${t.views} views, ${t.engagement}% engagement`).join(' | ')}
Weakest: ${an.weakest.map(t => `"${t.title}" ${t.views} views`).join(' | ')}
Tags on the better videos: ${an.bestTags.map(t => `${t.tag} (${t.uses} uses, ${t.avgViews} avg)`).join(', ')}
` : 'No performance data available yet — this is a fresh setup.';

  return groq([
    { role: 'system', content:
      'You advise an independent Indian music and comedy creator, and you write their vertical Hindi comedy sketches. ' +
      'Reply with JSON only, exactly these keys: observations, suggestions, clips.\n' +
      '"observations": 2 to 4 short strings. Each is a concrete, specific thing the numbers actually show. ' +
      'Never invent a metric you were not given. If the data is thin, say so plainly instead of guessing. ' +
      'No praise, no filler, no "keep up the great work".\n' +
      '"suggestions": 2 to 4 short strings. Each is one specific action for the next few days, tied to an observation. ' +
      'Be willing to say stop doing something.\n' +
      '"clips": an array of sketch objects. Each has title, beats, caption, tags.\n' +
      '  - exactly 3 beats: setup, escalation, punchline\n' +
      '  - beat.line: one spoken Hindi sentence in Devanagari script, at most 9 words, natural and funny — not translated English\n' +
      '  - beat.scene: an English visual description of that moment for an image generator — action, expression, setting. Never mention text, letters or speech bubbles.\n' +
      '  - title: Hindi or Hinglish, under 60 characters\n' +
      '  - caption: one line of Hinglish for Instagram and Shorts\n' +
      '  - tags: 8 lowercase words, no # symbol\n' +
      'Keep everything family safe.' },
    { role: 'user', content:
      `${context}\n\nCast (must stay exactly this): ${cfg.castSheet}\nHumour: ${cfg.tone}\n` +
      (cfg.runningJoke ? `Running joke: ${cfg.runningJoke}\n` : '') +
      `\nWrite ${cfg.clipsPerDay} clips for tomorrow, and tell me what the numbers say.` }
  ]);
}

/* ─────────────── panel art ─────────────── */
async function panel(prompt, seed, file){
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
              `?width=1080&height=1920&nologo=true&seed=${seed}&model=flux`;
  for (let attempt = 0; attempt < 3; attempt++){
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const type = r.headers.get('content-type') || '';
      if (!type.startsWith('image/')) throw new Error('got ' + type);
      await writeFile(file, Buffer.from(await r.arrayBuffer()));
      return true;
    } catch (e){
      warn(`panel attempt ${attempt + 1}: ${e.message}`);
      if (attempt < 2) await sleep(10000 * (attempt + 1));
    }
  }
  return false;
}

/* ─────────────── main ─────────────── */
async function main(){
  const cfg = await loadConfig();
  say('config loaded —', cfg.clipsPerDay, 'clips,', cfg.handle);

  let stats = null;
  try { stats = await pullStats(); if (stats) say('channel:', stats.title, '·', stats.subs, 'subs'); }
  catch (e){ warn('stats unavailable:', e.message); }

  const an = analyse(stats);
  if (an) say('analysed', stats.recent.length, 'recent uploads — median', an.median, 'views');

  const think_ = await think(cfg, stats, an);
  const clips = (think_.clips || []).slice(0, cfg.clipsPerDay);
  say('wrote', clips.length, 'clips');

  await mkdir('data/panels', { recursive: true });
  for (const f of (existsSync('data/panels') ? await readdir('data/panels') : []))
    if (f.endsWith('.jpg')) await unlink('data/panels/' + f).catch(() => {});

  let made = 0, total = 0;
  for (let c = 0; c < clips.length; c++){
    clips[c].panels = [];
    for (let b = 0; b < (clips[c].beats || []).length; b++){
      total++;
      const file = `data/panels/${c}-${b}.jpg`;
      const prompt = `${cfg.castSheet} ${clips[c].beats[b].scene}. ${cfg.artStyle}. ` +
                     `No text, no letters, no watermark, no speech bubbles.`;
      process.stdout.write(`  panel ${c}-${b} … `);
      const ok = await panel(prompt, cfg.seed + b, file);
      console.log(ok ? 'ok' : 'failed');
      if (ok){ clips[c].panels.push(`data/panels/${c}-${b}.jpg`); made++; }
      await sleep(15500);
    }
  }
  say(`panels: ${made}/${total}`);

  const brief = {
    generatedAt: new Date().toISOString(),
    config: { handle: cfg.handle, castSheet: cfg.castSheet, artStyle: cfg.artStyle, seed: cfg.seed },
    channel: stats && {
      title: stats.title, thumb: stats.thumb, subs: stats.subs,
      totalViews: stats.totalViews, videoCount: stats.videoCount
    },
    analysis: an,
    observations: think_.observations || [],
    suggestions: think_.suggestions || [],
    clips,
    panelHealth: { made, total }
  };

  await writeFile('data/brief.json', JSON.stringify(brief, null, 2));
  say('wrote data/brief.json');
}

main().catch(e => { console.error('\nBrief failed:', e.message); process.exit(1); });
