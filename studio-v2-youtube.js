'use strict';
import {makeChunkPlan,finite} from './studio-v2-core.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function parseJson(s){try{return JSON.parse(s||'{}')}catch{return {}}}

export async function startYouTubeSession({token,file,metadata}){
  if(!token)throw new Error('YouTube OAuth token missing.');
  if(!file?.size)throw new Error('Rendered video file is empty.');
  const r=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(file.size),'X-Upload-Content-Type':file.type||'video/webm'},body:JSON.stringify(metadata)});
  if(!r.ok)throw new Error(`YouTube session ${r.status}: ${(await r.text()).slice(0,260)}`);
  const location=r.headers.get('Location')||r.headers.get('location');
  if(!location)throw new Error('YouTube did not return a resumable upload URL.');
  return location;
}

function xhrChunk({url,token,blob,start,end,total,type}){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();x.open('PUT',url,true);
    x.setRequestHeader('Authorization','Bearer '+token);
    x.setRequestHeader('Content-Type',type||'video/webm');
    x.setRequestHeader('Content-Range',`bytes ${start}-${end}/${total}`);
    x.onerror=()=>reject(new Error('Network error during YouTube upload.'));
    x.ontimeout=()=>reject(new Error('YouTube upload chunk timed out.'));
    x.timeout=120000;
    x.onload=()=>resolve({status:x.status,body:x.responseText||'',range:x.getResponseHeader('Range')||x.getResponseHeader('range')||''});
    x.send(blob);
  });
}

async function queryOffset({url,token,total,type}){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();x.open('PUT',url,true);
    x.setRequestHeader('Authorization','Bearer '+token);x.setRequestHeader('Content-Length','0');x.setRequestHeader('Content-Range',`bytes */${total}`);x.setRequestHeader('Content-Type',type||'video/webm');
    x.onerror=()=>reject(new Error('Could not query YouTube upload status.'));
    x.onload=()=>{
      if(x.status===200||x.status===201)return resolve({done:true,video:parseJson(x.responseText)});
      if(x.status!==308)return reject(new Error(`YouTube status check ${x.status}: ${(x.responseText||'').slice(0,180)}`));
      const m=(x.getResponseHeader('Range')||'').match(/bytes=0-(\d+)/i);resolve({done:false,offset:m?Number(m[1])+1:0});
    };x.send();
  });
}

export async function uploadYouTubeResumable({url,token,file,onProgress=()=>{},chunkBytes=8*1024*1024,maxRetries=4}){
  const total=file.size,type=file.type||'video/webm',plan=makeChunkPlan(total,chunkBytes);let offset=0,lastVideo=null;
  for(const nominal of plan){
    if(nominal.end<offset)continue;
    let start=Math.max(offset,nominal.start),end=nominal.end,attempt=0;
    while(true){
      try{
        const part=file.slice(start,end+1,type),r=await xhrChunk({url,token,blob:part,start,end,total,type});
        if(r.status===200||r.status===201){lastVideo=parseJson(r.body);onProgress(1);return lastVideo;}
        if(r.status===308){offset=end+1;onProgress(Math.min(.999,offset/total));break;}
        if(r.status===401)throw Object.assign(new Error('YouTube authorization expired during upload. Reconnect YouTube and retry.'),{fatal:true});
        if(r.status>=400&&r.status<500)throw Object.assign(new Error(`YouTube upload ${r.status}: ${r.body.slice(0,220)}`),{fatal:true});
        throw new Error(`YouTube upload ${r.status}: ${r.body.slice(0,180)}`);
      }catch(e){
        if(e.fatal)throw e;if(++attempt>maxRetries)throw e;await sleep(Math.min(8000,700*2**attempt));
        const q=await queryOffset({url,token,total,type}).catch(()=>({done:false,offset:start}));if(q.done)return q.video;
        start=Math.max(start,finite(q.offset,start));if(start>end){offset=start;break;}
      }
    }
  }
  if(lastVideo)return lastVideo;
  const q=await queryOffset({url,token,total,type});if(q.done)return q.video;
  throw new Error('YouTube upload did not complete. You can retry without re-rendering.');
}

export async function setYouTubeThumbnail({token,videoId,blob}){
  if(!blob)return;
  const r=await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':blob.type||'image/jpeg'},body:blob});
  if(!r.ok)throw new Error(`thumbnail ${r.status}: ${(await r.text()).slice(0,160)}`);
  return r.json();
}
