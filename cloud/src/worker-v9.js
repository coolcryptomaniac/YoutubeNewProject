'use strict';

import base from './worker-v8.js';
import {authorizeAutomation,isAdmin,GITHUB_OIDC_INFO} from './providers/github-oidc.js';
import {vusicAccountSmoke} from './providers/vusic-account-smoke.js';
import {vusicWizardSmoke} from './providers/vusic-wizard-smoke.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const enc=new TextEncoder();
const b64url=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const textB64=s=>b64url(enc.encode(String(s||'')));
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
const admin=(request,env)=>isAdmin(request,env);

const statusKey=id=>`mobile-render/${id}.json`;
const queueKey=id=>`render-queue/${id}.json`;
const leaseKey=id=>`render-lease/${id}.json`;
async function readJson(env,key){const obj=await env.RELEASE_MEDIA?.get(key);if(!obj)return null;return obj.json().catch(()=>null)}
async function writeJson(env,key,data,ttlMs=24*60*60*1000){if(!env.RELEASE_MEDIA)return false;await env.RELEASE_MEDIA.put(key,JSON.stringify(data),{httpMetadata:{contentType:'application/json'},customMetadata:{expires:String(Date.now()+ttlMs)}});return true}

async function queueAuth(request,env){return authorizeAutomation(request,env,{audience:'ridge-render-queue',workflow:'ridge-render-queue.yml',events:['schedule','workflow_dispatch']})}
async function deploySmokeAuth(request,env){return authorizeAutomation(request,env,{audience:'ridge-deploy-smoke',workflow:'deploy-ridge-cloud.yml',events:['push','workflow_dispatch']})}
async function vusicCanaryAuth(request,env){return authorizeAutomation(request,env,{audience:'ridge-vusic-canary',workflow:'vusic-e2e-canary.yml',events:['schedule','workflow_dispatch']})}
async function vusicLiveProofAuth(request,env){return authorizeAutomation(request,env,{audience:'ridge-vusic-live-proof',workflow:'vusic-live-proof.yml',events:['push']})}
function asAdminRequest(request,env){const h=new Headers(request.headers);h.set('Authorization',`Bearer ${env.RIDGE_ADMIN_TOKEN}`);return new Request(request,{headers:h})}
const deploySmokePath=(u,m)=>(u.pathname==='/api/release/capabilities'&&m==='GET')||(u.pathname==='/api/release/vusic-login-smoke'&&m==='POST');
const vusicCanaryPath=(u,m)=>deploySmokePath(u,m)||(u.pathname==='/api/release/stage'&&(m==='POST'||m==='DELETE'))||(u.pathname==='/api/release/vusic'&&m==='POST');

async function enqueueRender(request,env){
  if(!admin(request,env))return json({error:'Ridge admin authorization required'},401);
  if(!env.RELEASE_MEDIA)return json({error:'R2 is required for crash-resistant cloud rendering'},503);
  if(!env.RIDGE_ADMIN_TOKEN)return json({error:'RIDGE_ADMIN_TOKEN is required for signed render callbacks'},503);
  const body=await request.json().catch(()=>({}));
  const audioUrl=safe(body.audioUrl,2200),coverUrl=safe(body.coverUrl,2200),title=safe(body.title||'Ridge Music Video',180),lyrics=safe(body.lyrics,18000),mode=['auto','lyrics','visualizer','photo','pexels'].includes(body.mode)?body.mode:'auto',queries=(Array.isArray(body.queries)?body.queries:[]).map(x=>safe(x,160)).filter(Boolean).slice(0,6);
  if(!audioUrl)return json({error:'staged audio URL required'},400);
  const id=crypto.randomUUID(),exp=Date.now()+2*60*60*1000,origin=new URL(request.url).origin,sig=await hmac(env.RIDGE_ADMIN_TOKEN,`${id}:${exp}:result`),callback=`${origin}/api/mobile/render-result/${id}?exp=${exp}&sig=${sig}`;
  const createdAt=new Date().toISOString();
  const job={id,createdAt,mode,audio_url:audioUrl,cover_url:coverUrl,title_b64:textB64(title),lyrics_b64:textB64(lyrics),queries_b64:textB64(JSON.stringify(queries)),cloud_url:origin,callback_url:callback,title};
  await writeJson(env,statusKey(id),{id,status:'queued',createdAt,mode,title,transport:'r2-github-scheduler'});
  await writeJson(env,queueKey(id),job,2*60*60*1000);
  return json({ok:true,id,status:'queued',transport:'r2-github-scheduler',schedulerAuth:'github-oidc',pickupIntervalMinutes:5,resumable:true});
}

async function claimRender(request,env){
  if(!(await queueAuth(request,env)))return json({error:'Ridge queue authorization required'},401);
  if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);
  const page=await env.RELEASE_MEDIA.list({prefix:'render-queue/',limit:25});
  const now=Date.now();
  for(const obj of page.objects){
    const job=await readJson(env,obj.key);if(!job?.id)continue;
    const status=await readJson(env,statusKey(job.id));if(status?.status==='done'||status?.status==='failed'){await env.RELEASE_MEDIA.delete(obj.key);await env.RELEASE_MEDIA.delete(leaseKey(job.id));continue}
    const lease=await readJson(env,leaseKey(job.id));if(lease?.leasedUntil&&Number(lease.leasedUntil)>now)continue;
    const leasedUntil=now+10*60*1000,claimId=crypto.randomUUID();
    await writeJson(env,leaseKey(job.id),{id:job.id,claimId,leasedUntil,claimedAt:new Date(now).toISOString()},12*60*1000);
    return json({ok:true,empty:false,claimId,leasedUntil,job});
  }
  return json({ok:true,empty:true});
}

