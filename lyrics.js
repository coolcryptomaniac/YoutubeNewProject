/* ═══════════════════════════════════════════════════════════
   Ridge — kinetic lyric templates.

   Each renderer receives the line that is currently being sung,
   which word inside it is landing right now, and the audio bands,
   so the type moves with the voice rather than on a timer.

   Everything here draws over whatever is already on the canvas —
   footage, scene art or a visualiser — and every one of them
   still passes through the flash guard afterwards.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const ease  = t => 1 - Math.pow(1 - clamp(t,0,1), 3);
const easeBack = t => { const c=1.70158+1; const x=clamp(t,0,1);
  return 1 + (c+1)*Math.pow(x-1,3) + c*Math.pow(x-1,2); };

/** Largest size that fits the line, wrapped to at most two rows. */
function fit(ctx, text, maxW, maxSize, font){
  let size = maxSize;
  for (; size > maxSize*0.32; size -= 2){
    ctx.font = `800 ${size}px ${font}`;
    if (ctx.measureText(text).width <= maxW) return { size, rows:[text] };
  }
  // still too long — split near the middle on a space
  const words = text.split(/\s+/);
  let best = Math.ceil(words.length/2);
  const a = words.slice(0,best).join(' '), b = words.slice(best).join(' ');
  size = maxSize*0.78;
  for (; size > maxSize*0.28; size -= 2){
    ctx.font = `800 ${size}px ${font}`;
    if (Math.max(ctx.measureText(a).width, ctx.measureText(b).width) <= maxW) break;
  }
  return { size, rows:[a,b] };
}

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";
const DEVA = "'Noto Sans Devanagari', 'Bricolage Grotesque', sans-serif";
const isDeva = s => /[\u0900-\u097F]/.test(s);

