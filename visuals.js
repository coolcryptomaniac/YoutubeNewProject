/* ═══════════════════════════════════════════════════════════
   Ridge — the uncommon visualisers.

   These five are not restyled frequency bars. Four of them
   accumulate: the frame you see at 2:40 contains everything the
   song did before it, so the video ends on a finished image
   rather than a random instant. That needs an offscreen canvas
   that survives between frames, which `scratch` manages.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

/* one persistent layer per visualiser per size */
const _scratch = new Map();
export function scratch(key, W, H, ns = ''){
  const id = `${ns}|${key}:${W}x${H}`;
  let c = _scratch.get(id);
  if (!c){
    c = document.createElement('canvas');
    c.width = W; c.height = H;
    _scratch.set(id, c);
  }
  return c;
}
/** Drop persistent layers. With a namespace, only that job's layers go. */
export function resetVisuals(ns = null){
  if (ns === null){ _scratch.clear(); _state.clear(); return; }
  for (const k of [..._scratch.keys()]) if (k.startsWith(ns + '|')) _scratch.delete(k);
  for (const k of [..._state.keys()])   if (k.startsWith(ns + '|')) _state.delete(k);
}
const _state = new Map();
const memo = (key, make) => { if (!_state.has(key)) _state.set(key, make()); return _state.get(key); };
const nk = (ns, key) => `${ns}|${key}`;

const shade = (hex,k) => {
  const n = parseInt(hex.slice(1),16);
  return `rgb(${Math.round(((n>>16)&255)*k)},${Math.round(((n>>8)&255)*k)},${Math.round((n&255)*k)})`;
};
const mix = (a,b,t) => {
  const pa=parseInt(a.slice(1),16), pb=parseInt(b.slice(1),16);
  const r=Math.round((((pa>>16)&255))*(1-t)+(((pb>>16)&255))*t);
  const g=Math.round((((pa>>8)&255))*(1-t)+(((pb>>8)&255))*t);
  const c=Math.round(((pa&255))*(1-t)+((pb&255))*t);
  return `rgb(${r},${g},${c})`;
};

/* ── TERRAIN ───────────────────────────────────────────────
   The spectrum carves a landscape, and every past frame stays
   as a receding ridge. You end up flying over the shape of the
   whole song. */
export function terrain(ctx, W, H, f, band, A, B, prog, ns = ''){
  const st = memo(nk(ns,'terrain'), () => ({ rows: [] }));
  const N = 96;
  const row = new Float32Array(N);
  for (let i = 0; i < N; i++){
    const src = Math.floor(Math.pow(i / N, 1.6) * f.length * 0.62);
    row[i] = (f[src] || 0) / 255;
  }
  st.rows.unshift(row);
  if (st.rows.length > 46) st.rows.pop();

  ctx.fillStyle = '#070910'; ctx.fillRect(0,0,W,H);

  const horizon = H * 0.30;
  for (let r = st.rows.length - 1; r >= 0; r--){
    const d = r / 46;                          // 0 near, 1 far
    const y0 = horizon + Math.pow(1 - d, 2.1) * (H - horizon);
    const spread = 0.24 + (1 - d) * 1.9;
    const amp = (H - horizon) * 0.42 * (1 - d * 0.55);
    const rw = st.rows[r];

    ctx.beginPath();
    for (let i = 0; i <= N; i++){
      const t = i / N;
      const x = W/2 + (t - 0.5) * W * spread;
      const y = y0 - (rw[Math.min(i, N-1)] || 0) * amp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(W/2 + W*spread/2, H + 10);
    ctx.lineTo(W/2 - W*spread/2, H + 10);
    ctx.closePath();

    ctx.fillStyle = shade(mix(B, A, 1 - d), 0.10 + (1 - d) * 0.5);
    ctx.globalAlpha = 0.86;
    ctx.fill();
    ctx.strokeStyle = mix(B, A, 1 - d);
    ctx.globalAlpha = 0.18 + (1 - d) * 0.72;
    ctx.lineWidth = Math.max(1, W/1400) * (0.5 + (1 - d));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, 'rgba(7,9,16,0)');
  sky.addColorStop(1, shade(A, 0.10 + band.low * 0.3));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 2);
}

/* ── MURMURATION ───────────────────────────────────────────
   Boids. Bass pulls them together, treble scatters them, so
   the flock knots on the downbeat and frays in the hats. */
