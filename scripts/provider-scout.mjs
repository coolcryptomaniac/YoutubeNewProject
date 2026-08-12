import fs from 'node:fs';

const mode=(process.argv.find(a=>a.startsWith('--mode='))||'--mode=weekly').split('=')[1];
const DAYS=mode==='monthly'?45:14;
const now=new Date();
const cutoff=Date.now()-DAYS*864e5;
const outPath=process.env.SCOUT_REPORT||'provider-scout-report.md';
const timeoutMs=12000;

const SOURCES=[
  {name:'Mistral models',url:'https://docs.mistral.ai/models/overview'},
  {name:'Mistral subscriptions',url:'https://docs.mistral.ai/admin/billing-usage/subscriptions'},
  {name:'Mistral audio',url:'https://docs.mistral.ai/studio-api/audio/overview'},
  {name:'Cloudflare Workers AI pricing',url:'https://developers.cloudflare.com/workers-ai/platform/pricing/'},
  {name:'Cloudflare Workers AI models',url:'https://developers.cloudflare.com/workers-ai/models/'},
  {name:'Hugging Face inference pricing',url:'https://huggingface.co/docs/inference-providers/pricing'}
];
const TASKS=[
  ['text','text-generation'],
  ['image','text-to-image'],
  ['video','text-to-video'],
  ['music/audio','text-to-audio'],
  ['speech','automatic-speech-recognition']
];

function esc(s=''){return String(s).replace(/[|\n\r]/g,' ').trim()}
function hasFreeFlag(x,depth=0){
  if(depth>7||x==null)return false;
  if(typeof x!=='object')return false;
  if(x.is_free===true||x.isFree===true)return true;
  return Object.values(x).some(v=>hasFreeFlag(v,depth+1));
}
async function get(url,{json=false}={}){
  const c=new AbortController();const t=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{headers:{'User-Agent':'Ridge-Provider-Scout/1.0','Accept':json?'application/json':'text/html,*/*'},signal:c.signal});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return json?await r.json():await r.text();
  }finally{clearTimeout(t)}
}
async function sourceHealth(){
  return Promise.all(SOURCES.map(async s=>{
    try{const body=await get(s.url);return {...s,ok:true,bytes:body.length}}
    catch(e){return {...s,ok:false,error:String(e.message||e)}}
  }));
}
async function recentHF(task,tag){
  const url=`https://huggingface.co/api/models?pipeline_tag=${encodeURIComponent(tag)}&sort=lastModified&direction=-1&limit=10&full=true`;
  let rows=[];try{rows=await get(url,{json:true})}catch{return []}
  const recent=rows.filter(m=>new Date(m.lastModified||0).getTime()>=cutoff).slice(0,6);
  const checked=[];
  for(const m of recent){
    let free=false,providerInfo=null;
    try{
      providerInfo=await get(`https://huggingface.co/api/models/${encodeURIComponent(m.id)}?expand=inferenceProviderMapping`,{json:true});
      free=hasFreeFlag(providerInfo?.inferenceProviderMapping||providerInfo);
    }catch{}
    checked.push({task,id:m.id,lastModified:m.lastModified,likes:m.likes||0,downloads:m.downloads||0,freeProviderFlag:free});
  }
  return checked;
}
function recommendationLines(cands){
  const any=t=>cands.filter(x=>x.task===t);
  const rec=[];
  if(any('speech').length)rec.push('Benchmark the newest speech models against Ridge lyric transcription on 3 Hindi/Kumaoni/English tracks; require word timestamps and visibly better alignment before promotion.');
  if(any('text').length)rec.push('Run metadata/title/description candidates through Ridge’s fixed evaluation prompts; add a provider only if it beats the current model on quality and remains free-tier without paid spillover.');
  if(any('image').length)rec.push('Test new image models only as artwork/background sources. Keep Ridge’s local 3000×3000 compositor as the final cover step so distribution dimensions remain exact.');
  if(any('video').length)rec.push('Treat free video models as optional B-roll experiments, never automatic fallback. Require a verified free flag immediately before generation.');
  if(any('music/audio').length)rec.push('Keep official Suno as the primary future music-generation API path. Test open text-to-audio models only in Lab until quality, rights and free inference are verified.');
  rec.push('Mistral fit: prioritize Voxtral for transcription/timestamps, Mistral Small/Medium for second-opinion text editing, and OCR for document/form extraction; do not make its image tool the default image provider.');
  return rec;
}