async function ackRender(request,env){
  if(!(await queueAuth(request,env)))return json({error:'Ridge queue authorization required'},401);
  if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);
  const id=new URL(request.url).pathname.split('/').pop()||'',body=await request.json().catch(()=>({})),claimId=safe(body.claimId,120);
  if(!id||!claimId)return json({error:'render id and claimId required'},400);
  const lease=await readJson(env,leaseKey(id));if(!lease||lease.claimId!==claimId)return json({error:'render claim is missing or no longer current'},409);
  await env.RELEASE_MEDIA.delete(queueKey(id));await env.RELEASE_MEDIA.delete(leaseKey(id));
  const old=await readJson(env,statusKey(id))||{id,createdAt:new Date().toISOString()};
  await writeJson(env,statusKey(id),{...old,status:'queued',dispatchedAt:new Date().toISOString(),transport:'r2-github-scheduler'});
  return json({ok:true,id});
}

async function releaseClaim(request,env){
  if(!(await queueAuth(request,env)))return json({error:'Ridge queue authorization required'},401);
  if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);
  const id=new URL(request.url).pathname.split('/').pop()||'',body=await request.json().catch(()=>({})),claimId=safe(body.claimId,120);
  if(!id||!claimId)return json({error:'render id and claimId required'},400);
  const lease=await readJson(env,leaseKey(id));if(lease?.claimId===claimId)await env.RELEASE_MEDIA.delete(leaseKey(id));
  return json({ok:true,id,released:true});
}

async function capabilities(env){
  return json({ok:true,ready:!!(env.RELEASE_MEDIA&&env.RIDGE_ADMIN_TOKEN),r2:!!env.RELEASE_MEDIA,adminConfigured:!!env.RIDGE_ADMIN_TOKEN,githubRender:!!env.RELEASE_MEDIA,renderTransport:'r2-github-scheduler',schedulerAuth:'github-oidc',directGithubDispatch:!!env.RIDGE_GITHUB_TOKEN,phoneEncoding:false,desktopEncoding:false,resumable:true,pickupIntervalMinutes:5,paidFallback:false});
}

async function maybeBridgeGitHubAutomation(request,env,ctx,u){
  if(admin(request,env)||!env.RIDGE_ADMIN_TOKEN)return null;
  let auth=null;
  if(deploySmokePath(u,request.method))auth=await deploySmokeAuth(request,env);
  if(!auth&&vusicCanaryPath(u,request.method))auth=await vusicCanaryAuth(request,env);
  if(!auth&&vusicCanaryPath(u,request.method))auth=await vusicLiveProofAuth(request,env);
  return auth?base.fetch(asAdminRequest(request,env),env,ctx):null;
}

async function vusicDirectSmokeAuth(request,env){
  if(admin(request,env))return true;
  if(await vusicCanaryAuth(request,env))return true;
  if(await vusicLiveProofAuth(request,env))return true;
  return false;
}
async function accountSmokeRoute(request,env){
  if(!(await vusicDirectSmokeAuth(request,env)))return json({error:'Ridge Vusic automation authorization required'},401);
  const body=await request.json().catch(()=>({}));
  const out=await vusicAccountSmoke(env,body);
  return json(out,out.ok?200:503);
}
async function wizardSmokeRoute(request,env){
  if(!(await vusicDirectSmokeAuth(request,env)))return json({error:'Ridge Vusic automation authorization required'},401);
  const body=await request.json().catch(()=>({}));
  const out=await vusicWizardSmoke(env,body);
  return json(out,out.ok?200:503);
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
    if(u.pathname==='/api/render/capabilities'&&request.method==='GET')return capabilities(env);
    if((u.pathname==='/api/render/start'||u.pathname==='/api/mobile/render')&&request.method==='POST')return enqueueRender(request,env);
    if(u.pathname==='/api/render/claim'&&request.method==='POST')return claimRender(request,env);
    if(u.pathname.startsWith('/api/render/ack/')&&request.method==='POST')return ackRender(request,env);
    if(u.pathname.startsWith('/api/render/release-claim/')&&request.method==='POST')return releaseClaim(request,env);
    if(u.pathname==='/api/release/vusic-account-smoke'&&request.method==='POST')return accountSmokeRoute(request,env);
    if(u.pathname==='/api/release/vusic-wizard-smoke'&&request.method==='POST')return wizardSmokeRoute(request,env);
    if(u.pathname.startsWith('/api/release/')){const bridged=await maybeBridgeGitHubAutomation(request,env,ctx,u);if(bridged)return bridged}
    if(u.pathname==='/api/resilience/health'&&request.method==='GET'){
      const upstream=await base.fetch(request,env,ctx);let body={};try{body=await upstream.clone().json()}catch{}
      return json({...body,ok:true,worker:'v9',r2:!!env.RELEASE_MEDIA,adminConfigured:!!env.RIDGE_ADMIN_TOKEN,githubRender:!!env.RELEASE_MEDIA,renderTransport:'r2-github-scheduler',schedulerAuth:'github-oidc',oidcIssuer:GITHUB_OIDC_INFO.issuer,directGithubDispatch:!!env.RIDGE_GITHUB_TOKEN,pickupIntervalMinutes:5,paidFallback:false,localFinalRender:false,failureCallbacks:true,staleJobRecovery:true});
    }
    return base.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(base.scheduled)return base.scheduled(event,env,ctx)}
};
