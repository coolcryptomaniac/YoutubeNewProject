'use strict';

import base from './worker-v5.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const enc=new TextEncoder();
const b64url=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const textB64=s=>b64url(enc.encode(String(s||'')));
function authorised(request,env){const h=request.headers.get('Authorization')||'';return !!env.RIDGE_ADMIN_TOKEN&&h===`Bearer ${env.RIDGE_ADMIN_TOKEN}`}
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
const statusKey=id=>`mobile-render/${id}.json`,resultKey=id=>`mobile-render/${id}.mp4`;
async function putStatus(env,id,data){await env.RELEASE_MEDIA.put(statusKey(id),JSON.stringify(data),{httpMetadata:{contentType:'application/json'},customMetadata:{expires:String(Date.now()+24*60*60*1000)}})}
async function getStatus(env,id){const x=await env.RELEASE_MEDIA.get(statusKey(id));if(!x)return null;return x.json().catch(()=>null)}
async function signedDownload(request,env,id,ttl=60*60*1000){const exp=Date.now()+ttl,sig=await hmac(env.RIDGE_ADMIN_TOKEN,`${id}:${exp}:download`),u=new URL(request.url);u.pathname=`/api/mobile/render-download/${id}`;u.search='';u.searchParams.set('exp',String(exp));u.searchParams.set('sig',sig);return u.toString()}
async function dispatchRender(request,env){
  if(!authorised(request,env))return json({error:'Ridge admin authorization required'},401);
  if(!env.RELEASE_MEDIA)return json({error:'Crash-proof Android rendering requires the RELEASE_MEDIA R2 binding. Enable R2 once; Ridge will not fall back to phone encoding.'},503);
  if(!env.RIDGE_GITHUB_TOKEN)return json({error:'RIDGE_GITHUB_TOKEN is not configured for GitHub Actions cloud rendering.'},503);
  const body=await request.json().catch(()=>({})),audioUrl=safe(body.audioUrl,2200),coverUrl=safe(body.coverUrl,2200),title=safe(body.title||'Ridge Music Video',180),lyrics=safe(body.lyrics,18000),mode=['auto','lyrics','visualizer','photo','pexels'].includes(body.mode)?body.mode:'auto',queries=(Array.isArray(body.queries)?body.queries:[]).map(x=>safe(x,160)).filter(Boolean).slice(0,6);
  if(!audioUrl)return json({error:'staged audio URL required'},400);
  const id=crypto.randomUUID(),exp=Date.now()+2*60*60*1000,sig=await hmac(env.RIDGE_ADMIN_TOKEN,`${id}:${exp}:result`),origin=new URL(request.url).origin,callback=`${origin}/api/mobile/render-result/${id}?exp=${exp}&sig=${sig}`;
  await putStatus(env,id,{id,status:'queued',createdAt:new Date().toISOString(),mode,title});
  const payload={ref:'main',inputs:{job_id:id,audio_url:audioUrl,cover_url:coverUrl,mode,title_b64:textB64(title),lyrics_b64:textB64(lyrics),queries_b64:textB64(JSON.stringify(queries)),cloud_url:origin,callback_url:callback}};
  const r=await fetch('https://api.github.com/repos/coolcryptomaniac/YoutubeNewProject/actions/workflows/ridge-cloud-render.yml/dispatches',{method:'POST',headers:{Authorization:`Bearer ${env.RIDGE_GITHUB_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Ridge-Studio'},body:JSON.stringify(payload)});
  if(!r.ok){const detail=(await r.text()).slice(0,600);await putStatus(env,id,{id,status:'failed',error:`GitHub dispatch ${r.status}`,detail});return json({error:`GitHub render dispatch ${r.status}`,detail},503)}
  return json({ok:true,id,status:'queued'});
}
async function renderResult(request,env){
  if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);
  const u=new URL(request.url),id=u.pathname.split('/').pop()||'',exp=Number(u.searchParams.get('exp')||0),sig=u.searchParams.get('sig')||'';
  if(!id||!exp||exp<Date.now())return json({error:'expired callback'},410);
  if(await hmac(env.RIDGE_ADMIN_TOKEN,`${id}:${exp}:result`)!==sig)return json({error:'invalid callback signature'},403);
  if(request.method!=='PUT')return json({error:'PUT required'},405);
  const len=Number(request.headers.get('Content-Length')||0);if(len>120*1024*1024)return json({error:'render exceeds 120 MB cloud result limit'},413);
  await env.RELEASE_MEDIA.put(resultKey(id),request.body,{httpMetadata:{contentType:request.headers.get('Content-Type')||'video/mp4'},customMetadata:{expires:String(Date.now()+24*60*60*1000)}});
  await putStatus(env,id,{id,status:'done',finishedAt:new Date().toISOString()});return json({ok:true});
}
async function renderStatus(request,env){
  if(!authorised(request,env))return json({error:'Ridge admin authorization required'},401);if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);
  const id=new URL(request.url).pathname.split('/').pop()||'',s=await getStatus(env,id);if(!s)return json({error:'render job not found'},404);if(s.status==='done')s.downloadUrl=await signedDownload(request,env,id);return json(s);
}
async function renderDownload(request,env){
  if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);const u=new URL(request.url),id=u.pathname.split('/').pop()||'',exp=Number(u.searchParams.get('exp')||0),sig=u.searchParams.get('sig')||'';
  if(!id||!exp||exp<Date.now())return json({error:'expired download'},410);if(await hmac(env.RIDGE_ADMIN_TOKEN,`${id}:${exp}:download`)!==sig)return json({error:'invalid download signature'},403);
  const obj=await env.RELEASE_MEDIA.get(resultKey(id));if(!obj)return json({error:'render result not found'},404);const h=new Headers(cors);obj.writeHttpMetadata(h);h.set('Content-Disposition',`attachment; filename="ridge-${id}.mp4"`);h.set('Cache-Control','private,max-age=300');return new Response(obj.body,{headers:h});
}

export default{async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
  if(u.pathname==='/api/mobile/capabilities'&&request.method==='GET')return json({ok:true,cloudRender:!!env.RIDGE_GITHUB_TOKEN,r2:!!env.RELEASE_MEDIA,phoneEncoding:false,crashProof:!!(env.RIDGE_GITHUB_TOKEN&&env.RELEASE_MEDIA)});
  if(u.pathname==='/api/mobile/render'&&request.method==='POST')return dispatchRender(request,env);
  if(u.pathname.startsWith('/api/mobile/render-result/'))return renderResult(request,env);
  if(u.pathname.startsWith('/api/mobile/render-status/')&&request.method==='GET')return renderStatus(request,env);
  if(u.pathname.startsWith('/api/mobile/render-download/')&&request.method==='GET')return renderDownload(request,env);
  return base.fetch(request,env,ctx);
}};