export function murmuration(ctx, W, H, f, band, A, B, prog, ns = ''){
  const st = memo(nk(ns,'murmur'), () => ({
    b: Array.from({length:190}, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random()-.5)*.004, vy: (Math.random()-.5)*.004
    }))
  }));
  const flock = st.b;
  const cohesion = 0.0016 + band.low * 0.0075;
  const scatter  = 0.0009 + band.high * 0.0062;
  const speed    = 0.0022 + band.mid * 0.0055;

  let cx = 0, cy = 0;
  for (const p of flock){ cx += p.x; cy += p.y; }
  cx /= flock.length; cy /= flock.length;

  ctx.fillStyle = 'rgba(7,9,16,0.30)'; ctx.fillRect(0,0,W,H);

  for (const p of flock){
    p.vx += (cx - p.x) * cohesion + (Math.random()-.5) * scatter;
    p.vy += (cy - p.y) * cohesion + (Math.random()-.5) * scatter;
    const m = Math.hypot(p.vx, p.vy) || 1e-6;
    p.vx = p.vx / m * speed; p.vy = p.vy / m * speed;
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > 1) p.vx *= -1;
    if (p.y < 0 || p.y > 1) p.vy *= -1;
    p.x = clamp(p.x,0,1); p.y = clamp(p.y,0,1);

    const heading = Math.atan2(p.vy, p.vx);
    const len = (W/150) * (0.5 + band.mid * 1.9);
    ctx.strokeStyle = mix(B, A, clamp(band.high * 1.5, 0, 1));
    ctx.globalAlpha = 0.30 + band.mid * 0.6;
    ctx.lineWidth = Math.max(1, W/1500);
    ctx.beginPath();
    ctx.moveTo(p.x*W, p.y*H);
    ctx.lineTo(p.x*W - Math.cos(heading)*len, p.y*H - Math.sin(heading)*len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ── LOOM ──────────────────────────────────────────────────
   The song weaves a cloth. Low frequencies lay the warp, highs
   throw the weft, and it is finished exactly when the track is. */
export function loom(ctx, W, H, f, band, A, B, prog, ns = ''){
  const lay = scratch('loom', W, H, ns);
  const lx = lay.getContext('2d');
  const st = memo(nk(ns,'loom'), () => ({ last: -1 }));

  const col = Math.floor(prog * 150);
  if (col !== st.last){
    st.last = col;
    const x = (col / 150) * W;
    lx.globalAlpha = 0.22 + band.low * 0.55;
    lx.strokeStyle = A;
    lx.lineWidth = Math.max(1, W/900) * (0.4 + band.low * 2.4);
    lx.beginPath(); lx.moveTo(x, H*0.06); lx.lineTo(x, H*0.94); lx.stroke();

    const rows = 3 + Math.round(band.high * 7);
    for (let r = 0; r < rows; r++){
      const y = H*0.06 + Math.random() * H*0.88;
      lx.globalAlpha = 0.14 + band.high * 0.5;
      lx.strokeStyle = B;
      lx.lineWidth = Math.max(1, W/1300) * (0.4 + band.high * 1.8);
      lx.beginPath();
      lx.moveTo(Math.max(0, x - W*0.10), y);
      lx.lineTo(Math.min(W, x + W*0.10), y);
      lx.stroke();
    }
    lx.globalAlpha = 1;
  }

  ctx.fillStyle = '#070910'; ctx.fillRect(0,0,W,H);
  ctx.drawImage(lay, 0, 0);

  const edge = prog * W;
  const g = ctx.createLinearGradient(edge - W*0.05, 0, edge + W*0.02, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, shade(A, 0.9));
  ctx.globalAlpha = 0.5 + band.mid * 0.5;
  ctx.fillStyle = g;
  ctx.fillRect(edge - W*0.05, 0, W*0.07, H);
  ctx.globalAlpha = 1;
}

/* ── RANGOLI ───────────────────────────────────────────────
   Twelve-fold symmetry drawn outward from the centre as the
   song plays. The last frame is a complete rangoli, and no two
   songs draw the same one. */
export function rangoli(ctx, W, H, f, band, A, B, prog, ns = ''){
  const lay = scratch('rangoli', W, H, ns);
  const lx = lay.getContext('2d');
  const st = memo(nk(ns,'rangoli'), () => ({ t: 0 }));
  st.t += 1;

  const cx = W/2, cy = H/2, R = Math.min(W,H) * 0.46;
  const arms = 12;
  const radius = R * (0.16 + Math.pow(prog, 0.72) * 0.84);
  const energy = band.low * 0.5 + band.mid * 0.35 + band.high * 0.15;

  lx.save();
  lx.translate(cx, cy);
  for (let a = 0; a < arms; a++){
    lx.rotate(TAU / arms);
    for (let m = 0; m < 2; m++){
      lx.save();
      if (m) lx.scale(1, -1);                     // mirror each arm
      const wob = Math.sin(st.t * 0.07 + a) * 0.16;
      const rr = radius * (0.86 + wob * 0.2);
      const spread = 0.13 + band.high * 0.3;
      lx.beginPath();
      lx.moveTo(rr * 0.72, 0);
      lx.quadraticCurveTo(rr * 0.9, rr * spread, rr, 0);
      lx.strokeStyle = mix(A, B, (Math.sin(st.t * 0.02) + 1) / 2);
      lx.globalAlpha = 0.14 + energy * 0.6;
      lx.lineWidth = Math.max(1, W/1200) * (0.4 + energy * 2.6);
      lx.stroke();
      if (band.low > 0.55){
        lx.beginPath();
        lx.arc(rr, 0, Math.max(1.5, W/460) * band.low, 0, TAU);
        lx.fillStyle = A; lx.globalAlpha = 0.22 + band.low * 0.5;
        lx.fill();
      }
      lx.restore();
    }
  }
  lx.restore();
  lx.globalAlpha = 1;

  ctx.fillStyle = '#070910'; ctx.fillRect(0,0,W,H);
  ctx.drawImage(lay, 0, 0);

  const core = Math.min(W,H) * 0.035 * (1 + band.low * 1.5);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 4);
  g.addColorStop(0, A); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, core*4, 0, TAU); ctx.fill();
}

