'use strict';

import base from './worker-v7.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const enc=new TextEncoder();
const b64url=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
const safe=(v,n=500)=>String(v??'').trim().slice(0,n);
const mobileStatusKey=id=>`mobile-render/${id}.json`;
const pipelineStatusKey=id=>`pipeline-render/${id}.json`;
async function writeStatus(env,key,data){if(!env.RELEASE_MEDIA)return false;await env.RELEASE_MEDIA.put(key,JSON.stringify(data),{httpMetadata:{contentType:'application/json'},customMetadata:{expires:String(Date.now()+24*60*60*1000)}});return true}

async function failureCallback(request,env,kind){
  if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);
  const u=new URL(request.url),id=u.pathname.split('/').pop()||'',exp=Number(u.searchParams.get('exp')||0),sig=u.searchParams.get('sig')||'';
  if(!id||!exp||exp<Date.now())return json({error:'expired callback'},410);
  const secret=kind==='pipeline'?String(env.RIDGE_ADMIN_TOKEN||env.VUSIC_PASSWORD||''):String(env.RIDGE_ADMIN_TOKEN||'');if(!secret)return json({error:'Ridge signing secret unavailable'},503);
  const message=kind==='pipeline'?`${id}:${exp}:pipeline-result`:`${id}:${exp}:result`;if(await hmac(secret,message)!==sig)return json({error:'invalid callback signature'},403);
  if(request.method!=='POST')return json({error:'POST required'},405);
  const body=await request.json().catch(()=>({})),error=safe(body.error||'Cloud render failed',800),step=safe(body.step,160),runUrl=safe(body.runUrl,1000);
  const state={id,status:'failed',error,step,runUrl,finishedAt:new Date().toISOString(),source:'github-actions'};
  await writeStatus(env,kind==='pipeline'?pipelineStatusKey(id):mobileStatusKey(id),state);return json({ok:true});
}

async function statusWithStaleGuard(request,env,ctx,kind){
  const r=await base.fetch(request,env,ctx);if(r.status!==200||!env.RELEASE_MEDIA)return r;
  let state;try{state=await r.clone().json()}catch{return r}
  if(state?.status!=='queued'||!state.createdAt)return r;
  const age=Date.now()-Date.parse(state.createdAt);if(!Number.isFinite(age)||age<45*60*1000)return r;
  const id=new URL(request.url).pathname.split('/').pop()||'';if(!id)return r;
  const failed={...state,status:'failed',error:'Cloud renderer stopped reporting before completion. Ridge marked this job stale so it can be retried safely.',finishedAt:new Date().toISOString(),stale:true};
  await writeStatus(env,kind==='pipeline'?pipelineStatusKey(id):mobileStatusKey(id),failed);return json(failed);
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
    if(u.pathname==='/api/resilience/health'&&request.method==='GET')return json({ok:true,worker:'v8',r2:!!env.RELEASE_MEDIA,githubRender:!!env.RIDGE_GITHUB_TOKEN,browserRun:!!env.BROWSER,vusicConfigured:!!(env.BROWSER&&env.VUSIC_USERNAME&&env.VUSIC_PASSWORD),paidFallback:false,localFinalRender:false,failureCallbacks:true,staleJobRecovery:true});
    if(u.pathname.startsWith('/api/mobile/render-failure/'))return failureCallback(request,env,'mobile');
    if(u.pathname.startsWith('/api/pipeline/render-failure/'))return failureCallback(request,env,'pipeline');
    if(u.pathname.startsWith('/api/render/status/')&&request.method==='GET')return statusWithStaleGuard(request,env,ctx,'mobile');
    if(u.pathname.startsWith('/api/pipeline/render-status/')&&request.method==='GET')return statusWithStaleGuard(request,env,ctx,'pipeline');
    return base.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(base.scheduled)return base.scheduled(event,env,ctx)}
};
