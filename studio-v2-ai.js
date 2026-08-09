'use strict';

function timeoutSignal(ms){const c=new AbortController(),id=setTimeout(()=>c.abort(new DOMException('Timed out','TimeoutError')),ms);return {signal:c.signal,done:()=>clearTimeout(id)};}
async function fetchWithTimeout(url,opts={},ms=180000){const t=timeoutSignal(ms);try{return await fetch(url,{...opts,signal:t.signal});}finally{t.done();}}
function cleanJson(text){const t=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const a=t.indexOf('{'),b=t.lastIndexOf('}');return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t);}
const auth=key=>key?{Authorization:'Bearer '+key}:{};

export class PollinationsClient{
  constructor({key='',textModel='openai',imageModel='zimage',videoModel='wan-fast',musicModel='elevenmusic'}={}){this.key=key.trim();this.textModel=textModel;this.imageModel=imageModel;this.videoModel=videoModel;this.musicModel=musicModel;}
  setKey(key){this.key=String(key||'').trim();}
  requireKey(){
    if(!this.key)throw new Error('Add a Pollinations publishable key (pk_…) under AI Engine first.');
    if(this.key.startsWith('sk_'))throw new Error('Do not use a secret sk_ key in GitHub Pages. Create a browser-safe publishable pk_ key instead.');
    if(!this.key.startsWith('pk_'))throw new Error('V2 accepts Pollinations publishable pk_ keys only.');
  }
  async validateKey(){this.requireKey();const r=await fetchWithTimeout('https://gen.pollinations.ai/account/key',{headers:auth(this.key)},30000);if(!r.ok)throw new Error(`Pollinations key rejected (${r.status})`);return r.json();}
  async chat(messages,{model=this.textModel,temperature=.75}={}){
    this.requireKey();const r=await fetchWithTimeout('https://gen.pollinations.ai/v1/chat/completions',{method:'POST',headers:{...auth(this.key),'Content-Type':'application/json'},body:JSON.stringify({model,messages,temperature})},300000);if(!r.ok)throw new Error(`AI text ${r.status}: ${(await r.text()).slice(0,180)}`);const j=await r.json();return j.choices?.[0]?.message?.content||'';
  }
  async packageTrack({trackName,theme,template,language,duration=120,sceneCount=6}){
    const prompt=`Create a complete production package for an ORIGINAL music video. Return JSON only, no markdown.\n\nTrack working name: ${trackName||'Untitled'}\nTheme/story: ${theme||'open emotional theme'}\nLanguage: ${language}\nTarget song duration: ${duration} seconds\nMusic direction: ${template.music}\nVisual direction: ${template.look}\n\nJSON schema:\n{\n  "song_title":"short memorable original title",\n  "song_prompt":"detailed music-generation prompt under 900 characters, no living artist names",\n  "lyrics":"original structured lyrics with [Verse], [Chorus], [Bridge] tags; empty string if instrumental",\n  "youtube_title":"truthful clickable YouTube title under 70 characters",\n  "description":"polished YouTube description, strongest two lines first, then credits placeholders and 3-5 hashtags",\n  "tags":["12-18 relevant tags"],\n  "thumbnail_headline":"2-5 words, high contrast, intriguing but truthful",\n  "thumbnail_prompt":"16:9 cinematic thumbnail image prompt with one strong focal subject, negative space for headline, no text/logos/watermarks",\n  "scene_prompts":["exactly ${sceneCount} varied 16:9 cinematic scene prompts, same visual world, no text/logos/watermarks"],\n  "pinned_comment":"one natural question that invites a real response"\n}\n\nAvoid copyrighted characters, celebrity imitation, fake claims, generic AI filler, and repetitive scene prompts.`;
    const out=cleanJson(await this.chat([{role:'system',content:'You are a music-video creative director and YouTube packaging editor. Output valid JSON only.'},{role:'user',content:prompt}],{temperature:.82}));
    out.tags=Array.isArray(out.tags)?out.tags:[];out.scene_prompts=Array.isArray(out.scene_prompts)?out.scene_prompts:[];return out;
  }
  async generateImage(prompt,{width=1280,height=720,model=this.imageModel,seed=-1,safe=true}={}){
    if(!this.key){
      const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed<0?Math.floor(Math.random()*1e9):seed}&model=flux`;
      const r=await fetchWithTimeout(url,{},600000);if(!r.ok)throw new Error(`Anonymous image generator ${r.status}`);const b=await r.blob();if(!b.type.startsWith('image/'))throw new Error('Image generator returned non-image data');return b;
    }
    const q=new URLSearchParams({model,width:String(width),height:String(height),safe:String(!!safe)});if(seed>=0)q.set('seed',String(seed));const r=await fetchWithTimeout(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${q}`,{headers:auth(this.key)},600000);if(!r.ok)throw new Error(`AI image ${r.status}: ${(await r.text()).slice(0,160)}`);const b=await r.blob();if(!b.type.startsWith('image/'))throw new Error('AI image returned invalid data');return b;
  }
  async generateVideo(prompt,{model=this.videoModel,duration=5,aspectRatio='16:9',audio=false,seed=-1}={}){
    this.requireKey();
    let d=Math.max(1,Number(duration)||5);
    if(/^veo/.test(model))d=[4,6,8].reduce((a,b)=>Math.abs(b-d)<Math.abs(a-d)?b:a,4);
    else if(model==='nova-reel')d=Math.min(120,Math.max(6,Math.round(d/6)*6));
    else if(model.includes('seedance-2.0'))d=Math.min(15,Math.max(4,d));
    else if(model.includes('seedance'))d=Math.min(10,Math.max(2,d));
    else if(model.includes('wan'))d=Math.min(15,Math.max(2,d));
    const q=new URLSearchParams({model,duration:String(d),aspectRatio,audio:String(!!audio),safe:'true'});if(seed>=0)q.set('seed',String(seed));
    const r=await fetchWithTimeout(`https://gen.pollinations.ai/video/${encodeURIComponent(String(prompt||'').slice(0,1800))}?${q}`,{headers:auth(this.key)},1200000);if(!r.ok)throw new Error(`AI video ${r.status}: ${(await r.text()).slice(0,180)}`);const b=await r.blob();if(!b.type.startsWith('video/'))throw new Error('AI video returned invalid data');return b;
  }
  async generateMusic(prompt,{model=this.musicModel,duration=120,instrumental=false,seed=-1}={}){
    this.requireKey();
    const input=String(prompt||'').trim().slice(0,4096);
    if(!input)throw new Error('Music prompt is empty.');
    const body={model,input,response_format:'mp3',safe:true};
    if(model==='elevenmusic'){body.duration=Math.min(300,Math.max(3,duration));body.instrumental=!!instrumental;}
    else if(model==='lyria-3-clip'){}
    else if(model.startsWith('stable-audio')){body.seconds=Math.min(380,Math.max(1,duration));}
    else body.duration=Math.min(300,Math.max(3,duration));
    if(seed>=0)body.seed=seed;
    let r=await fetchWithTimeout('https://gen.pollinations.ai/v1/audio/speech',{method:'POST',headers:{...auth(this.key),'Content-Type':'application/json'},body:JSON.stringify(body)},1200000);
    if(!r.ok&&model.startsWith('stable-audio')){
      const q=new URLSearchParams({model,response_format:'mp3',safe:'true',seconds:String(body.seconds)});if(seed>=0)q.set('seed',String(seed));
      r=await fetchWithTimeout(`https://gen.pollinations.ai/audio/${encodeURIComponent(input.slice(0,1800))}?${q}`,{headers:auth(this.key)},1200000);
    }
    if(!r.ok)throw new Error(`AI music ${r.status}: ${(await r.text()).slice(0,180)}`);
    const b=await r.blob();if(!b.type.startsWith('audio/'))throw new Error('AI music returned invalid data');return b;
  }
}

export function deterministicPackage({trackName='Untitled',theme='',template,sceneCount=6}){
  const base=trackName||'Untitled';const topic=theme||template.name;
  return {song_title:base,song_prompt:`${template.music}. Theme: ${topic}. Original composition, clear intro, development and ending.`,lyrics:'',youtube_title:`${base} — Official Music Visual`,description:`${base}\n\nAn original music visual shaped around ${topic}.\n\n🎵 Music: [credits]\n🎬 Visuals: Ridge Studio V2\n\n#music #musicvideo #visualizer`,tags:['music','music video','visualizer',template.name.toLowerCase(),...String(topic).toLowerCase().split(/\W+/).filter(Boolean).slice(0,6)],thumbnail_headline:base.split(/\s+/).slice(0,4).join(' '),thumbnail_prompt:`Cinematic 16:9 music-video thumbnail, ${template.look}, one strong focal subject, dramatic lighting, clean negative space, no text, no logo, no watermark`,scene_prompts:Array.from({length:sceneCount},(_,i)=>`${template.look}, cinematic 16:9 scene ${i+1}, ${topic}, distinct composition and camera angle, no text, no logo, no watermark`),pinned_comment:'What part of this track stayed with you after the first listen?'};
}