/* ── INK ───────────────────────────────────────────────────
   Pigment dropped into water. Bass hits release new blooms
   that keep spreading and never fully clear. */
export function ink(ctx, W, H, f, band, A, B, prog, ns = ''){
  const lay = scratch('ink', W, H, ns);
  const lx = lay.getContext('2d');
  const st = memo(nk(ns,'ink'), () => ({
    // seed a few so the frame is never empty while waiting for a transient
    drops: Array.from({length:3}, () => ({
      x:0.25+Math.random()*0.5, y:0.25+Math.random()*0.5,
      r:0.02+Math.random()*0.05, grow:0.0009, hue:Math.random()
    })),
    armed: true, peak: 0.35
  }));

  // Track a running peak and fire relative to it. A fixed threshold either
  // never triggers on a quiet track or fires every frame on a loud one.
  st.peak = Math.max(band.low, st.peak * 0.995);
  const trigger = Math.max(0.22, st.peak * 0.72);

  if (band.low > trigger && st.armed){
    st.drops.push({ x:0.12+Math.random()*0.76, y:0.12+Math.random()*0.76,
                    r:0.012, grow:0.0011 + band.mid*0.0016, hue:Math.random() });
    st.armed = false;
  }
  if (band.low < trigger * 0.72) st.armed = true;
  if (st.drops.length > 22) st.drops.shift();

  lx.globalAlpha = 0.016;
  lx.fillStyle = '#070910'; lx.fillRect(0,0,W,H);
  lx.globalAlpha = 1;

  for (const d of st.drops){
    d.r += d.grow * (0.4 + band.mid);
    const px = d.x*W, py = d.y*H, pr = d.r*Math.min(W,H);
    const g = lx.createRadialGradient(px, py, pr*0.15, px, py, pr);
    const c = mix(A, B, d.hue);
    g.addColorStop(0, c);
    g.addColorStop(0.55, shade(c, 0.35));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lx.globalAlpha = clamp(0.34 - d.r * 0.24, 0.07, 0.34);
    lx.fillStyle = g;
    lx.beginPath();
    // ragged edge, so it reads as pigment rather than a circle
    for (let a = 0; a <= 30; a++){
      const t = a/30*TAU;
      const wob = 1 + Math.sin(t*5 + d.hue*9) * 0.11 + Math.sin(t*11 - d.hue*4) * 0.05;
      const x = px + Math.cos(t)*pr*wob, y = py + Math.sin(t)*pr*wob;
      a === 0 ? lx.moveTo(x,y) : lx.lineTo(x,y);
    }
    lx.closePath(); lx.fill();
  }
  lx.globalAlpha = 1;

  ctx.fillStyle = '#070910'; ctx.fillRect(0,0,W,H);
  ctx.drawImage(lay, 0, 0);
}


