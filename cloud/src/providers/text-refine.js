'use strict';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||a));
const list=v=>[...new Set(String(v||'').split(',').map(x=>x.trim()).filter(Boolean))];
const timeoutSignal=ms=>typeof AbortSignal?.timeout==='function'?AbortSignal.timeout(ms):undefined;

function parseJsonObject(text=''){
  const s=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a<0||b<=a)throw new Error('model returned no JSON object');
  return JSON.parse(s.slice(a,b+1));
}

function compactRelease(x={}){
  return {
    title:safe(x.title,120),
    description:safe(x.description,4000),
    hashtags:Array.isArray(x.hashtags)?x.hashtags.map(v=>safe(v,80)).filter(Boolean).slice(0,8):[],
    tags:Array.isArray(x.tags)?x.tags.map(v=>safe(v,80)).filter(Boolean).slice(0,24):[],
    clean_lyrics:safe(x.clean_lyrics||x.lyrics,16000),
    intro:safe(x.intro,120),
    outro:safe(x.outro,160),
    story:safe(x.story,1000),
    hook_meaning:safe(x.hook_meaning||x.hookMeaning,800)
  };
}

function prompts(body={}){
  const language=safe(body.language||'English',40),current=compactRelease(body.current||{});
  if(!current.title&&!current.clean_lyrics&&!current.story)throw Object.assign(new Error('canonical release package required'),{status:400});
  const system=`You are Ridge Studio's second-opinion music release editor. The canonical song story and hook are locked. Improve only when clearly better. Preserve the selected language and script. Never invent facts. Return exactly one JSON object and no prose.`;
  const prompt=`Review this canonical release package as a careful human editor.\n\nLANGUAGE: ${language}\nLOCKED STORY: ${current.story}\nLOCKED HOOK MEANING: ${current.hook_meaning}\n\nCURRENT RELEASE JSON:\n${JSON.stringify(current)}\n\nRules:\n- Never translate into a different language unless the selected language explicitly requires code-switching.\n- Hindi/Kumaoni should remain naturally written in Devanagari; Hinglish should remain natural Roman-script Hinglish; English should remain idiomatic English.\n- Fix grammar, gender/verb agreement, robotic phrasing, literal translation artifacts, forced rhymes and metadata drift.\n- Title, description, lyrics, intro and outro must describe the same locked story/hook.\n- Do not add facts not present in the song.\n- If the current version is already stronger, keep it.\n\nReturn exactly: {"title":"...","description":"...","hashtags":[...],"tags":[...],"clean_lyrics":"...","intro":"...","outro":"...","confidence":0.0,"verdict":"keep_current|provider_better","changes_summary":"short explanation"}.`;
  return {language,current,system,prompt};
}

function normalizeSuccess(provider,model,obj,current,attempts=[]){
  const candidate=compactRelease({...current,...obj});
  const rawVerdict=safe(obj?.verdict,80).toLowerCase();
  const better=/better|improve|replace|use_candidate/.test(rawVerdict);
  return {
    ok:true,
    provider,
    model:model||null,
    confidence:clamp(obj?.confidence,0,1),
    verdict:better?'nvidia_better':'keep_current',
    adaptiveVerdict:better?'provider_better':'keep_current',
    changesSummary:safe(obj?.changes_summary||obj?.changesSummary,500),
    candidate,
    attempts,
    paidFallback:false,
    degraded:false
  };
}

function record(attempts,provider,model,status,error){
  attempts.push({provider,model:model||null,status:Number(status)||0,error:safe(error,180)});
}

async function tryWorkersAI(env,ctx,attempts){
  if(!env.AI)return null;
  const models=[...new Set([...list(env.CF_TEXT_MODELS),...list(env.DIRECTOR_TEXT_MODEL)])].slice(0,4);
  for(const model of models){
    try{
      const out=await env.AI.run(model,{messages:[{role:'system',content:ctx.system},{role:'user',content:ctx.prompt}],temperature:.2,max_tokens:4096});
      const text=out?.response||out?.result?.response||out?.output_text||out?.text||'';
      if(!text){record(attempts,'workers-ai',model,502,'empty response');continue}
      return normalizeSuccess('workers-ai',model,parseJsonObject(text),ctx.current,attempts);
    }catch(e){record(attempts,'workers-ai',model,e?.status||503,e?.message||e)}
  }
  return null;
}

async function tryOpenAICompatible({provider,url,key,models,ctx,attempts}){
  if(!key)return null;
  for(const model of models.slice(0,5)){
    try{
      const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:ctx.system},{role:'user',content:ctx.prompt}],temperature:.2,top_p:.7,max_tokens:4096,stream:false}),signal:timeoutSignal(45000)});
      const raw=await r.text();
      if(!r.ok){record(attempts,provider,model,r.status,raw);continue}
      const payload=JSON.parse(raw),text=payload?.choices?.[0]?.message?.content||'';
      if(!text){record(attempts,provider,model,502,'empty response');continue}
      return normalizeSuccess(provider,model,parseJsonObject(text),ctx.current,attempts);
    }catch(e){record(attempts,provider,model,e?.status||503,e?.message||e)}
  }
  return null;
}

