import base from './worker.js';
import {socialCapabilities,crossPost,SocialPublishError} from './providers/social.js';
import {vusicCapabilities,distributeVusic,VusicProviderError} from './providers/vusic.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors,...extra}});
const safe=(v,n=500)=>String(v??'').trim().slice(0,n);

function authorised(request,env){
  if(!env.RIDGE_ADMIN_TOKEN)return false;
  const h=request.headers.get('Authorization')||''; return h===`Bearer ${env.RIDGE_ADMIN_TOKEN}`;
}
function requireAdmin(request,env){ return authorised(request,env)?null:json({error:'Ridge admin authorization required'},401,{'WWW-Authenticate':'Bearer'}); }

function providerError(e){
  if(e instanceof SocialPublishError||e instanceof VusicProviderError)return json({error:e.message,code:e.code,detail:e.detail||undefined},e.status||502);
  return json({error:safe(e?.message||e,500),code:'RELEASE_PROVIDER_ERROR'},503);
}

async function stageUpload(request,env){
  if(!env.RELEASE_MEDIA)return json({error:'RELEASE_MEDIA R2 binding is not configured',code:'STAGING_NOT_CONFIGURED'},503);
  const form=await request.formData().catch(()=>null),file=form?.get('file');
  if(!(file instanceof File))return json({error:'multipart file field required'},400);
  const max=60*1024*1024;if(file.size>max)return json({error:'file exceeds 60 MB staging limit'},413);
  const id=crypto.randomUUID(),ext=(file.name.match(/\.[a-z0-9]{1,8}$/i)||[''])[0].toLowerCase(),key=`release-stage/${id}${ext}`;
  const expires=Date.now()+6*60*60*1000;
  await env.RELEASE_MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{expires:String(expires),name:safe(file.name,180)}});
  const origin=new URL(request.url).origin;
  return json({ok:true,id,key,url:`${origin}/api/release/stage/${encodeURIComponent(id)}${ext}`,name:file.name,type:file.type,size:file.size,expiresAt:new Date(expires).toISOString()});
}

async function stageGet(request,env){
  if(!env.RELEASE_MEDIA)return json({error:'staging unavailable'},404);
  const u=new URL(request.url),name=u.pathname.split('/').pop()||'';
  if(!/^[0-9a-f-]{36}(?:\.[a-z0-9]{1,8})?$/i.test(name))return json({error:'bad stage id'},400);
  const obj=await env.RELEASE_MEDIA.get(`release-stage/${name}`);if(!obj)return json({error:'not found'},404);
  const expires=Number(obj.customMetadata?.expires||0);if(expires&&Date.now()>expires){await env.RELEASE_MEDIA.delete(`release-stage/${name}`);return json({error:'expired'},410);}
  const h=new Headers(cors);obj.writeHttpMetadata(h);h.set('Cache-Control','private, max-age=300');h.set('Content-Disposition',`inline; filename="${safe(obj.customMetadata?.name||name,160).replace(/"/g,'')}"`);
  return new Response(obj.body,{headers:h});
}

async function stageDelete(request,env){
  if(!env.RELEASE_MEDIA)return json({error:'staging unavailable'},404);
  const body=await request.json().catch(()=>({})),key=safe(body.key,500);if(!key.startsWith('release-stage/'))return json({error:'valid stage key required'},400);
  await env.RELEASE_MEDIA.delete(key);return json({ok:true});
}

export default{async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const u=new URL(request.url);
  if(u.pathname==='/api/release/capabilities'&&request.method==='GET'){
    const denied=requireAdmin(request,env);if(denied)return denied;
    return json({ok:true,social:socialCapabilities(env),vusic:vusicCapabilities(env),staging:!!env.RELEASE_MEDIA});
  }
  if(u.pathname==='/api/release/stage'&&request.method==='POST'){
    const denied=requireAdmin(request,env);if(denied)return denied;return stageUpload(request,env);
  }
  if(u.pathname.startsWith('/api/release/stage/')&&request.method==='GET')return stageGet(request,env);
  if(u.pathname==='/api/release/stage'&&request.method==='DELETE'){
    const denied=requireAdmin(request,env);if(denied)return denied;return stageDelete(request,env);
  }
  if(u.pathname==='/api/release/crosspost'&&request.method==='POST'){
    const denied=requireAdmin(request,env);if(denied)return denied;
    try{return json(await crossPost(env,await request.json().catch(()=>({}))),207)}catch(e){return providerError(e)}
  }
  if(u.pathname==='/api/release/vusic'&&request.method==='POST'){
    const denied=requireAdmin(request,env);if(denied)return denied;
    try{return json(await distributeVusic(env,await request.json().catch(()=>({}))),200)}catch(e){return providerError(e)}
  }
  return base.fetch(request,env,ctx);
}};