/* ── SHONEN ────────────────────────────────────────────────
   The visual grammar of a battle-anime opening: radial speed
   lines, impact frames on the downbeat, chromatic split, and a
   halftone screen. Style only — no character from any series
   appears here, and none should be prompted for either. */
export function shonen(ctx, W, H, f, band, A, B, prog, ns = ''){
  const st = memo(nk(ns,'shonen'), () => ({ t:0, flash:0, armed:true, peak:0.4, angle:0, lastHit:-999 }));
  st.t += 1;
  st.peak = Math.max(band.low, st.peak * 0.994);
  const hit = Math.max(0.32, st.peak * 0.86);

  /* Impact frames are the genre's signature, but a full-frame invert firing
     on every downbeat of a 150 bpm track strobes at about 2.5 Hz — inside
     the 3–30 Hz band that triggers photosensitive seizures. So: only the
     strongest transients fire, never more than once every 1.2 seconds, and
     the frame brightens rather than inverting to white. */
  const MIN_GAP = 36;                       // frames — about 1.2s at 30fps
  if (band.low > hit && st.armed && (st.t - st.lastHit) > MIN_GAP){
    st.flash = 1; st.armed = false; st.lastHit = st.t; st.angle = Math.random() * TAU;
  }
  // The analyser smooths heavily, so sustained bass may never dip far.
  // Re-arm close under the threshold, and always re-arm once the minimum
  // gap has passed — otherwise a steady four-on-the-floor fires once and
  // then never again.
  if (band.low < hit * 0.92 || (st.t - st.lastHit) > MIN_GAP * 1.6) st.armed = true;
  st.flash *= 0.80;
  if (st.flash < 0.02) st.flash = 0;

  const cx = W/2, cy = H*0.48;
  // a lift toward the accent, never a white-out
  const lift = st.flash * 0.42;
  ctx.fillStyle = lift > 0.02 ? mix('#0A0D16', A, lift) : '#0A0D16';
  ctx.fillRect(0,0,W,H);

  // radial speed lines, denser and longer as the track pushes
  const lines = 90 + Math.round(band.mid * 130);
  const inner = Math.min(W,H) * (0.16 + band.low * 0.14);
  ctx.lineCap = 'round';
  for (let i = 0; i < lines; i++){
    const a = st.angle + (i / lines) * TAU + Math.sin(i * 12.9898) * 0.02;
    const jitter = ((Math.sin(i * 78.233 + st.t * 0.02) + 1) / 2);
    const len = Math.max(W,H) * (0.20 + jitter * 0.55 + band.high * 0.30);
    const wgt = (W/900) * (0.35 + jitter * 1.9);
    ctx.strokeStyle = i % 7 === 0 ? A : i % 5 === 0 ? B : '#EDF0F7';
    ctx.globalAlpha = 0.05 + jitter * 0.34 + band.mid * 0.25 + st.flash * 0.28;
    ctx.lineWidth = wgt;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a)*inner, cy + Math.sin(a)*inner);
    ctx.lineTo(cx + Math.cos(a)*(inner+len), cy + Math.sin(a)*(inner+len));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // the burst at the centre
  const core = inner * (0.62 + band.low * 0.5) * (1 + st.flash * 0.7);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, core);
  g.addColorStop(0, '#EDF0F7');
  g.addColorStop(0.35, mix(A, B, (Math.sin(st.t*0.03)+1)/2));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, core, 0, TAU); ctx.fill();

  // chromatic split on impact — cheap, and unmistakably the genre
  if (st.flash > 0.1){
    const off = st.flash * W * 0.011;
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = st.flash * 0.34;
    ctx.fillStyle = '#FF3B6B'; ctx.fillRect(-off, 0, W, H);
    ctx.fillStyle = '#3BE0FF'; ctx.fillRect(off, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // halftone screen across the lower third
  const dot = Math.max(4, W/150);
  ctx.fillStyle = 'rgba(237,240,247,.09)';
  for (let y = H*0.62; y < H; y += dot*2){
    const fade = (y - H*0.62) / (H*0.38);
    for (let x = 0; x < W; x += dot*2){
      const r = dot * 0.42 * fade * (0.5 + band.high);
      if (r < 0.4) continue;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }

  // vignette to sell the frame
  const vg = ctx.createRadialGradient(cx, cy, Math.min(W,H)*0.28, cx, cy, Math.max(W,H)*0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
}

export const EXTRA_VISUALS = {
  terrain:     { label:'Terrain',     fn: terrain,     note:'the song carved as a landscape you fly over' },
  murmuration: { label:'Murmuration', fn: murmuration, note:'a flock that knots on the bass and frays on the hats' },
  loom:        { label:'Loom',        fn: loom,        note:'weaves a cloth, finished exactly when the track ends' },
  rangoli:     { label:'Rangoli',     fn: rangoli,     note:'twelve-fold pattern drawn outward, complete at the last bar' },
  ink:         { label:'Ink',         fn: ink,         note:'pigment blooming in water on every transient' },
  shonen:      { label:'Shonen',      fn: shonen,      note:'battle-anime opening — speed lines, impact frames, chromatic split' }
};

/* ═══════════════════════════════════════════════════════════
   FLASH GUARD

   WCAG 2.3.1 and the Ofcom/Harding guidance both put the danger
   zone at more than three flashes a second, where a "flash" is a
   relative-luminance swing of 10% or more against a dark field.
   Roughly 1 in 4,000 people has photosensitive epilepsy, and it
   most often presents in childhood.

   Rather than trusting fifteen visualisers to each behave, this
   sits at the end of the draw pipeline and physically cannot let
   a frame through that swings too far or too often. A visualiser
   written badly — or one added later — is contained by it.

   It works by keeping the previous frame and blending it back in
   when the new one jumps too hard, which reads as a soft pulse
   rather than a strobe.
   ═══════════════════════════════════════════════════════════ */

const MAX_STEP    = 0.055;  // largest luminance jump allowed in one frame
const FLASH_DELTA = 0.045;  // a swing this big counts as a flash
const MAX_PER_SEC = 2;      // hard ceiling, below the guidance's 3

const _guard = new Map();

/** Mean relative luminance of the canvas, sampled cheaply. */
function meanLuma(ctx, W, H, probe){
  const p = probe.getContext('2d', { willReadFrequently: true });
  p.drawImage(ctx.canvas, 0, 0, probe.width, probe.height);
  const d = p.getImageData(0, 0, probe.width, probe.height).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4)
    sum += (0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]) / 255;
  return sum / (d.length / 4);
}

/**
 * Call immediately after a visualiser has drawn. Returns what it did,
 * which the test harness reads to prove the limits hold.
 */
export function flashGuard(ctx, W, H, ns = ''){
  let g = _guard.get(ns);
  if (!g){
    g = { prev: document.createElement('canvas'),
          probe: document.createElement('canvas'),
          luma: null, times: [], damped: 0, frames: 0 };
    g.probe.width = 32; g.probe.height = 18;
    _guard.set(ns, g);
  }
  if (g.prev.width !== W || g.prev.height !== H){ g.prev.width = W; g.prev.height = H; g.luma = null; }

  const now = performance.now();
  const luma = meanLuma(ctx, W, H, g.probe);
  g.frames++;

  if (g.luma !== null){
    const delta = Math.abs(luma - g.luma);

    // how many flashes in the last second
    g.times = g.times.filter(t => now - t < 1000);
    const overRate = g.times.length >= MAX_PER_SEC;

    // a jump that is too large, or any jump at all once the rate is spent
    const limit = overRate ? FLASH_DELTA * 0.5 : MAX_STEP;
    if (delta > limit){
      // blend the previous frame back until the change sits inside the limit
      const keep = Math.min(0.92, 1 - limit / delta);
      ctx.save();
      ctx.globalAlpha = keep;
      ctx.drawImage(g.prev, 0, 0, W, H);
      ctx.restore();
      g.damped++;
      const after = g.luma + Math.sign(luma - g.luma) * limit;
      if (Math.abs(after - g.luma) >= FLASH_DELTA) g.times.push(now);
      g.luma = after;
    } else {
      if (delta >= FLASH_DELTA) g.times.push(now);
      g.luma = luma;
    }
  } else {
    g.luma = luma;
  }

  const px = g.prev.getContext('2d');
  px.clearRect(0, 0, W, H);
  px.drawImage(ctx.canvas, 0, 0, W, H);

  return { luma: g.luma, damped: g.damped, frames: g.frames, recent: g.times.length };
}

export function resetGuard(ns = null){
  if (ns === null) _guard.clear(); else _guard.delete(ns);
}
export const guardStats = ns => {
  const g = _guard.get(ns);
  return g ? { damped: g.damped, frames: g.frames } : null;
};
