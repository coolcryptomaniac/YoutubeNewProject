'use strict';

import base from './worker-v10.js';
import {browserBudget} from './providers/browser-budget.js';
import {youtubeCapabilities,youtubeOauthStart,youtubeOauthCallback,youtubeStatus,youtubeUploadFromR2} from './providers/youtube-server.js';
import {getSong,getSongFile,putSongFile,updateSong} from './providers/song-library.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors,...headers}});
const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const enc=new TextEncoder(),dec=new TextDecoder();
const b64url=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const fromB64url=s=>{const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/');const raw=atob(p+'='.repeat((4-p.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
function admin(request,env){return !!env.RIDGE_ADMIN_TOKEN&&(request.headers.get('Authorization')||'')===`Bearer ${env.RIDGE_ADMIN_TOKEN}`}
function sessionToken(request){const u=new URL(request.url),h=request.headers.get('X-Ridge-Session')||request.headers.get('Authorization')||u.searchParams.get('session')||'';return h.replace(/^Bearer\s+/i,'').trim()}
async function session(request,env){const secret=String(env.RIDGE_ADMIN_TOKEN||env.VUSIC_PASSWORD||''),token=sessionToken(request);if(!secret||!token)return null;try{const [body,sig]=token.split('.');if(!body||!sig||await hmac(secret,body)!==sig)return null;const d=JSON.parse(dec.decode(fromB64url(body)));return d.scope==='ridge-session'&&Number(d.exp)>Date.now()?d:null}catch{return null}}
async function authorised(request,env){return admin(request,env)||!!await session(request,env)}

async function readDirector(env,id){const o=await getSongFile(env,id,'analysis/director-plan.json');if(!o)return null;return o.json().catch(()=>null)}
function hashtagList(xs=[]){return (Array.isArray(xs)?xs:[]).map(x=>String(x||'').trim()).filter(Boolean).map(x=>x.startsWith('#')?x:`#${x.replace(/[^\p{L}\p{N}_]/gu,'')}`).filter(x=>x.length>1).slice(0,12)}
async function youtubePackage(env,id,overrides={}){
  const song=await getSong(env,id);if(!song)throw new Error('Song not found');const files=Array.isArray(song.files)?song.files:[],video=files.find(x=>x.path==='video/master-1080p.mp4')||files.find(x=>x.path==='video/master-4k.mp4')||files.find(x=>x.kind==='video'),cover=files.find(x=>x.path==='cover/cover-youtube.jpg')||files.find(x=>x.path==='cover/cover-original.jpg')||files.find(x=>x.kind==='image');if(!video)throw new Error('Master music video is not ready in the song library');
  const director=await readDirector(env,id),yt=director?.youtube||{},tags=[song.artist,song.title,song.genre,'music','music video',...(yt.hashtags||[])].filter(Boolean),hashtags=hashtagList(yt.hashtags);let description=safe(overrides.description||yt.description,4500);if(!description)description=`${song.title} — ${song.artist}\n\nOfficial music video created and released through Ridge Studio.`;if(hashtags.length)description=`${description}\n\n${hashtags.join(' ')}`;
  const stock=files.filter(x=>x.source==='pexels'||/pexels/i.test(x.provider||'')).map(x=>({creator:x.creator||'',sourceUrl:x.sourceUrl||''})).filter(x=>x.sourceUrl);if(stock.length)description+=`\n\nVisual sources: ${stock.slice(0,12).map(x=>`${x.creator?`${x.creator} — `:''}${x.sourceUrl}`).join('\n')}`;
  return{song,video,cover,director,metadata:{title:safe(overrides.title||yt.title||`${song.title} — ${song.artist} | Official Music Video`,100),description:safe(description,5000),tags:[...new Set(tags.map(x=>String(x).replace(/^#/,'').trim()).filter(Boolean))].slice(0,40),privacyStatus:safe(overrides.privacyStatus||'public',20),notifySubscribers:overrides.notifySubscribers===true,syntheticMedia:overrides.syntheticMedia!==false,madeForKids:overrides.madeForKids===true}};
}
async function publishYoutube(request,env,id){if(!(await authorised(request,env)))return json({error:'Ridge session login required'},401);const b=await request.json().catch(()=>({}));const p=await youtubePackage(env,id,b);if(p.song.youtube?.videoId&&!b.allowDuplicate)return json({error:'Duplicate YouTube upload blocked',videoId:p.song.youtube.videoId},409);const result=await youtubeUploadFromR2(env,{songId:id,videoKey:p.video.key,thumbnailKey:p.cover?.key||'',...p.metadata,confirmPublish:b.confirmPublish===true});const record={status:'uploaded',videoId:result.videoId,privacyStatus:result.privacyStatus,title:p.metadata.title,uploadedAt:new Date().toISOString(),dailyCount:result.dailyCount,dailyCap:result.dailyCap};await updateSong(env,id,{youtube:record});await putSongFile(env,id,'youtube/publish.json',JSON.stringify({...record,metadata:p.metadata,thumbnail:result.thumbnail}),{contentType:'application/json',source:'ridge-youtube',provider:'youtube-data-api',size:new Blob([JSON.stringify(record)]).size});return json(result)}

async function youtubeRoute(request,env){const u=new URL(request.url);if(u.pathname==='/api/youtube/oauth/callback'&&request.method==='GET'){try{const r=await youtubeOauthCallback(request,env),to=safe(r.returnTo||'/pipeline.html',500);return new Response(`<!doctype html><meta charset="utf-8"><title>YouTube connected</title><script>try{if(window.opener){window.opener.postMessage({type:'ridge-youtube-connected'},'*');window.close()}else{location.replace(${JSON.stringify(to)})}}catch(e){location.replace(${JSON.stringify(to)})}</script><p>YouTube connected to Ridge. You can close this window.</p>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})}catch(e){return new Response(`<!doctype html><meta charset="utf-8"><title>YouTube connection failed</title><p>${safe(e?.message||e,500).replace(/[<>&]/g,'')}</p>`,{status:400,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})}}
  if(!(await authorised(request,env)))return json({error:'Ridge session login required'},401);
  if(u.pathname==='/api/youtube/status'&&request.method==='GET')return json(await youtubeStatus(env,{verify:u.searchParams.get('verify')==='1'}));
  if(u.pathname==='/api/youtube/oauth/start'&&request.method==='GET'){const r=await youtubeOauthStart(request,env,{returnTo:u.searchParams.get('returnTo')||'/pipeline.html'});if(u.searchParams.get('redirect')==='1')return Response.redirect(r.url,302);return json(r)}
  const m=u.pathname.match(/^\/api\/youtube\/publish\/([^/]+)$/);if(m&&request.method==='POST')return publishYoutube(request,env,decodeURIComponent(m[1]));
  const p=u.pathname.match(/^\/api\/youtube\/package\/([^/]+)$/);if(p&&request.method==='GET'){const x=await youtubePackage(env,decodeURIComponent(p[1]),{});return json({ok:true,metadata:x.metadata,video:{path:x.video.path,size:x.video.size},cover:x.cover?{path:x.cover.path,size:x.cover.size}:null,directorReady:!!x.director})}
  return json({error:'Unknown YouTube route'},404);
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});const u=new URL(request.url);
    if(u.pathname.startsWith('/api/youtube/')){try{return await youtubeRoute(request,env)}catch(e){return json({error:safe(e?.message||e,700)},503)}}
    if(u.pathname==='/api/browser/budget'&&request.method==='GET'){if(!(await authorised(request,env)))return json({error:'Ridge session login required'},401);return json(await browserBudget(env))}
    if(u.pathname==='/api/resilience/health'&&request.method==='GET'){const r=await base.fetch(request,env,ctx);let b={};try{b=await r.clone().json()}catch{}return json({...b,ok:true,worker:'v11',youtube:youtubeCapabilities(env),browserBudgetRoute:'/api/browser/budget'})}
    return base.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(base.scheduled)return base.scheduled(event,env,ctx)}
};
