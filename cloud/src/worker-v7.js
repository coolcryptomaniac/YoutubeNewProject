'use strict';

import base from './worker-v6.js';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session',
  'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'
};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors,...extra}});
const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const enc=new TextEncoder();
const dec=new TextDecoder();
const b64url=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const fromB64url=s=>{const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/');const raw=atob(p+'='.repeat((4-p.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
const textB64=s=>b64url(enc.encode(String(s||'')));

function signingSecret(env){return String(env.RIDGE_ADMIN_TOKEN||env.VUSIC_PASSWORD||'')}
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
function admin(request,env){const h=request.headers.get('Authorization')||'';return !!env.RIDGE_ADMIN_TOKEN&&h===`Bearer ${env.RIDGE_ADMIN_TOKEN}`}
function sessionToken(request){const u=new URL(request.url);const h=request.headers.get('X-Ridge-Session')||request.headers.get('Authorization')||u.searchParams.get('session')||'';return h.replace(/^Bearer\s+/i,'').trim()}
async function verifySession(request,env){
  const secret=signingSecret(env),token=sessionToken(request);if(!secret||!token)return null;
  try{const [body,sig]=token.split('.');if(!body||!sig)return null;if(await hmac(secret,body)!==sig)return null;const data=JSON.parse(dec.decode(fromB64url(body)));if(Number(data.exp)<Date.now()||data.scope!=='ridge-session')return null;return data}catch{return null}
}
function requireR2(env){return !!env.RELEASE_MEDIA}
const stageKey=name=>`pipeline-stage/${name}`;
const statusKey=id=>`pipeline-render/${id}.json`;
const resultKey=id=>`pipeline-render/${id}.mp4`;
async function putStatus(env,id,data){await env.RELEASE_MEDIA.put(statusKey(id),JSON.stringify(data),{httpMetadata:{contentType:'application/json'},customMetadata:{expires:String(Date.now()+24*60*60*1000)}})}
async function getStatus(env,id){const x=await env.RELEASE_MEDIA.get(statusKey(id));if(!x)return null;return x.json().catch(()=>null)}

async function pipelineStage(request,env){
  if(!(await verifySession(request,env)))return json({error:'Ridge/Vusic session login required'},401);
  if(!requireR2(env))return json({error:'R2 is required for crash-resistant staging; edge-local Cache API fallback is disabled'},503);
  const form=await request.formData().catch(()=>null),file=form?.get('file');if(!(file instanceof File))return json({error:'file required'},400);
  if(file.size>120*1024*1024)return json({error:'file exceeds 120 MB staging limit'},413);
  const ext=(file.name.match(/\.[a-z0-9]{1,8}$/i)||[''])[0].toLowerCase(),name=`${crypto.randomUUID()}${ext}`,expires=Date.now()+2*60*60*1000,key=stageKey(name);
  await env.RELEASE_MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{expires:String(expires),name:safe(file.name,180)}});
  const secret=signingSecret(env),sig=await hmac(secret,`${name}:${expires}:pipeline-file`),u=new URL(request.url);u.pathname=`/api/pipeline/file/${name}`;u.search='';u.searchParams.set('exp',String(expires));u.searchParams.set('sig',sig);
  return json({ok:true,name,key,url:u.toString(),storage:'r2',size:file.size,type:file.type,expiresAt:new Date(expires).toISOString()});
}
async function pipelineFile(request,env){
  if(!requireR2(env))return json({error:'R2 unavailable'},503);const secret=signingSecret(env);if(!secret)return json({error:'Ridge signing secret unavailable'},503);
  const u=new URL(request.url),name=u.pathname.split('/').pop()||'',exp=Number(u.searchParams.get('exp')||0),sig=u.searchParams.get('sig')||'';
  if(!name||!exp||exp<Date.now())return json({error:'expired or invalid file link'},410);if(await hmac(secret,`${name}:${exp}:pipeline-file`)!==sig)return json({error:'invalid file signature'},403);
  const obj=await env.RELEASE_MEDIA.get(stageKey(name));if(!obj)return json({error:'staged file not found'},404);const h=new Headers(cors);obj.writeHttpMetadata(h);h.set('Cache-Control','private,max-age=300');return new Response(obj.body,{headers:h});
}
async function pipelineRender(request,env){
  if(!(await verifySession(request,env)))return json({error:'Ridge session login required'},401);
  if(!requireR2(env))return json({error:'R2 is required for resumable cloud rendering'},503);if(!env.RIDGE_GITHUB_TOKEN)return json({error:'RIDGE_GITHUB_TOKEN is not configured'},503);
  const body=await request.json().catch(()=>({})),audioUrl=safe(body.audioUrl,2200),coverUrl=safe(body.coverUrl,2200),title=safe(body.title||'Ridge Music Video',180),lyrics=safe(body.lyrics,18000),mode=['auto','lyrics','visualizer','photo','pexels'].includes(body.mode)?body.mode:'auto',queries=(Array.isArray(body.queries)?body.queries:[]).map(x=>safe(x,160)).filter(Boolean).slice(0,6);
  if(!audioUrl)return json({error:'staged audio URL required'},400);const secret=signingSecret(env);if(!secret)return json({error:'Ridge signing secret unavailable'},503);
  const id=crypto.randomUUID(),exp=Date.now()+2*60*60*1000,sig=await hmac(secret,`${id}:${exp}:pipeline-result`),origin=new URL(request.url).origin,callback=`${origin}/api/pipeline/render-result/${id}?exp=${exp}&sig=${sig}`;
  await putStatus(env,id,{id,status:'queued',createdAt:new Date().toISOString(),mode,title,storage:'r2'});
  const payload={ref:'main',inputs:{job_id:id,audio_url:audioUrl,cover_url:coverUrl,mode,title_b64:textB64(title),lyrics_b64:textB64(lyrics),queries_b64:textB64(JSON.stringify(queries)),cloud_url:origin,callback_url:callback}};
  const r=await fetch('https://api.github.com/repos/coolcryptomaniac/YoutubeNewProject/actions/workflows/ridge-cloud-render.yml/dispatches',{method:'POST',headers:{Authorization:`Bearer ${env.RIDGE_GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Ridge-Studio'},body:JSON.stringify(payload)});
  if(!r.ok){const detail=(await r.text()).slice(0,600);await putStatus(env,id,{id,status:'failed',error:`GitHub dispatch ${r.status}`,detail,finishedAt:new Date().toISOString()});return json({error:`GitHub render dispatch ${r.status}`,detail},503)}
  return json({ok:true,id,status:'queued',mode,storage:'r2'});
}
async function pipelineRenderResult(request,env){
  if(!requireR2(env))return json({error:'R2 unavailable'},503);const secret=signingSecret(env);if(!secret)return json({error:'Ridge signing secret unavailable'},503);
  const u=new URL(request.url),id=u.pathname.split('/').pop()||'',exp=Number(u.searchParams.get('exp')||0),sig=u.searchParams.get('sig')||'';if(!id||!exp||exp<Date.now())return json({error:'expired callback'},410);if(await hmac(secret,`${id}:${exp}:pipeline-result`)!==sig)return json({error:'invalid callback signature'},403);if(request.method!=='PUT')return json({error:'PUT required'},405);
  const len=Number(request.headers.get('Content-Length')||0);if(len>150*1024*1024)return json({error:'render exceeds 150 MB result limit'},413);
  await env.RELEASE_MEDIA.put(resultKey(id),request.body,{httpMetadata:{contentType:request.headers.get('Content-Type')||'video/mp4'},customMetadata:{expires:String(Date.now()+24*60*60*1000)}});await putStatus(env,id,{id,status:'done',finishedAt:new Date().toISOString(),storage:'r2'});return json({ok:true});
}
async function pipelineRenderStatus(request,env){if(!(await verifySession(request,env)))return json({error:'Ridge session login required'},401);if(!requireR2(env))return json({error:'R2 unavailable'},503);const id=new URL(request.url).pathname.split('/').pop()||'',s=await getStatus(env,id);if(!s)return json({error:'render job not found'},404);return json(s)}
async function pipelineRenderDownload(request,env){if(!(await verifySession(request,env)))return json({error:'Ridge session login required'},401);if(!requireR2(env))return json({error:'R2 unavailable'},503);const id=new URL(request.url).pathname.split('/').pop()||'',obj=await env.RELEASE_MEDIA.get(resultKey(id));if(!obj)return json({error:'render result not ready'},404);const h=new Headers(cors);obj.writeHttpMetadata(h);h.set('Content-Disposition',`attachment; filename="ridge-${id}.mp4"`);h.set('Cache-Control','private,max-age=300');return new Response(obj.body,{headers:h})}

function rewrite(request,path){const u=new URL(request.url);u.pathname=path;return new Request(u.toString(),request)}
async function cleanupPrefix(env,prefix){
  if(!env.RELEASE_MEDIA)return 0;let cursor,deleted=0;
  do{const page=await env.RELEASE_MEDIA.list({prefix,cursor,limit:500,include:['customMetadata']});cursor=page.truncated?page.cursor:undefined;for(const obj of page.objects){const exp=Number(obj.customMetadata?.expires||0);if(exp&&exp<Date.now()){await env.RELEASE_MEDIA.delete(obj.key);deleted++}}}while(cursor);
  return deleted;
}
async function cleanupExpired(env){let deleted=0;for(const p of ['release-stage/','mobile-render/','pipeline-stage/','pipeline-render/'])deleted+=await cleanupPrefix(env,p);return deleted}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
    if(u.pathname==='/api/resilience/health'&&request.method==='GET')return json({ok:true,worker:'v7',r2:!!env.RELEASE_MEDIA,githubRender:!!env.RIDGE_GITHUB_TOKEN,browserRun:!!env.BROWSER,vusicConfigured:!!(env.BROWSER&&env.VUSIC_USERNAME&&env.VUSIC_PASSWORD),paidFallback:false,localFinalRender:false});
    if(u.pathname==='/api/resilience/cleanup'&&request.method==='POST'){if(!admin(request,env))return json({error:'Ridge admin authorization required'},401);return json({ok:true,deleted:await cleanupExpired(env)})}
    if(u.pathname==='/api/render/capabilities'&&request.method==='GET')return json({ok:true,ready:!!(env.RELEASE_MEDIA&&env.RIDGE_GITHUB_TOKEN),r2:!!env.RELEASE_MEDIA,githubRender:!!env.RIDGE_GITHUB_TOKEN,phoneEncoding:false,desktopEncoding:false,resumable:true,paidFallback:false});
    if(u.pathname==='/api/render/start'&&request.method==='POST')return base.fetch(rewrite(request,'/api/mobile/render'),env,ctx);
    if(u.pathname.startsWith('/api/render/status/')&&request.method==='GET')return base.fetch(rewrite(request,u.pathname.replace('/api/render/status/','/api/mobile/render-status/')),env,ctx);
    if(u.pathname.startsWith('/api/render/download/')&&request.method==='GET')return base.fetch(rewrite(request,u.pathname.replace('/api/render/download/','/api/mobile/render-download/')),env,ctx);
    if(u.pathname==='/api/pipeline/stage'&&request.method==='POST')return pipelineStage(request,env);
    if(u.pathname.startsWith('/api/pipeline/file/')&&request.method==='GET')return pipelineFile(request,env);
    if(u.pathname==='/api/pipeline/render'&&request.method==='POST')return pipelineRender(request,env);
    if(u.pathname.startsWith('/api/pipeline/render-result/')&&request.method==='PUT')return pipelineRenderResult(request,env);
    if(u.pathname.startsWith('/api/pipeline/render-status/')&&request.method==='GET')return pipelineRenderStatus(request,env);
    if(u.pathname.startsWith('/api/pipeline/render-download/')&&request.method==='GET')return pipelineRenderDownload(request,env);
    return base.fetch(request,env,ctx);
  },
  async scheduled(_event,env,_ctx){await cleanupExpired(env)}
};
