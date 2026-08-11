import {InferenceClient} from '@huggingface/inference';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Range','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors,...extra}});
const allowedMediaHost=h=>h==='videos.pexels.com'||h==='images.pexels.com';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||a));

async function pexelsSearch(request,env){
  if(!env.PEXELS_API_KEY)return json({error:'Pexels cloud key not configured'},503);
  const u=new URL(request.url),q=(u.searchParams.get('q')||'cinematic music').slice(0,120),orientation=['landscape','portrait','square'].includes(u.searchParams.get('orientation'))?u.searchParams.get('orientation'):'landscape',perPage=clamp(u.searchParams.get('per_page'),1,20);
  const cache=await caches.open('ridge-pexels-v1'),key=new Request(`https://ridge-cache.invalid/pexels?q=${encodeURIComponent(q)}&o=${orientation}&n=${perPage}`),hit=await cache.match(key);if(hit)return hit;
  const api=`https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(q)}&orientation=${orientation}&size=medium&per_page=${perPage}`;
  const r=await fetch(api,{headers:{Authorization:env.PEXELS_API_KEY}});if(!r.ok)return json({error:`Pexels ${r.status}`},r.status);
  const j=await r.json(),base=new URL(request.url).origin,videos=[];
  for(const v of j.videos||[]){
    const files=(v.video_files||[]).filter(x=>/^https:\/\/videos\.pexels\.com\//.test(x.link||'')).sort((a,b)=>Math.abs((a.width||1280)-1280)-Math.abs((b.width||1280)-1280));const f=files[0];if(!f)continue;
    videos.push({id:v.id,title:`Pexels ${v.id}`,duration:v.duration,width:v.width,height:v.height,type:f.file_type||'video/mp4',mediaUrl:`${base}/api/media?url=${encodeURIComponent(f.link)}`,thumbnail:v.image||'',pageUrl:v.url||'',creator:v.user?.name||'Pexels'});
  }
  const out=json({query:q,orientation,videos},200,{'Cache-Control':'public, max-age=86400'});await cache.put(key,out.clone());return out;
}

async function proxyMedia(request){
  const u=new URL(request.url),raw=u.searchParams.get('url');if(!raw)return json({error:'missing url'},400);let target;try{target=new URL(raw)}catch{return json({error:'bad url'},400)}if(target.protocol!=='https:'||!allowedMediaHost(target.hostname))return json({error:'host not allowed'},403);
  const headers=new Headers();const range=request.headers.get('Range');if(range)headers.set('Range',range);const up=await fetch(target.toString(),{headers});const outHeaders=new Headers(up.headers);for(const [k,v] of Object.entries(cors))outHeaders.set(k,v);outHeaders.set('Cache-Control','public, max-age=86400');return new Response(up.body,{status:up.status,headers:outHeaders});
}

function containsFreeFlag(x,depth=0){if(depth>7||x==null)return false;if(typeof x!=='object')return false;if(x.is_free===true||x.isFree===true)return true;for(const v of Object.values(x))if(containsFreeFlag(v,depth+1))return true;return false}
async function isVerifiedFree(model){
  try{const r=await fetch(`https://huggingface.co/api/models/${model}?expand=inferenceProviderMapping`,{headers:{Accept:'application/json'}});if(!r.ok)return false;return containsFreeFlag(await r.json())}catch{return false}
}
async function generateVideo(request,env){
  if(!env.HF_TOKEN)return json({error:'No free video provider token configured'},503);const body=await request.json().catch(()=>({})),prompt=String(body.prompt||'').trim().slice(0,1800);if(!prompt)return json({error:'prompt required'},400);
  const model=env.HF_VIDEO_MODEL||'Lightricks/LTX-Video-0.9.8-13B-distilled';
  if(String(env.FREE_VIDEO_ONLY||'true')==='true'&&!(await isVerifiedFree(model)))return json({error:'No provider currently marks this model as free; paid fallback disabled',model},402);
  try{
    const hf=new InferenceClient(env.HF_TOKEN),result=await hf.textToVideo({model,provider:'auto',inputs:prompt,parameters:{num_frames:81,guidance_scale:4.5}});let blob=result instanceof Blob?result:result?.blob instanceof Blob?result.blob:null;
    if(!blob&&result instanceof ArrayBuffer)blob=new Blob([result],{type:'video/mp4'});if(!blob)return json({error:'Video provider returned an unsupported payload'},502);
    return new Response(blob,{headers:{'Content-Type':blob.type||'video/mp4','Cache-Control':'no-store',...cors}});
  }catch(e){return json({error:String(e?.message||e).slice(0,260),model},503)}
}

function parseModelJson(text=''){
  const s=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');const a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<=a)throw new Error('NVIDIA model did not return JSON');return JSON.parse(s.slice(a,b+1));
}
function compactRelease(x={}){
  return {
    title:String(x.title||'').slice(0,120),
    description:String(x.description||'').slice(0,4000),
    hashtags:Array.isArray(x.hashtags)?x.hashtags.slice(0,8):[],
    tags:Array.isArray(x.tags)?x.tags.slice(0,24):[],
    clean_lyrics:String(x.clean_lyrics||x.lyrics||'').slice(0,16000),
    intro:String(x.intro||'').slice(0,120),
    outro:String(x.outro||'').slice(0,160),
    story:String(x.story||'').slice(0,1000),
    hook_meaning:String(x.hook_meaning||x.hookMeaning||'').slice(0,800)
  };
}
async function nvidiaRefine(request,env){
  if(!env.NVIDIA_API_KEY)return json({error:'NVIDIA NIM secret not configured'},503);
  const body=await request.json().catch(()=>({})),language=String(body.language||'English').slice(0,40),current=compactRelease(body.current||{});
  if(!current.title&&!current.clean_lyrics&&!current.story)return json({error:'canonical release package required'},400);
  const model=String(env.NVIDIA_TEXT_MODEL||'meta/llama-3.3-70b-instruct').slice(0,120);
  const system=`You are Ridge Studio's second-opinion music release editor. You are NOT allowed to invent a new song story. The canonical story and hook are locked. Improve only when clearly better. Preserve the selected language and script. Return one JSON object only.`;
  const prompt=`Review this canonical release package as a careful human editor.\n\nLANGUAGE: ${language}\nLOCKED STORY: ${current.story}\nLOCKED HOOK MEANING: ${current.hook_meaning}\n\nCURRENT RELEASE JSON:\n${JSON.stringify(current)}\n\nRules:\n- Never translate into a different language unless the selected language explicitly requires code-switching.\n- Hindi/Kumaoni should remain naturally written in Devanagari; Hinglish should remain natural Roman-script Hinglish; English should remain idiomatic English.\n- Fix grammar, gender/verb agreement, robotic phrasing, literal translation artifacts, forced rhymes and metadata drift.\n- Title, description, lyrics, intro and outro must describe the same locked story/hook.\n- Do not add facts not present in the song.\n- If the current version is already stronger, keep it.\n\nReturn exactly: {"title":"...","description":"...","hashtags":[...],"tags":[...],"clean_lyrics":"...","intro":"...","outro":"...","confidence":0.0,"verdict":"keep_current|nvidia_better","changes_summary":"short explanation"}.`;
  try{
    const r=await fetch('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${env.NVIDIA_API_KEY}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:.2,top_p:.7,max_tokens:4096,stream:false})});
    const raw=await r.text();if(!r.ok)return json({error:`NVIDIA ${r.status}`,detail:raw.slice(0,500),model},r.status===429?429:503);
    const payload=JSON.parse(raw),obj=parseModelJson(payload?.choices?.[0]?.message?.content||''),candidate=compactRelease({...current,...obj});
    const confidence=clamp(obj.confidence,0,1),verdict=obj.verdict==='nvidia_better'?'nvidia_better':'keep_current';
    return json({ok:true,provider:'nvidia-nim',model,confidence,verdict,changesSummary:String(obj.changes_summary||'').slice(0,500),candidate});
  }catch(e){return json({error:String(e?.message||e).slice(0,280),model},503)}
}

export default{async fetch(request,env){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
  if(u.pathname==='/api/health')return json({ok:true,pexels:!!env.PEXELS_API_KEY,freeVideo:!!env.HF_TOKEN,freeOnly:String(env.FREE_VIDEO_ONLY||'true')==='true',nvidia:!!env.NVIDIA_API_KEY,nvidiaModel:env.NVIDIA_TEXT_MODEL||'meta/llama-3.3-70b-instruct'});
  if(u.pathname==='/api/pexels/search'&&request.method==='GET')return pexelsSearch(request,env);
  if(u.pathname==='/api/media'&&request.method==='GET')return proxyMedia(request);
  if(u.pathname==='/api/video/generate'&&request.method==='POST')return generateVideo(request,env);
  if(u.pathname==='/api/nvidia/refine'&&request.method==='POST')return nvidiaRefine(request,env);
  return json({error:'Not found'},404);
}};