const health=await sourceHealth();
const groups=await Promise.all(TASKS.map(([task,tag])=>recentHF(task,tag)));
const candidates=groups.flat();
const verifiedFree=candidates.filter(x=>x.freeProviderFlag);
const lines=[];
lines.push(`# Ridge Provider Scout — ${mode}`);
lines.push(`Generated: ${now.toISOString()} · discovery window: ${DAYS} days`);
lines.push('');
lines.push('## Guardrails');
lines.push('- Discovery uses public/official HTTP sources and deterministic rules. No AI endpoint is called by this scout.');
lines.push('- “Free provider flag” is a research signal, not permission to spend. Ridge must re-check free eligibility at runtime and keep paid fallback disabled.');
lines.push('- Hugging Face routed free-user credits are too small for production; use them for evaluation only unless a provider is independently verified free.');
lines.push('- New models are candidates, not automatic production changes.');
lines.push('');
lines.push('## Official source health');
for(const s of health)lines.push(`- ${s.ok?'✅':'⚠️'} ${s.name}: ${s.ok?`${s.bytes} bytes fetched`:`${s.error}`}`);
lines.push('');
lines.push(`## Recent model candidates (${candidates.length})`);
if(!candidates.length)lines.push(`No recent Hugging Face model entries were found in the last ${DAYS} days for the monitored task tags.`);
else{
  lines.push('| Area | Model | Modified | HF free-provider signal | Likes | Downloads |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for(const x of candidates)lines.push(`| ${esc(x.task)} | ${esc(x.id)} | ${esc(x.lastModified||'')} | ${x.freeProviderFlag?'yes':'no/unknown'} | ${x.likes} | ${x.downloads} |`);
}
lines.push('');
lines.push(`## Highest-priority free-signal candidates (${verifiedFree.length})`);
if(!verifiedFree.length)lines.push('None currently surfaced with an explicit free-provider flag. Do not infer “free” from open weights alone.');
else for(const x of verifiedFree)lines.push(`- **${x.task}:** ${x.id} — verify output quality, license, provider quota and browser/Worker compatibility before adding.`);
lines.push('');
lines.push('## Mistral recommendation');
lines.push('- **Best immediate Ridge use:** Voxtral transcription for lyrics, word timestamps and multilingual audio workflows.');
lines.push('- **Useful secondary use:** Mistral Small/Medium for metadata, rewrite critique, structured JSON and agentic/code tasks.');
lines.push('- **Useful niche use:** OCR for distributor paperwork, screenshots/documents and extracting structured release information.');
lines.push('- **Not first choice:** image generation. Mistral exposes image generation as an agent tool backed by another image-model provider; keep Ridge’s dedicated image providers/local cover compositor ahead of it.');
lines.push('- Mistral Free mode exists, but model limits vary by account. Any Ridge Mistral integration must be opt-in and fail closed instead of switching to paid usage.');
lines.push('');
lines.push(`## ${mode==='monthly'?'Monthly process improvements':'This week’s experiments'}`);
for(const r of recommendationLines(candidates))lines.push(`- ${r}`);
if(mode==='monthly'){
  lines.push('- Review the last month’s provider failures, latency and quota errors before promoting anything new. Prefer removing an unreliable option over adding another redundant one.');
  lines.push('- Compare content outcomes, not benchmark hype: title CTR, watch time, lyric alignment quality, render completion rate and time-to-publish are Ridge’s promotion metrics.');
}
lines.push('');
lines.push('## Promotion checklist');
lines.push('1. Official docs/API confirmed.');
lines.push('2. Free/free-tier behavior verified without card-required paid fallback.');
lines.push('3. License/usage terms acceptable for published music/content.');
lines.push('4. Tested on Ridge’s fixed prompt/media suite.');
lines.push('5. Failure is isolated and does not block the rest of the pipeline.');
lines.push('6. Provider is optional until enough evidence exists to promote it.');
fs.writeFileSync(outPath,lines.join('\n')+'\n');
console.log(`Provider scout wrote ${outPath}: ${candidates.length} candidates, ${verifiedFree.length} with free-provider signals.`);
