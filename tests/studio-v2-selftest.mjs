import assert from 'node:assert/strict';
import {
  audioBands, rgbaFromHex, sanitizeRenderState,
  buildLyricsTimeline, lyricAt, freeEligibleModels, makeChunkPlan
} from '../studio-v2-core.js';
import {VISUALS,TEMPLATES} from '../studio-v2-visuals.js';
import {PollinationsClient} from '../studio-v2-ai.js';

const freq=new Uint8Array(512);
for(let i=0;i<freq.length;i++)freq[i]=(i*37)%256;
const td=new Uint8Array(1024);td.fill(128);
const b=audioBands(freq);
for(const k of ['low','mid','high','energy'])assert.ok(Number.isFinite(b[k]), `${k} must be finite`);

const rgba=rgbaFromHex('#ffc96a',NaN);
assert.equal(rgba,'rgba(255,201,106,1)');
assert.ok(!rgba.includes('NaN'));

const s=sanitizeRenderState({low:undefined,mid:NaN,high:Infinity,energy:-Infinity,time:NaN,progress:Infinity});
for(const k of ['low','mid','high','energy','time','progress'])assert.ok(Number.isFinite(s[k]), `render ${k} must be finite`);
assert.ok(s.progress>=0&&s.progress<=1);

function numericArgs(args,name){for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${name} received ${a}`)}
const gradient=()=>({addColorStop(offset,color){assert.ok(Number.isFinite(Number(offset)),'gradient offset finite');assert.ok(!String(color).includes('NaN'),`invalid gradient color ${color}`)}});
const methods=new Set(['save','restore','beginPath','closePath','fill','stroke','clearRect','fillRect','strokeRect','moveTo','lineTo','arc','ellipse','rect','translate','rotate','scale']);
const fakeCtx=new Proxy({}, {
  get(_t,p){
    if(p==='createLinearGradient'||p==='createRadialGradient')return (...args)=>{numericArgs(args,String(p));return gradient()};
    if(methods.has(p))return (...args)=>numericArgs(args,String(p));
    return undefined;
  },
  set(_t,p,v){
    if(typeof v==='number')assert.ok(Number.isFinite(v),`${String(p)} must be finite`);
    if((p==='fillStyle'||p==='strokeStyle'||p==='shadowColor')&&typeof v==='string')assert.ok(!v.includes('NaN'),`${String(p)} invalid: ${v}`);
    return true;
  }
});
const poison={time:NaN,progress:Infinity,low:undefined,mid:NaN,high:Infinity,energy:-Infinity,A:'#ffc96a',B:'#8be0c5',C:'#203b62'};
for(const [id,v] of Object.entries(VISUALS))assert.doesNotThrow(()=>v.draw(fakeCtx,960,540,freq,td,poison),`${id} visualizer must sanitize invalid state`);
assert.equal(Object.keys(VISUALS).length,20,'expected 20 visualizers');
assert.ok(TEMPLATES.length>=20,'expected at least 20 templates');

const lyrics='[Verse]\nFirst line of the song\nSecond line is here\n[Chorus]\nThis is the chorus\nSing it once again';
const tl=buildLyricsTimeline(lyrics,120);
assert.equal(tl.length,4);
for(let i=0;i<tl.length;i++){
  assert.ok(Number.isFinite(tl[i].start)&&Number.isFinite(tl[i].end));
  assert.ok(tl[i].end>tl[i].start);
  if(i)assert.ok(tl[i].start>=tl[i-1].end-.001);
}
assert.equal(lyricAt((tl[1].start+tl[1].end)/2,tl).index,1);

const total=25*1024*1024+12345,plan=makeChunkPlan(total,8*1024*1024);
assert.ok(plan.length>=4);let next=0;
for(let i=0;i<plan.length;i++){
  const p=plan[i];assert.equal(p.start,next);assert.equal(p.end-p.start+1,p.size);
  if(i<plan.length-1)assert.equal(p.size%(256*1024),0);
  next=p.end+1;
}
assert.equal(next,total);

const free=freeEligibleModels([
  {id:'free-one',paid_only:false,output_modalities:['text']},
  {id:'paid-one',paid_only:true,output_modalities:['text']},
  {id:'free-image',paid_only:false,output_modalities:['image']},
],'text');
assert.deepEqual(free.map(x=>x.id),['free-one']);
const pc=new PollinationsClient({freeOnly:true});
assert.equal(pc.endpoint('video'),'/image/models','Pollinations video catalogue lives in image/models');

console.log('studio-v2-selftest: PASS — NaN guard 20/20, lyrics, free-tier filter, chunk plan');
