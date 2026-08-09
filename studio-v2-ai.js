'use strict';
import {freeEligibleModels,normalizeModel} from './studio-v2-core.js';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
function timeoutSignal(ms){const c=new AbortController(),id=setTimeout(()=>c.abort(new DOMException('Timed out','TimeoutError')),ms);return{signal:c.signal,done:()=>clearTimeout(id)}}
async function fetchTimeout(url,opts={},ms=180000){const t=timeoutSignal(ms);try{return await fetch(url,{...opts,signal:t.signal})}finally{t.done()}}
const auth=key=>key?{Authorization:'Bearer '+key}:{};
function jsonOnly(text){const t=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t)}
function bodyError(text=''){try{const j=JSON.parse(text);return j?.error?.message||j?.message||text}catch{return text}}

export class PollinationsClient{
  constructor({key='',textModel='',imageModel='',videoModel='',musicModel='',freeOnly=true}={}){this.key=String(key||'').trim();this.textModel=textModel;this.imageModel=imageModel;this.videoModel=videoModel;this.musicModel=musicModel;this.freeOnly=freeOnly!==false;this.catalogCache=new Map()}
  requireBrowserKey(){if(!this.key)throw new Error('Add a Pollinations browser/app key first.');if(this.key.startsWith('sk_'))throw new Error('Secret sk_ keys are blocked in GitHub Pages. Use a browser-safe/app authorization key.');if(!this.key.startsWith('pk_'))throw new Error('V2 accepts browser-safe Pollinations pk_ keys only on this static page.')}
  async validateKey(){this.requireBrowserKey();const r=await fetchTimeout('https://gen.pollinations.ai/account/key',{headers:auth(this.key)},30000);if(!r.ok)throw new Error(`Pollinations key rejected (${r.status}): ${bodyError((await r.text()).slice(0,200))}`);return r.json()}
  endpoint(kind){return kind==='text'?'/text/models':kind==='audio'||kind==='music'?'/audio/models':'/image/models'}
  async models(kind,{refresh=false}={}){
    const k=kind==='music'?'audio':kind;
    if(!refresh&&this.catalogCache.has(k))return this.catalogCache.get(k);
    const headers=this.key?auth(this.key):{};
    const r=await fetchTimeout('https://gen.pollinations.ai'+this.endpoint(k),{headers},30000);
    if(!r.ok)throw new Error(`Could not load ${k} model catalogue (${r.status}).`);
    const j=await r.json(),list=Array.isArray(j)?j:(j.data||j.models||[]);
    this.catalogCache.set(k,list);return list;
  }
  async freeModels(kind,{refresh=false}={}){return freeEligibleModels(await this.models(kind,{refresh}),kind)}
  async assertFree(kind,id){
    if(!this.freeOnly)return id;
    const list=await this.freeModels(kind);
    const hit=list.find(x=>x.id===id);
    if(hit)return id;
    throw new Error(`Free-tier lock blocked ${id||kind}: it is not listed as a free-tier-eligible ${kind} model for this key. No paid fallback was attempted.`)
  }
  async preferred(kind,candidates=[]){
    const list=await this.freeModels(kind),ids=new Set(list.map(x=>x.id));
    return candidates.find(x=>ids.has(x))||list[0]?.id||'';
  }
  async chat(messages,{model=this.textModel,temperature=.78}={}){
    this.requireBrowserKey();if(this.freeOnly)await this.assertFree('text',model);
    const r=await fetchTimeout('https://gen.pollinations.ai/v1/chat/completions',{method:'POST',headers:{...auth(this.key),'Content-Type':'application/json'},body:JSON.stringify({model,messages,temperature})},300000);
    if(!r.ok){const t=await r.text();if(r.status===402||r.status===403)throw new Error(`Free-tier text unavailable (${r.status}); paid fallback is disabled.`);throw new Error(`AI text ${r.status}: ${bodyError(t).slice(0,180)}`)}
    const j=await r.json();return j.choices?.[0]?.message?.content||''
  }
  async packageTrack({trackName,theme,template,language,duration=120,sceneCount=6}){
    const prompt=`Create a premium ORIGINAL music-video production package. Return JSON only.\nTrack working name: ${trackName||'Untitled'}\nTheme/story: ${theme||'open emotional theme'}\nLanguage: ${language}\nTarget duration: ${duration}s\nMusic direction: ${template.music}\nVisual direction: ${template.look}\n\nSchema: {"song_title":"memorable original title","song_prompt":"detailed generation prompt under 900 chars; no living artist names","lyrics":"original structured lyrics with [Verse], [Pre-Chorus], [Chorus], [Bridge] markers; empty if instrumental","youtube_title":"truthful high-curiosity title under 70 chars","description":"strong first 2 lines, story/context, credits placeholders, 3-5 hashtags","tags":["12-18 relevant tags"],"thumbnail_headline":"2-5 words","thumbnail_prompt":"cinematic 16:9, one unmistakable focal subject, dramatic lighting, negative space for headline, no text/logo/watermark","scene_prompts":["exactly ${sceneCount} visually coherent but compositionally varied 16:9 scenes with camera/lens/lighting details, no text/logo/watermark"],"pinned_comment":"natural question"}. Avoid generic AI filler and copyrighted characters.`;
    const out=jsonOnly(await this.chat([{role:'system',content:'You are a world-class music-video creative director, lyricist and YouTube packaging editor. Output valid JSON only.'},{role:'user',content:prompt}],{temperature:.82}));
    out.tags=Array.isArray(out.tags)?out.tags:[];out.scene_prompts=Array.isArray(out.scene_prompts)?out.scene_prompts:[];return out
  }
  async generateImage(prompt,{width=1280,height=720,model=this.imageModel,seed=-1,safe=true}={}){
    if(this.key){this.requireBrowserKey();if(this.freeOnly)await this.assertFree('image',model);const q=new URLSearchParams({model,width:String(width),height:String(height),safe:String(!!safe)});if(seed>=0)q.set('seed',String(seed));const r=await fetchTimeout(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}`,{headers:auth(this.key)},600000);if(!r.ok){const t=await r.text();if(r.status===402||r.status===403)throw new Error(`Free-tier image unavailable (${r.status}); no paid fallback.`);throw new Error(`AI image ${r.status}: ${bodyError(t).slice(0,170)}`)}const b=await r.blob();if(!b.type.startsWith('image/'))throw new Error('Image generator returned invalid data.');return b}
    const u=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&model=flux&seed=${seed<0?Math.floor(Math.random()*1e9):seed}`;
    const r=await fetchTimeout(u,{},600000);if(!r.ok)throw new Error(`Anonymous free image generation unavailable (${r.status}).`);const b=await r.blob();if(!b.type.startsWith('image/'))throw new Error('Anonymous image endpoint returned invalid data.');return b
  }
  async generateVideo(prompt,{model=this.videoModel,duration=5,aspectRatio='16:9',audio=false,seed=-1}={}){
    this.requireBrowserKey();if(this.freeOnly)await this.assertFree('video',model);let d=Math.max(2,Number(duration)||5);const q=new URLSearchParams({model,duration:String(d),aspectRatio,audio:String(!!audio),safe:'true'});if(seed>=0)q.set('seed',String(seed));const r=await fetchTimeout(`https://gen.pollinations.ai/video/${encodeURIComponent(String(prompt||'').slice(0,1800))}?${q}`,{headers:auth(this.key)},1200000);if(!r.ok){const t=await r.text();if(r.status===402||r.status===403)throw new Error(`Free-tier video unavailable (${r.status}); no paid fallback.`);throw new Error(`AI video ${r.status}: ${bodyError(t).slice(0,180)}`)}const b=await r.blob();if(!b.type.startsWith('video/'))throw new Error('AI video returned invalid data.');return b
  }
  async generateMusic(prompt,{model=this.musicModel,duration=120,instrumental=false,seed=-1}={}){
    this.requireBrowserKey();if(this.freeOnly)await this.assertFree('audio',model);const input=String(prompt||'').trim().slice(0,4096);if(!input)throw new Error('Music prompt is empty.');const body={model,input,response_format:'mp3',safe:true,duration:Math.min(300,Math.max(3,Number(duration)||120)),instrumental:!!instrumental};if(seed>=0)body.seed=seed;
    const r=await fetchTimeout('https://gen.pollinations.ai/v1/audio/speech',{method:'POST',headers:{...auth(this.key),'Content-Type':'application/json'},body:JSON.stringify(body)},1200000);
    if(!r.ok){const t=await r.text();if(r.status===402||r.status===403)throw new Error(`No free-tier music generation is available for ${model||'the selected model'} (${r.status}). Paid fallback is disabled; upload a song or use Suno Assist.`);throw new Error(`AI music ${r.status}: ${bodyError(t).slice(0,180)}`)}const b=await r.blob();if(!b.type.startsWith('audio/'))throw new Error('Music generator returned invalid audio.');return b
  }
}

export function deterministicPackage({trackName='Untitled',theme='',template,sceneCount=6,language='English'}){
  const base=trackName||'Untitled',topic=theme||template.name;
  return {song_title:base,song_prompt:`${template.music}. Theme: ${topic}. Original composition, clear intro, development and ending.`,lyrics:'',youtube_title:`${base} — Original Music Video`,description:`${base}\n\nAn original music visual shaped around ${topic}.\n\n🎵 Music: [credits]\n🎬 Visuals: Ridge Studio V2\n\n#music #musicvideo #visualizer`,tags:['music','music video','visualizer',template.name.toLowerCase(),...String(topic).toLowerCase().split(/\W+/).filter(Boolean).slice(0,6)],thumbnail_headline:base.split(/\s+/).slice(0,4).join(' '),thumbnail_prompt:`Premium cinematic 16:9 music-video thumbnail, ${template.look}, one strong focal subject, dramatic lighting, clean negative space, no text, no logo, no watermark`,scene_prompts:Array.from({length:sceneCount},(_,i)=>`${template.look}, cinematic 16:9 shot ${i+1}, ${topic}, distinct camera angle and depth, cohesive color story, no text, logo or watermark`),pinned_comment:'Which moment of the track stayed with you after the first listen?',language}
}
