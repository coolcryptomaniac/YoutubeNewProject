import assert from 'node:assert/strict';
import {EXTRA_TEMPLATES,EXTRA_VISUALS,THEME_PACKS} from '../studio-v2-creative.js';
import {generateLocalMusic,localMusicPreset} from '../studio-v2-music.js';
import {chooseFile,pexelsCreditLine} from '../studio-v2-stock.js';
import {GROQ_MODEL} from '../studio-v2-groq.js';

assert.equal(EXTRA_TEMPLATES.length,12);
assert.equal(Object.keys(EXTRA_VISUALS).length,10);
assert.equal(THEME_PACKS.length,12);
assert.equal(GROQ_MODEL,'llama-3.1-8b-instant');
assert.ok(EXTRA_TEMPLATES.some(x=>x.id==='rain-temple'));
assert.ok(EXTRA_TEMPLATES.some(x=>x.id==='ninja-storm'));
assert.ok(EXTRA_TEMPLATES.every(x=>!JSON.stringify(x).toLowerCase().includes('naruto')),'use original anime worlds, not copyrighted franchise prompts');

const freq=new Uint8Array(512);for(let i=0;i<freq.length;i++)freq[i]=(i*23)%256;
const td=new Uint8Array(1024);td.fill(128);
function numeric(args,name){for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${name}: nonfinite ${a}`)}
const grad=()=>({addColorStop(offset,color){assert.ok(Number.isFinite(Number(offset)));assert.ok(!String(color).includes('NaN'))}});
const methods=new Set(['save','restore','beginPath','closePath','fill','stroke','fillRect','strokeRect','moveTo','lineTo','arc','ellipse','rect','translate','rotate','scale']);
const ctx=new Proxy({}, {get(_t,p){if(p==='createLinearGradient'||p==='createRadialGradient')return(...a)=>{numeric(a,String(p));return grad()};if(methods.has(p))return(...a)=>numeric(a,String(p));return undefined},set(_t,p,v){if(typeof v==='number')assert.ok(Number.isFinite(v),`${String(p)} nonfinite`);if(typeof v==='string')assert.ok(!v.includes('NaN'),`${String(p)} invalid color`);return true}});
const poison={time:NaN,progress:Infinity,low:undefined,mid:NaN,high:Infinity,energy:-Infinity,A:'#ffc96a',B:'#8be0c5',C:'#07111c'};
for(const [id,v] of Object.entries(EXTRA_VISUALS))assert.doesNotThrow(()=>v.draw(ctx,960,540,freq,td,poison),`${id} must survive poisoned render state`);

const picked=chooseFile([{link:'small',file_type:'video/mp4',width:640,height:360},{link:'hd',file_type:'video/mp4',width:1920,height:1080},{link:'4k',file_type:'video/mp4',width:3840,height:2160}]);
assert.equal(picked.link,'hd');
const credit=pexelsCreditLine([{creator:'A',creatorUrl:'https://example.com/a'},{creator:'A',creatorUrl:'https://example.com/a'},{creator:'B',creatorUrl:'https://example.com/b'}]);
assert.match(credit,/Videos provided by Pexels/);assert.equal((credit.match(/•/g)||[]).length,2);

assert.equal(localMusicPreset('rain-temple').style,'rain');
assert.equal(localMusicPreset('ninja-storm').style,'ninja');
const wav=await generateLocalMusic({duration:12,style:'rain',seed:'test',tempo:82});
assert.equal(wav.type,'audio/wav');assert.ok(wav.size>1000000,'local track should contain real PCM audio');
const head=Buffer.from(await wav.slice(0,12).arrayBuffer()).toString('ascii');assert.equal(head.slice(0,4),'RIFF');assert.equal(head.slice(8,12),'WAVE');

console.log('studio-v2-plus-selftest: PASS — 10 visuals, 12 themes, local WAV, Pexels helpers');