async function nvidiaModels(env){
  return [...new Set([...list(env.NVIDIA_TEXT_MODELS),...list(env.NVIDIA_TEXT_MODEL)])].filter(x=>!/llama-3\.3-70b-instruct/i.test(x)).slice(0,5);
}

async function groqModels(env,attempts){
  const preferred=list(env.GROQ_TEXT_MODELS);
  if(!env.GROQ_API_KEY)return preferred;
  try{
    const r=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:`Bearer ${env.GROQ_API_KEY}`,Accept:'application/json'},signal:timeoutSignal(12000)});
    if(!r.ok){record(attempts,'groq-discovery',null,r.status,await r.text());return preferred}
    const j=await r.json();
    const discovered=(j.data||[]).filter(x=>x?.active!==false).map(x=>safe(x.id,160)).filter(id=>id&&!/(whisper|speech|audio|orpheus|guard|safeguard|tts)/i.test(id));
    const ranked=discovered.sort((a,b)=>scoreModel(b)-scoreModel(a));
    return [...new Set([...preferred,...ranked])].slice(0,5);
  }catch(e){record(attempts,'groq-discovery',null,503,e?.message||e);return preferred}
}

function scoreModel(id=''){
  const s=String(id).toLowerCase();
  if(s.includes('gpt-oss-20b'))return 100;
  if(s.includes('gpt-oss'))return 95;
  if(s.includes('llama-3.1-8b'))return 90;
  if(s.includes('qwen'))return 85;
  if(s.includes('llama'))return 80;
  if(s.includes('gemma'))return 70;
  if(s.includes('compound'))return 50;
  return 10;
}

function bypass(ctx,attempts){
  return {
    ok:true,
    provider:'bypass',
    model:null,
    confidence:1,
    verdict:'keep_current',
    adaptiveVerdict:'keep_current',
    changesSummary:'Optional refinement providers were unavailable; Ridge kept the canonical release package unchanged.',
    candidate:ctx.current,
    attempts,
    paidFallback:false,
    degraded:true
  };
}

export function adaptiveTextCapabilities(env){
  const order=list(env.TEXT_PROVIDER_ORDER||'workers-ai,nvidia,groq,bypass');
  return {
    route:'/api/text/refine',
    legacyRoute:'/api/nvidia/refine',
    order,
    workersAI:!!env.AI,
    cloudflareModels:[...new Set([...list(env.CF_TEXT_MODELS),...list(env.DIRECTOR_TEXT_MODEL)])],
    nvidia:!!env.NVIDIA_API_KEY,
    nvidiaModels:[...new Set([...list(env.NVIDIA_TEXT_MODELS),...list(env.NVIDIA_TEXT_MODEL)])].filter(x=>!/llama-3\.3-70b-instruct/i.test(x)),
    groqConfigured:!!env.GROQ_API_KEY,
    groqAutomatic:String(env.ALLOW_GROQ_TEXT_FALLBACK||'false')==='true',
    fallbackBypass:true,
    paidFallback:false
  };
}

export async function adaptiveRefine(request,env){
  let ctx;
  try{ctx=prompts(await request.json().catch(()=>({})))}catch(e){return {status:e?.status||400,body:{error:safe(e?.message||e,300)}}}
  const attempts=[],order=list(env.TEXT_PROVIDER_ORDER||'workers-ai,nvidia,groq,bypass');
  for(const step of order){
    const key=step.toLowerCase();
    if(key==='workers-ai'||key==='cloudflare'||key==='cf'){
      const hit=await tryWorkersAI(env,ctx,attempts);if(hit)return {status:200,body:hit};continue;
    }
    if(key==='nvidia'||key==='nvidia-nim'){
      const models=await nvidiaModels(env);const hit=await tryOpenAICompatible({provider:'nvidia-nim',url:'https://integrate.api.nvidia.com/v1/chat/completions',key:env.NVIDIA_API_KEY,models,ctx,attempts});if(hit)return {status:200,body:hit};continue;
    }
    if(key==='groq'){
      if(String(env.ALLOW_GROQ_TEXT_FALLBACK||'false')!=='true'){record(attempts,'groq',null,0,'automatic Groq fallback disabled to avoid unintended paid usage');continue}
      const models=await groqModels(env,attempts);const hit=await tryOpenAICompatible({provider:'groq',url:'https://api.groq.com/openai/v1/chat/completions',key:env.GROQ_API_KEY,models,ctx,attempts});if(hit)return {status:200,body:hit};continue;
    }
    if(key==='bypass'||key==='keep-current')return {status:200,body:bypass(ctx,attempts)};
  }
  return {status:200,body:bypass(ctx,attempts)};
}
