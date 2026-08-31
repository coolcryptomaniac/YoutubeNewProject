import {assertFreeWorkersAiModel,freePolicyCapabilities} from './free-policy.js';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||a));

export class DirectorError extends Error{
  constructor(message,{status=503,code='DIRECTOR_ERROR',detail=''}={}){super(message);this.status=status;this.code=code;this.detail=detail;}
}

function parseJson(text=''){
  const s=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a<0||b<=a)throw new DirectorError('Director model did not return JSON',{status:502,code:'DIRECTOR_BAD_JSON'});
  try{return JSON.parse(s.slice(a,b+1));}catch(e){throw new DirectorError('Director model returned invalid JSON',{status:502,code:'DIRECTOR_BAD_JSON',detail:s.slice(0,700)});}
}

function normaliseShot(x,i,duration){
  const start=clamp(x.start,0,duration),end=clamp(x.end,start+.5,duration||start+6);
  return {id:safe(x.id||`shot-${String(i+1).padStart(3,'0')}`,40),start:+start.toFixed(3),end:+end.toFixed(3),section:safe(x.section,40),lyrics:safe(x.lyrics,700),meaning:safe(x.meaning,700),emotion:safe(x.emotion,120),energy:clamp(x.energy,0,1),narrative:safe(x.narrative,900),camera:safe(x.camera,500),continuity:Array.isArray(x.continuity)?x.continuity.map(v=>safe(v,100)).slice(0,8):[],prompt:safe(x.prompt,2400),negative:safe(x.negative,800),providerHints:x.providerHints&&typeof x.providerHints==='object'?x.providerHints:{}};
}

function normalisePlan(obj,body){
  const duration=clamp(body.audio?.duration||obj.duration,1,60*30),shots=Array.isArray(obj.shots)?obj.shots.slice(0,120).map((x,i)=>normaliseShot(x,i,duration)):[];
  return {version:'ridge-director-2-free',title:safe(body.title||obj.title||'Untitled',160),duration,song:{meaning:safe(obj.song?.meaning,1800),mood:safe(obj.song?.mood,500),emotionalArc:Array.isArray(obj.song?.emotionalArc)?obj.song.emotionalArc.map(v=>safe(v,160)).slice(0,12):[],visualLanguage:safe(obj.song?.visualLanguage,1200),bpm:clamp(body.audio?.bpm||obj.song?.bpm,40,240)},story:{logline:safe(obj.story?.logline,700),synopsis:safe(obj.story?.synopsis,2500),ending:safe(obj.story?.ending,900)},characters:Array.isArray(obj.characters)?obj.characters.slice(0,8).map((x,i)=>({id:safe(x.id||`CHARACTER_${i+1}`,40),name:safe(x.name,80),description:safe(x.description,900),wardrobe:safe(x.wardrobe,600),rules:safe(x.rules,700)})):[],locations:Array.isArray(obj.locations)?obj.locations.slice(0,12).map((x,i)=>({id:safe(x.id||`LOCATION_${i+1}`,40),description:safe(x.description,900),rules:safe(x.rules,700)})):[],palette:safe(obj.palette,700),editing:safe(obj.editing,1200),shots,youtube:{title:safe(obj.youtube?.title||body.title,100),description:safe(obj.youtube?.description,3500),hashtags:Array.isArray(obj.youtube?.hashtags)?obj.youtube.hashtags.slice(0,12):[],thumbnailPrompt:safe(obj.youtube?.thumbnailPrompt,1200)}};
}

export function directorCapabilities(env){
  const policy=freePolicyCapabilities(env),model=env.DIRECTOR_TEXT_MODEL||'@cf/zai-org/glm-4.7-flash';
  return {enabled:!!env.AI,provider:env.AI?'cloudflare-workers-ai':'none',model,requiresExplicitAction:true,paidFallback:false,maxShots:120,policy:policy.version};
}

export async function createDirectorPlan(env,body={}){
  if(String(env.RIDGE_PAID_FALLBACK||'false').toLowerCase()!=='false')throw new DirectorError('Ridge paid fallback must remain disabled',{status:503,code:'PAID_FALLBACK_POLICY'});
  if(!env.AI)throw new DirectorError('Free Workers AI binding is not configured',{status:503,code:'DIRECTOR_FREE_PROVIDER_NOT_CONFIGURED'});
  const title=safe(body.title||'Untitled song',160),lyrics=safe(body.lyrics,18000),style=safe(body.style||'cinematic story',120),language=safe(body.language||'auto',40);
  if(!lyrics)throw new DirectorError('Lyrics are required for semantic direction. Transcribe or paste lyrics first.',{status:400,code:'DIRECTOR_LYRICS_REQUIRED'});
  const audio={duration:clamp(body.audio?.duration,1,1800),bpm:clamp(body.audio?.bpm,40,240),beats:Array.isArray(body.audio?.beats)?body.audio.beats.slice(0,900):[],energy:Array.isArray(body.audio?.energy)?body.audio.energy.slice(0,240):[]};
  const model=assertFreeWorkersAiModel(safe(env.DIRECTOR_TEXT_MODEL||'@cf/zai-org/glm-4.7-flash',120));
  const system=`You are Ridge Studio's music-video director, lyric interpreter, cinematographer and editor. Build ONE coherent premium music video, not disconnected clips. Understand metaphor and emotional progression. Keep recurring people, wardrobe, locations, lighting and props consistent. Cuts and camera energy must respond to the music. Return only valid JSON.`;
  const prompt=`SONG TITLE: ${title}\nLANGUAGE: ${language}\nVIDEO STYLE: ${style}\nAUDIO ANALYSIS: ${JSON.stringify(audio)}\nLYRICS:\n${lyrics}\n\nInfer the true meaning, mood, arc and recurring symbols, then create a coherent beginning/development/payoff. Return one JSON object with song, story, characters, locations, palette, editing, shots and youtube. Each shot must include id,start,end,section,lyrics,meaning,emotion,energy,narrative,camera,continuity,prompt,negative,providerHints. Use enough 3-8 second shots to cover ${audio.duration.toFixed(1)} seconds, max 120.`;
  let payload;
  try{payload=await env.AI.run(model,{messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:.3,max_tokens:12000,response_format:{type:'json_object'}})}catch(e){throw new DirectorError('Free Workers AI director unavailable; Ridge will not fall back to a paid provider',{status:503,code:'DIRECTOR_FREE_PROVIDER_ERROR',detail:safe(e?.message||e,700)});}
  const text=payload?.response||payload?.result?.response||payload?.choices?.[0]?.message?.content||'';
  const obj=parseJson(typeof text==='string'?text:JSON.stringify(text));
  return {ok:true,provider:'cloudflare-workers-ai',model,paidFallback:false,plan:normalisePlan(obj,{...body,audio})};
}