function scrim(ctx,W,H,strength=0.55){
  const g = ctx.createLinearGradient(0,H,0,H*0.35);
  g.addColorStop(0,`rgba(10,13,22,${strength})`);
  g.addColorStop(1,'rgba(10,13,22,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
}

/* ── KARAOKE — the line sits, and fills word by word as it is sung ── */
function karaoke(ctx,W,H,cur,band,A,B){
  const font = isDeva(cur.line.text) ? DEVA : FONT;
  scrim(ctx,W,H,0.62);
  const { size, rows } = fit(ctx, cur.line.text, W*0.86, W/15, font);
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign='center'; ctx.textBaseline='alphabetic';
  const lh = size*1.14;
  let y = H*0.80 - (rows.length-1)*lh;

  for (const row of rows){
    // unsung
    ctx.fillStyle='rgba(237,240,247,.34)';
    ctx.fillText(row, W/2, y);
    // sung portion, clipped left to right
    const words = cur.line.words;
    const upto = cur.wordIndex >= 0 ? cur.wordIndex : words.findIndex(w=>w.start>0)-1;
    const frac = clamp((upto+1)/Math.max(1,words.length),0,1);
    const rowW = ctx.measureText(row).width;
    ctx.save();
    ctx.beginPath();
    ctx.rect(W/2-rowW/2, y-size, rowW*frac, size*1.4);
    ctx.clip();
    ctx.fillStyle=A; ctx.fillText(row, W/2, y);
    ctx.restore();
    y += lh;
  }
  ctx.textAlign='left';
}

/* ── SPOTLIGHT — the word being sung is large, the rest recede ── */
function spotlight(ctx,W,H,cur,band,A,B){
  const words = cur.line.words;
  if (!words.length) return;
  const font = isDeva(cur.line.text) ? DEVA : FONT;
  scrim(ctx,W,H,0.5);
  const base = W/26;
  ctx.textAlign='center'; ctx.textBaseline='middle';

  const BIG = 1.42;
  // Measure every word at the size it will actually be drawn — the live
  // word is enlarged, and laying out at base size makes it overlap its
  // neighbour.
  const sizes = words.map((_,i) => base * (i === cur.wordIndex ? BIG : 1));
  const widths = words.map((w,i) => {
    ctx.font = `800 ${sizes[i]}px ${font}`;
    return ctx.measureText(w.w).width;
  });
  const gap = base*0.42;
  const total = widths.reduce((a,b)=>a+b,0) + gap*(words.length-1);
  const scale = Math.min(1, (W*0.88)/total);
  let x = W/2 - (total*scale)/2;

  words.forEach((w,i)=>{
    const live = i === cur.wordIndex;
    const done = cur.wordIndex >= 0 && i < cur.wordIndex;
    const size = sizes[i]*scale;
    ctx.font = `800 ${size}px ${font}`;
    ctx.fillStyle = live ? A : done ? 'rgba(237,240,247,.78)' : 'rgba(237,240,247,.30)';
    if (live){ ctx.shadowColor = A; ctx.shadowBlur = size*0.45; }
    ctx.fillText(w.w, x + widths[i]*scale/2, H*0.76);
    ctx.shadowBlur = 0;
    x += widths[i]*scale + gap*scale;
  });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

/* ── CASCADE — each word drops in and settles on its own beat ── */
function cascade(ctx,W,H,cur,band,A,B,t){
  const words = cur.line.words;
  if (!words.length) return;
  const font = isDeva(cur.line.text) ? DEVA : FONT;
  scrim(ctx,W,H,0.5);
  const base = W/22;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `800 ${base}px ${font}`;
  const widths = words.map(w=>ctx.measureText(w.w).width);
  const gap = base*0.36;
  const total = widths.reduce((a,b)=>a+b,0)+gap*(words.length-1);
  const scale = Math.min(1,(W*0.86)/total);
  let x = W/2-(total*scale)/2;

  words.forEach((w,i)=>{
    const age = t - w.start;
    if (age < -0.05){ x += widths[i]*scale+gap*scale; return; }
    const e = easeBack(clamp(age/0.30,0,1));
    const drop = (1-e)*H*0.14;
    const alpha = clamp(age/0.16,0,1) * (t > cur.line.end+0.2 ? clamp(1-(t-cur.line.end-0.2)/0.4,0,1) : 1);
    ctx.font = `800 ${base*scale}px ${font}`;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i===cur.wordIndex ? A : '#EDF0F7';
    ctx.fillText(w.w, x+widths[i]*scale/2, H*0.74 - drop);
    ctx.globalAlpha = 1;
    x += widths[i]*scale+gap*scale;
  });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

/* ── TYPEWRITER — characters appear in time with the words ── */
function typewriter(ctx,W,H,cur,band,A,B,t){
  const font = isDeva(cur.line.text) ? DEVA : FONT;
  scrim(ctx,W,H,0.66);
  const words = cur.line.words;
  let shown = '';
  for (const w of words){
    if (t >= w.end) shown += (shown?' ':'') + w.w;
    else if (t >= w.start){
      const f = clamp((t-w.start)/Math.max(0.05,w.end-w.start),0,1);
      shown += (shown?' ':'') + w.w.slice(0, Math.ceil(w.w.length*f));
      break;
    } else break;
  }
  const { size, rows } = fit(ctx, cur.line.text, W*0.84, W/17, font);
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign='left';
  const lh=size*1.16;
  let y = H*0.78-(rows.length-1)*lh;
  const x = W*0.09;
  ctx.fillStyle='#EDF0F7';
  ctx.fillText(shown, x, y);
  // caret
  if (t < cur.line.end){
    const cw = ctx.measureText(shown).width;
    ctx.fillStyle=A;
    ctx.globalAlpha = 0.4+0.6*Math.abs(Math.sin(t*4));
    ctx.fillRect(x+cw+size*0.1, y-size*0.78, size*0.07, size*0.86);
    ctx.globalAlpha=1;
  }
}

/* ── STACK — sung lines pile up the frame, the newest brightest ── */
function stack(ctx,W,H,cur,band,A,B,t,lyric){
  const font = isDeva(cur.line.text) ? DEVA : FONT;
  scrim(ctx,W,H,0.6);
  const size = W/34;
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign='left';
  const lh = size*1.5;
  const show = 5;
  const from = Math.max(0, cur.index-show+1);
  let y = H*0.80;
  for (let i=cur.index; i>=from; i--){
    const depth = cur.index-i;
    ctx.globalAlpha = depth===0 ? 1 : clamp(0.62-depth*0.14,0.06,1);
    ctx.fillStyle = depth===0 ? A : '#EDF0F7';
    ctx.font = `800 ${depth===0?size*1.28:size}px ${font}`;
    ctx.fillText(lyric.lines[i].text, W*0.09, y);
    y -= depth===0 ? lh*1.24 : lh;
    ctx.globalAlpha=1;
  }
}

/* ── PULSE — one line, breathing with the low end ── */
function pulseLine(ctx,W,H,cur,band,A,B,t){
  const font = isDeva(cur.line.text) ? DEVA : FONT;
  scrim(ctx,W,H,0.55);
  const { size, rows } = fit(ctx, cur.line.text, W*0.82, W/13, font);
  const grow = 1 + band.low*0.06;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const lh = size*grow*1.1;
  let y = H*0.5-(rows.length-1)*lh/2;
  const inAge = clamp((t-cur.line.start)/0.28,0,1);
  ctx.globalAlpha = ease(inAge);
  for (const row of rows){
    ctx.font = `800 ${size*grow}px ${font}`;
    ctx.lineJoin='round'; ctx.lineWidth=size*0.16;
    ctx.strokeStyle='rgba(10,13,22,.72)'; ctx.strokeText(row,W/2,y);
    const g = ctx.createLinearGradient(0,y-size,0,y+size);
    g.addColorStop(0,'#EDF0F7'); g.addColorStop(1,A);
    ctx.fillStyle=g; ctx.fillText(row,W/2,y);
    y += lh;
  }
  ctx.globalAlpha=1;
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
}

export const LYRIC_STYLES = {
  karaoke:    { label:'Karaoke',    fn:karaoke,    note:'the line waits and fills word by word as it is sung' },
  spotlight:  { label:'Spotlight',  fn:spotlight,  note:'the word landing right now grows and glows' },
  cascade:    { label:'Cascade',    fn:cascade,    note:'each word drops in and settles on its own beat' },
  typewriter: { label:'Typewriter', fn:typewriter, note:'characters appear in time with the voice' },
  stack:      { label:'Stack',      fn:stack,      note:'sung lines pile up the frame, newest brightest' },
  pulse:      { label:'Pulse',      fn:pulseLine,  note:'one big line, breathing with the low end' }
};

export function drawLyrics(ctx,W,H,lyric,cur,band,A,B,t,style){
  const s = LYRIC_STYLES[style] || LYRIC_STYLES.karaoke;
  if (!cur) return false;
  s.fn(ctx,W,H,cur,band,A,B,t,lyric);
  return true;
}
