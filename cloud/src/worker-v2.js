import base from './worker.js';
import {socialCapabilities,crossPost,SocialPublishError} from './providers/social.js';
import {vusicCapabilities,distributeVusic,VusicProviderError} from './providers/vusic.js';
import {normalizeVusicRelease,VUSIC_PROFILE} from './providers/vusic-profile.js';
import {vusicBindingStatus,smokeVusicLogin} from './providers/vusic-smoke.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors,...extra}});
const safe=(v,n=500)=>String(v??'').trim().slice(0,n);

function authorised(request,env){if(!env.RIDGE_ADMIN_TOKEN)return false;const h=request.headers.get('Authorization')||'';return h===`Bearer ${env.RIDGE_ADMIN_TOKEN}`;}
function requireAdmin(request,env){return authorised(request,env)?null:json({error:'Ridge admin authorization required'},401,{'WWW-Authenticate':'Bearer'});}
function providerError(e){if(e instanceof SocialPublishError||e instanceof VusicProviderError)return json({error:e.message,code:e.code,detail:e.detail||undefined},e.status||502);return json({error:safe(e?.message||e,500),code:'RELEASE_PROVIDER_ERROR'},503);}
function stageName(request){const u=new URL(request.url),name=u.pathname.split('/').pop()||'';return /^[0-9a-f-]{36}(?:\.[a-z0-9]{1,8})?$/i.test(name)?name:''}
function cacheStageRequest(request,name){const u=new URL(request.url);u.pathname=`/api/release/stage/${name}`;u.search='';return new Request(u.toString(),{method:'GET'});}

async function stageUpload(request,env){
  const form=await request.formData().catch(()=>null),file=form?.get('file');if(!(file instanceof File))return json({error:'multipart file field required'},400);
  const max=60*1024*1024;if(file.size>max)return json({error:'file exceeds 60 MB staging limit'},413);
  const id=crypto.randomUUID(),ext=(file.name.match(/\.[a-z0-9]{1,8}$/i)||[''])[0].toLowerCase(),name=`${id}${ext}`,key=`release-stage/${name}`,expires=Date.now()+20*60*1000,origin=new URL(request.url).origin;
  if(env.RELEASE_MEDIA){
    await env.RELEASE_MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{expires:String(expires),name:safe(file.name,180)}});
    return json({ok:true,id,key,url:`${origin}/api/release/stage/${encodeURIComponent(name)}`,name:file.name,type:file.type,size:file.size,expiresAt:new Date(expires).toISOString(),storage:'r2'});
  }
  const headers=new Headers({'Content-Type':file.type||'application/octet-stream','Cache-Control':'public, max-age=1200','X-Ridge-Expires':String(expires),'X-Ridge-Name':encodeURIComponent(safe(file.name,180)),...cors});
  await caches.default.put(cacheStageRequest(request,name),new Response(file.stream(),{headers}));
  return json({ok:true,id,key:`cache-stage/${name}`,url:`${origin}/api/release/stage/${encodeURIComponent(name)}`,name:file.name,type:file.type,size:file.size,expiresAt:new Date(expires).toISOString(),storage:'worker-cache'});
}
async function stageGet(request,env){
  const name=stageName(request);if(!name)return json({error:'bad stage id'},400);
  if(env.RELEASE_MEDIA){
    const obj=await env.RELEASE_MEDIA.get(`release-stage/${name}`);if(obj){const expires=Number(obj.customMetadata?.expires||0);if(expires&&Date.now()>expires){await env.RELEASE_MEDIA.delete(`release-stage/${name}`);return json({error:'expired'},410);}const h=new Headers(cors);obj.writeHttpMetadata(h);h.set('Cache-Control','private, max-age=300');h.set('Content-Disposition',`inline; filename="${safe(obj.customMetadata?.name||name,160).replace(/"/g,'')}"`);return new Response(obj.body,{headers:h});}
  }
  const hit=await caches.default.match(cacheStageRequest(request,name));if(!hit)return json({error:'not found'},404);const expires=Number(hit.headers.get('X-Ridge-Expires')||0);if(expires&&Date.now()>expires){await caches.default.delete(cacheStageRequest(request,name));return json({error:'expired'},410);}const h=new Headers(hit.headers);for(const [k,v] of Object.entries(cors))h.set(k,v);h.set('Cache-Control','public, max-age=300');const original=decodeURIComponent(h.get('X-Ridge-Name')||name);h.set('Content-Disposition',`inline; filename="${safe(original,160).replace(/"/g,'')}"`);return new Response(hit.body,{status:200,headers:h});
}
async function stageDelete(request,env){const body=await request.json().catch(()=>({})),key=safe(body.key,500);if(key.startsWith('release-stage/')&&env.RELEASE_MEDIA){await env.RELEASE_MEDIA.delete(key);return json({ok:true});}if(key.startsWith('cache-stage/')){const name=key.slice('cache-stage/'.length);await caches.default.delete(cacheStageRequest(request,name));return json({ok:true});}return json({error:'valid stage key required'},400);}

export default{async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
  if(u.pathname==='/api/release/vusic-status'&&request.method==='GET')return json({ok:true,...vusicBindingStatus(env)});
  if(u.pathname==='/api/release/vusic-login-smoke'&&request.method==='POST'){const denied=requireAdmin(request,env);if(denied)return denied;try{return json(await smokeVusicLogin(env),200)}catch(e){return providerError(e)}}
  if(u.pathname==='/api/release/capabilities'&&request.method==='GET'){const denied=requireAdmin(request,env);if(denied)return denied;return json({ok:true,social:socialCapabilities(env),vusic:vusicCapabilities(env),vusicProfile:{primaryArtist:VUSIC_PROFILE.primaryArtist,label:VUSIC_PROFILE.label,releasedPreviously:VUSIC_PROFILE.releasedPreviously,platforms:VUSIC_PROFILE.platforms,explicitContent:VUSIC_PROFILE.explicitContent,releaseDateRule:VUSIC_PROFILE.releaseDateRule},staging:true,stagingMode:env.RELEASE_MEDIA?'r2':'worker-cache'});}
  if(u.pathname==='/api/release/stage'&&request.method==='POST'){const denied=requireAdmin(request,env);if(denied)return denied;return stageUpload(request,env);}
  if(u.pathname.startsWith('/api/release/stage/')&&request.method==='GET')return stageGet(request,env);
  if(u.pathname==='/api/release/stage'&&request.method==='DELETE'){const denied=requireAdmin(request,env);if(denied)return denied;return stageDelete(request,env);}
  if(u.pathname==='/api/release/crosspost'&&request.method==='POST'){const denied=requireAdmin(request,env);if(denied)return denied;try{return json(await crossPost(env,await request.json().catch(()=>({}))),207)}catch(e){return providerError(e)}}
  if(u.pathname==='/api/release/vusic'&&request.method==='POST'){const denied=requireAdmin(request,env);if(denied)return denied;try{return json(await distributeVusic(env,normalizeVusicRelease(await request.json().catch(()=>({})))),200)}catch(e){return providerError(e)}}
  return base.fetch(request,env,ctx);
}};
