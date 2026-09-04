'use strict';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const now=()=>new Date().toISOString();
const ROOT='library/songs/';
const manifestKey=id=>`${ROOT}${id}/manifest.json`;
const prefix=id=>`${ROOT}${id}/`;
const slug=s=>String(s||'song').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,54)||'song';
const filePath=p=>{
  const x=String(p||'').replace(/^\/+/, '').replace(/\\/g,'/');
  if(!x||x.length>240||x.includes('..')||x.split('/').some(v=>!v||!/[a-z0-9_. -]/i.test(v)))throw new Error('Invalid library file path');
  return x;
};
const idOk=id=>/^[a-z0-9][a-z0-9-]{2,90}$/i.test(String(id||''));
const contentKind=(path,type='')=>{
  const s=`${path} ${type}`.toLowerCase();
  if(/audio|\.wav|\.mp3|\.aiff|\.flac/.test(s))return'audio';
  if(/image|\.jpe?g|\.png|\.webp/.test(s))return'image';
  if(/video|\.mp4|\.mov|\.webm/.test(s))return'video';
  if(/\.json|application\/json/.test(s))return'json';
  if(/\.srt|\.vtt|\.txt|text\//.test(s))return'text';
  return'file';
};
async function readManifest(env,id){if(!env.RELEASE_MEDIA||!idOk(id))return null;const o=await env.RELEASE_MEDIA.get(manifestKey(id));if(!o)return null;return o.json().catch(()=>null)}
async function writeManifest(env,m){m.updatedAt=now();await env.RELEASE_MEDIA.put(manifestKey(m.id),JSON.stringify(m),{httpMetadata:{contentType:'application/json'},customMetadata:{kind:'song-manifest',songId:m.id}});return m}
async function upsertFile(env,id,entry){const m=await readManifest(env,id);if(!m)throw new Error('Song library item not found');m.files=Array.isArray(m.files)?m.files:[];const i=m.files.findIndex(x=>x.path===entry.path);if(i>=0)m.files[i]={...m.files[i],...entry};else m.files.push(entry);m.totalBytes=m.files.reduce((n,x)=>n+(Number(x.size)||0),0);return writeManifest(env,m)}

export function libraryCapabilities(env){return{ready:!!env.RELEASE_MEDIA,storage:'r2',prefix:ROOT,perSongFolders:true,multipart:true,temporaryStagingSeparate:true,defaultDailyYoutubeCap:Number(env.YOUTUBE_DAILY_UPLOAD_CAP||10),recommendedPartsMiB:24};}

export async function createSong(env,input={}){
  if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');
  const title=safe(input.title||'Untitled song',180),id=`${slug(title)}-${crypto.randomUUID().slice(0,8)}`;
  const m={version:1,id,title,artist:safe(input.artist||'Mohit Pandey',180),createdAt:now(),updatedAt:now(),status:'draft',source:safe(input.source||'upload',60),language:safe(input.language||'auto',40),genre:safe(input.genre||'auto',80),files:[],totalBytes:0,analysis:{status:'pending'},render:{status:'pending'},youtube:{status:'not-published'},vusic:{status:'not-published'},notes:safe(input.notes,1200)};
  await writeManifest(env,m);return m;
}

export async function listSongs(env,{limit=50,cursor}={}){
  if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');
  const page=await env.RELEASE_MEDIA.list({prefix:ROOT,delimiter:'/',limit:Math.max(1,Math.min(100,Number(limit)||50)),cursor:cursor||undefined});
  const songs=[];
  for(const p of page.delimitedPrefixes||[]){const id=p.slice(ROOT.length).replace(/\/$/,'');if(!idOk(id))continue;const m=await readManifest(env,id);if(m)songs.push(m)}
  return{songs,cursor:page.truncated?page.cursor:null,truncated:page.truncated};
}

export async function getSong(env,id,{refreshUsage=false}={}){
  const m=await readManifest(env,id);if(!m)return null;
  if(refreshUsage){let cursor,total=0,count=0;do{const page=await env.RELEASE_MEDIA.list({prefix:prefix(id),cursor,limit:500});for(const o of page.objects){if(o.key!==manifestKey(id)){total+=Number(o.size)||0;count++}}cursor=page.truncated?page.cursor:undefined}while(cursor);m.actualBytes=total;m.objectCount=count;}
  return m;
}

export async function putSongFile(env,id,path,body,{contentType='application/octet-stream',source='upload',provider='',license='',sourceUrl='',size=0}={}){
  if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');if(!await readManifest(env,id))throw new Error('Song library item not found');
  path=filePath(path);const key=prefix(id)+path,kind=contentKind(path,contentType),createdAt=now();
  const obj=await env.RELEASE_MEDIA.put(key,body,{httpMetadata:{contentType},customMetadata:{songId:id,path,kind,source:safe(source,80),provider:safe(provider,80),license:safe(license,120),sourceUrl:safe(sourceUrl,500),createdAt}});
  await upsertFile(env,id,{path,key,kind,size:Number(obj?.size||size||0),etag:obj?.etag||'',contentType,source:safe(source,80),provider:safe(provider,80),license:safe(license,120),sourceUrl:safe(sourceUrl,500),createdAt});
  return{ok:true,id,path,key,size:Number(obj?.size||size||0),kind,etag:obj?.etag||''};
}

export async function startMultipart(env,id,path,{contentType='application/octet-stream',source='upload',provider='',license='',sourceUrl=''}={}){
  if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');if(!await readManifest(env,id))throw new Error('Song library item not found');path=filePath(path);const key=prefix(id)+path;
  const upload=await env.RELEASE_MEDIA.createMultipartUpload(key,{httpMetadata:{contentType},customMetadata:{songId:id,path,kind:contentKind(path,contentType),source:safe(source,80),provider:safe(provider,80),license:safe(license,120),sourceUrl:safe(sourceUrl,500),createdAt:now()}});
  return{ok:true,id,path,key,uploadId:upload.uploadId,recommendedPartBytes:24*1024*1024};
}
export async function uploadMultipartPart(env,id,path,uploadId,partNumber,body){
  if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');path=filePath(path);partNumber=Number(partNumber);if(!uploadId||!Number.isInteger(partNumber)||partNumber<1||partNumber>10000)throw new Error('Invalid multipart upload');
  const upload=env.RELEASE_MEDIA.resumeMultipartUpload(prefix(id)+path,String(uploadId)),part=await upload.uploadPart(partNumber,body);return{ok:true,partNumber:part.partNumber,etag:part.etag};
}
export async function completeMultipart(env,id,path,uploadId,parts=[],meta={}){
  if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');path=filePath(path);if(!uploadId||!Array.isArray(parts)||!parts.length)throw new Error('Multipart parts required');
  const upload=env.RELEASE_MEDIA.resumeMultipartUpload(prefix(id)+path,String(uploadId)),obj=await upload.complete(parts.map(x=>({partNumber:Number(x.partNumber),etag:String(x.etag)})));
  const contentType=safe(meta.contentType||'application/octet-stream',160),entry={path,key:prefix(id)+path,kind:contentKind(path,contentType),size:Number(obj?.size||meta.size||0),etag:obj?.etag||'',contentType,source:safe(meta.source||'upload',80),provider:safe(meta.provider,80),license:safe(meta.license,120),sourceUrl:safe(meta.sourceUrl,500),createdAt:now()};await upsertFile(env,id,entry);return{ok:true,...entry};
}
export async function abortMultipart(env,id,path,uploadId){if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');path=filePath(path);await env.RELEASE_MEDIA.resumeMultipartUpload(prefix(id)+path,String(uploadId)).abort();return{ok:true,aborted:true};}

export async function getSongFile(env,id,path,range){if(!env.RELEASE_MEDIA)throw new Error('R2 library unavailable');path=filePath(path);return env.RELEASE_MEDIA.get(prefix(id)+path,range?{range}:undefined)}
export async function updateSong(env,id,patch={}){const m=await readManifest(env,id);if(!m)return null;for(const k of ['title','status','language','genre','source'])if(k in patch)m[k]=safe(patch[k],k==='title'?180:80);for(const k of ['analysis','render','youtube','vusic'])if(patch[k]&&typeof patch[k]==='object')m[k]={...(m[k]||{}),...patch[k]};return writeManifest(env,m)}
export const songLibraryPrefix=prefix;
