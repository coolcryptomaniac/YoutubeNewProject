'use strict';

import base from './worker-v9.js';
import {createDirectorPlan,directorCapabilities} from './providers/director.js';
import {createSong,listSongs,getSong,putSongFile,startMultipart,uploadMultipartPart,completeMultipart,abortMultipart,getSongFile,updateSong,libraryCapabilities} from './providers/song-library.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const enc=new TextEncoder(),dec=new TextDecoder();
const b64url=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const fromB64url=s=>{const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/');const raw=atob(p+'='.repeat((4-p.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
function admin(request,env){return !!env.RIDGE_ADMIN_TOKEN&&(request.headers.get('Authorization')||'')===`Bearer ${env.RIDGE_ADMIN_TOKEN}`}
function sessionToken(request){const u=new URL(request.url),h=request.headers.get('X-Ridge-Session')||request.headers.get('Authorization')||u.searchParams.get('session')||'';return h.replace(/^Bearer\s+/i,'').trim()}
async function session(request,env){const secret=String(env.RIDGE_ADMIN_TOKEN||env.VUSIC_PASSWORD||''),token=sessionToken(request);if(!secret||!token)return null;try{const [body,sig]=token.split('.');if(!body||!sig||await hmac(secret,body)!==sig)return null;const d=JSON.parse(dec.decode(fromB64url(body)));return d.scope==='ridge-session'&&Number(d.exp)>Date.now()?d:null}catch{return null}}
async function authorised(request,env){return admin(request,env)||!!await session(request,env)}
function pathParts(u){return u.pathname.split('/').filter(Boolean).map(decodeURIComponent)}
function byteRange(request){const x=request.headers.get('Range')||'';const m=x.match(/^bytes=(\d+)-(\d*)$/i);if(!m)return null;const offset=Number(m[1]),end=m[2]?Number(m[2]):null;return{offset,length:end==null?undefined:Math.max(0,end-offset+1)}}
async function signedFileUrl(request,env,id,path,ttl=2*60*60*1000){const exp=Date.now()+ttl,msg=`${id}:${path}:${exp}:library-file`,sig=await hmac(String(env.RIDGE_ADMIN_TOKEN||env.VUSIC_PASSWORD||''),msg),u=new URL(request.url);u.pathname=`/api/library/file/${encodeURIComponent(id)}/${path.split('/').map(encodeURIComponent).join('/')}`;u.search='';u.searchParams.set('exp',String(exp));u.searchParams.set('sig',sig);return u.toString()}
async function signedFileAllowed(request,env,id,path){const u=new URL(request.url),exp=Number(u.searchParams.get('exp')||0),sig=u.searchParams.get('sig')||'';if(!exp||exp<Date.now()||!sig)return false;const secret=String(env.RIDGE_ADMIN_TOKEN||env.VUSIC_PASSWORD||'');return !!secret&&await hmac(secret,`${id}:${path}:${exp}:library-file`)===sig}
async function libraryFileResponse(request,env,id,path){if(!(await authorised(request,env))&&!(await signedFileAllowed(request,env,id,path)))return json({error:'Ridge library authorization required'},401);const range=byteRange(request),obj=await getSongFile(env,id,path,range);if(!obj)return json({error:'Library file not found'},404);const h=new Headers(cors);obj.writeHttpMetadata(h);h.set('ETag',obj.httpEtag||obj.etag||'');h.set('Accept-Ranges','bytes');h.set('Cache-Control','private,max-age=300');if(range&&obj.range){const start=obj.range.offset,end=start+obj.range.length-1;h.set('Content-Range',`bytes ${start}-${end}/${obj.size}`);h.set('Content-Length',String(obj.range.length));return new Response(obj.body,{status:206,headers:h})}return new Response(obj.body,{status:200,headers:h})}

async function libraryRoute(request,env){
  if(!env.RELEASE_MEDIA)return json({error:'R2 song library unavailable'},503);const u=new URL(request.url),p=pathParts(u);
  if(p[2]==='capabilities'&&request.method==='GET')return json({ok:true,...libraryCapabilities(env),director:directorCapabilities(env)});
  if(p[2]==='file'&&p[3]&&p.length>=5)return libraryFileResponse(request,env,p[3],p.slice(4).join('/'));
  if(!(await authorised(request,env)))return json({error:'Ridge library authorization required'},401);
  if(p.length===3&&p[2]==='songs'){
    if(request.method==='POST'){const body=await request.json().catch(()=>({}));return json({ok:true,song:await createSong(env,body)},201)}
    if(request.method==='GET'){const out=await listSongs(env,{limit:u.searchParams.get('limit'),cursor:u.searchParams.get('cursor')});return json({ok:true,...out})}
  }
  const id=p[3];if(p[2]!=='songs'||!id)return json({error:'Unknown library route'},404);
  if(p.length===4){
    if(request.method==='GET'){const song=await getSong(env,id,{refreshUsage:u.searchParams.get('usage')==='1'});return song?json({ok:true,song}):json({error:'Song not found'},404)}
    if(request.method==='PATCH'){const song=await updateSong(env,id,await request.json().catch(()=>({})));return song?json({ok:true,song}):json({error:'Song not found'},404)}
  }
  if(p[4]==='upload'&&request.method==='POST'){
    const form=await request.formData().catch(()=>null),file=form?.get('file'),path=safe(form?.get('path')||u.searchParams.get('path'),240);if(!(file instanceof File)||!path)return json({error:'file and path are required'},400);if(file.size>95*1024*1024)return json({error:'Use multipart upload for files above 95 MB'},413);
    const out=await putSongFile(env,id,path,file.stream(),{contentType:file.type||'application/octet-stream',source:safe(form.get('source')||'upload',80),provider:safe(form.get('provider'),80),license:safe(form.get('license'),120),sourceUrl:safe(form.get('sourceUrl'),500),size:file.size});return json(out,201);
  }
  if(p[4]==='multipart'&&p[5]==='start'&&request.method==='POST'){const b=await request.json().catch(()=>({}));return json(await startMultipart(env,id,b.path,b),201)}
  if(p[4]==='multipart'&&p[5]==='part'&&request.method==='PUT'){const path=u.searchParams.get('path'),uploadId=u.searchParams.get('uploadId'),partNumber=u.searchParams.get('partNumber');return json(await uploadMultipartPart(env,id,path,uploadId,partNumber,request.body))}
  if(p[4]==='multipart'&&p[5]==='complete'&&request.method==='POST'){const b=await request.json().catch(()=>({}));return json(await completeMultipart(env,id,b.path,b.uploadId,b.parts,b))}
  if(p[4]==='multipart'&&p[5]==='abort'&&request.method==='POST'){const b=await request.json().catch(()=>({}));return json(await abortMultipart(env,id,b.path,b.uploadId))}
  if(p[4]==='director'&&request.method==='POST'){
    const song=await getSong(env,id);if(!song)return json({error:'Song not found'},404);const b=await request.json().catch(()=>({})),out=await createDirectorPlan(env,{...b,title:b.title||song.title});
    await putSongFile(env,id,'analysis/director-plan.json',JSON.stringify(out.plan),{contentType:'application/json',source:'ridge-director',provider:out.provider,size:new Blob([JSON.stringify(out.plan)]).size});await updateSong(env,id,{analysis:{status:'ready',directorModel:out.model,updatedAt:new Date().toISOString()}});return json(out);
  }
  if(p[4]==='promote-render'&&request.method==='POST'){
    const b=await request.json().catch(()=>({})),renderId=safe(b.renderId,120),target=safe(b.path||'video/master-1080p.mp4',200);if(!renderId)return json({error:'renderId required'},400);const obj=await env.RELEASE_MEDIA.get(`pipeline-render/${renderId}.mp4`);if(!obj)return json({error:'Render result not found'},404);const out=await putSongFile(env,id,target,obj.body,{contentType:'video/mp4',source:'ridge-render',provider:'github-ffmpeg',size:obj.size});await updateSong(env,id,{render:{status:'ready',path:target,renderId,updatedAt:new Date().toISOString()}});return json(out);
  }
  if(p[4]==='signed-url'&&request.method==='POST'){const b=await request.json().catch(()=>({})),path=safe(b.path,240);if(!path)return json({error:'path required'},400);return json({ok:true,url:await signedFileUrl(request,env,id,path,Math.min(12*60*60*1000,Math.max(5*60*1000,Number(b.ttlMs)||2*60*60*1000)))})}
  if(p[4]==='vusic'&&request.method==='POST'){
    const song=await getSong(env,id);if(!song)return json({error:'Song not found'},404);const b=await request.json().catch(()=>({})),audioPath=safe(b.audioPath||song.files?.find(x=>x.kind==='audio')?.path,240),coverPath=safe(b.coverPath||song.files?.find(x=>x.kind==='image')?.path,240);if(!audioPath||!coverPath)return json({error:'Song needs audio and cover in the library'},400);
    const payload={...b,title:b.title||song.title,audioUrl:await signedFileUrl(request,env,id,audioPath),audioName:audioPath.split('/').pop(),audioType:song.files?.find(x=>x.path===audioPath)?.contentType||'audio/wav',artworkUrl:await signedFileUrl(request,env,id,coverPath),artworkName:coverPath.split('/').pop(),artworkType:song.files?.find(x=>x.path===coverPath)?.contentType||'image/jpeg',confirmSubmit:b.confirmSubmit===true};const u2=new URL(request.url);u2.pathname='/api/pipeline/vusic-release';u2.search='';const h=new Headers(request.headers);h.set('Content-Type','application/json');const r=await base.fetch(new Request(u2,{method:'POST',headers:h,body:JSON.stringify(payload)}),env,{});let out={};try{out=await r.clone().json()}catch{}if(r.ok&&out?.ok)await updateSong(env,id,{vusic:{status:out.submitted?'submitted':'ready',submitted:!!out.submitted,updatedAt:new Date().toISOString()}});return new Response(r.body,{status:r.status,headers:r.headers});
  }
  return json({error:'Unknown library route'},404);
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
    if(u.pathname.startsWith('/api/library/')){try{return await libraryRoute(request,env)}catch(e){return json({error:safe(e?.message||e,700)},503)}}
    if(u.pathname==='/api/resilience/health'&&request.method==='GET'){const r=await base.fetch(request,env,ctx);let b={};try{b=await r.clone().json()}catch{}return json({...b,ok:true,worker:'v10',songLibrary:libraryCapabilities(env),director:directorCapabilities(env),youtubeDailySafetyCap:Number(env.YOUTUBE_DAILY_UPLOAD_CAP||10)})}
    return base.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(base.scheduled)return base.scheduled(event,env,ctx)}
};
