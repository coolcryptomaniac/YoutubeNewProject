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
export function scratch(key, W, H){
  const id = `${key}:${W}x${H}`;
  let c = _scratch.get(id);
  if (!c){
    c = document.createElement('canvas');
    c.width = W; c.height = H;
    _scratch.set(id, c);
  }
  return c;
}
export function resetVisuals(){ _scratch.clear(); _state.clear(); }
const _state = new Map();
const memo = (key, make) => { if (!_state.has(key)) _state.set(key, make()); return _state.get(key); };

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
export function terrain(ctx, W, H, f, band, A, B, prog){
  const st = memo('terrain', () => ({ rows: [] }));
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
export function murmuration(ctx, W, H, f, band, A, B, prog){
  const st = memo('murmur', () => ({
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
export function loom(ctx, W, H, f, band, A, B, prog){
  const lay = scratch('loom', W, H);
  const lx = lay.getContext('2d');
  const st = memo('loom', () => ({ last: -1 }));

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
export function rangoli(ctx, W, H, f, band, A, B, prog){
  const lay = scratch('rangoli', W, H);
  const lx = lay.getContext('2d');
  const st = memo('rangoli', () => ({ t: 0 }));
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
export function ink(ctx, W, H, f, band, A, B, prog){
  const lay = scratch('ink', W, H);
  const lx = lay.getContext('2d');
  const st = memo('ink', () => ({
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

export const EXTRA_VISUALS = {
  terrain:     { label:'Terrain',     fn: terrain,     note:'the song carved as a landscape you fly over' },
  murmuration: { label:'Murmuration', fn: murmuration, note:'a flock that knots on the bass and frays on the hats' },
  loom:        { label:'Loom',        fn: loom,        note:'weaves a cloth, finished exactly when the track ends' },
  rangoli:     { label:'Rangoli',     fn: rangoli,     note:'twelve-fold pattern drawn outward, complete at the last bar' },
  ink:         { label:'Ink',         fn: ink,         note:'pigment blooming in water on every transient' }
};
