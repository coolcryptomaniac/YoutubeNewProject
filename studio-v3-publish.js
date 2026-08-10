'use strict';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ytToken='',ytExpires=0,ytClient=null;

function caption(project){return [project.title,project.description,(project.hashtags||[]).join(' ')].filter(Boolean).join('\n\n').trim()}
export function nativeShareSupported(file){try{return !!navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))}catch{return false}}
export async function shareToApps(file,project){
  if(!file)throw new Error('Render a video first.');
  if(!nativeShareSupported(file))throw new Error('This browser cannot share video files directly. Download the video and post it from the app instead.');
  await navigator.share({files:[file],title:project.title||'Music video',text:caption(project)});return true;
}

function googleReady(){if(window.google?.accounts?.oauth2)return Promise.resolve();return new Promise((resolve,reject)=>{let n=0;const id=setInterval(()=>{if(window.google?.accounts?.oauth2){clearInterval(id);resolve()}else if(++n>100){clearInterval(id);reject(new Error('Google Identity did not load.'))}},100)})}
export async function connectYouTube(clientId,{prompt='consent'}={}){
  if(!clientId)throw new Error('Add your YouTube OAuth Web Client ID in Settings.');await googleReady();
  return new Promise((resolve,reject)=>{const cb=r=>{if(r.error)return reject(new Error(r.error_description||r.error));ytToken=r.access_token;ytExpires=Date.now()+(Number(r.expires_in)||3500)*1000;resolve(ytToken)};ytClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/youtube.upload',callback:cb});ytClient.requestAccessToken({prompt})});
}
async function youtubeToken(clientId){if(ytToken&&Date.now()<ytExpires-300000)return ytToken;return connectYouTube(clientId,{prompt:ytClient?'':'consent'})}

function xhrPut({url,token,blob,start,end,total,type}){return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('PUT',url,true);x.setRequestHeader('Authorization','Bearer '+token);x.setRequestHeader('Content-Type',type||'video/webm');x.setRequestHeader('Content-Range',`bytes ${start}-${end}/${total}`);x.onerror=()=>reject(new Error('Network error during YouTube upload.'));x.onload=()=>resolve({status:x.status,body:x.responseText||'',range:x.getResponseHeader('Range')||''});x.send(blob)})}
export async function publishYouTube(file,project,{clientId,onProgress=()=>{}}={}){
  if(!file)throw new Error('Render a video first.');const token=await youtubeToken(clientId),meta={snippet:{title:String(project.title||'Original Music Video').slice(0,100),description:[project.description,(project.hashtags||[]).join(' ')].filter(Boolean).join('\n\n'),tags:(project.tags||[]).slice(0,50),categoryId:'10'},status:{privacyStatus:project.privacy||'private',selfDeclaredMadeForKids:false}};
  const init=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(file.size),'X-Upload-Content-Type':file.type||'video/webm'},body:JSON.stringify(meta)});if(!init.ok)throw new Error(`YouTube session ${init.status}: ${(await init.text()).slice(0,180)}`);const url=init.headers.get('Location');if(!url)throw new Error('YouTube did not return an upload URL.');
  const chunk=8*1024*1024,total=file.size;let start=0;
  while(start<total){const end=Math.min(total,start+chunk)-1;let attempt=0;while(true){const r=await xhrPut({url,token,blob:file.slice(start,end+1,file.type),start,end,total,type:file.type});if(r.status===200||r.status===201){onProgress(1);try{return JSON.parse(r.body)}catch{return {}}}if(r.status===308){start=end+1;onProgress(start/total);break}if(r.status===401)throw new Error('YouTube authorization expired. Reconnect YouTube and retry.');if(r.status>=400&&r.status<500)throw new Error(`YouTube upload ${r.status}: ${r.body.slice(0,180)}`);if(++attempt>4)throw new Error(`YouTube upload repeatedly failed (${r.status}).`);await sleep(Math.min(7000,700*2**attempt))}}
  throw new Error('YouTube upload ended without a video response.');
}

export async function publishFacebookPageReel(file,project,{pageToken,apiVersion='v25.0',onProgress=()=>{}}={}){
  if(!file)throw new Error('Render a video first.');if(!pageToken)throw new Error('Facebook Page publishing needs a Page access token with Pages publishing permissions.');if(!/mp4|quicktime|mov/i.test(file.type||file.name))throw new Error('Facebook direct Reel upload needs an MP4/MOV render. Use phone Share if this browser rendered WebM.');
  const base=`https://graph.facebook.com/${encodeURIComponent(apiVersion)}`;
  const start=await fetch(`${base}/me/video_reels?upload_phase=start&access_token=${encodeURIComponent(pageToken)}`,{method:'POST'});if(!start.ok)throw new Error(`Facebook start ${start.status}: ${(await start.text()).slice(0,180)}`);const j=await start.json();if(!j.upload_url||!j.video_id)throw new Error('Facebook did not return a Reel upload session.');
  onProgress(.12);const up=await fetch(j.upload_url,{method:'POST',headers:{Authorization:'OAuth '+pageToken,offset:'0',file_size:String(file.size),'Content-Type':'application/octet-stream'},body:file});if(!up.ok)throw new Error(`Facebook upload ${up.status}: ${(await up.text()).slice(0,180)}`);onProgress(.82);
  const q=new URLSearchParams({access_token:pageToken,video_id:String(j.video_id),upload_phase:'finish',video_state:'PUBLISHED',description:caption(project),title:project.title||'Music video'});const fin=await fetch(`${base}/me/video_reels?${q}`,{method:'POST'});if(!fin.ok)throw new Error(`Facebook publish ${fin.status}: ${(await fin.text()).slice(0,180)}`);onProgress(1);return {video_id:j.video_id,success:true};
}

export function publishingCapabilities(file){return {youtube:true,nativeShare:!!file&&nativeShareSupported(file),facebookPageDirect:!!file&&/mp4|quicktime|mov/i.test(file.type||file.name),instagramDirect:false,linkedinDirect:false}}
