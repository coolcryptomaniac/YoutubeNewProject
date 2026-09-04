const enc=new TextEncoder(),dec=new TextDecoder();
const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const TOKEN_KEY='private/youtube/oauth.enc.json';
const OAUTH_SCOPE='https://www.googleapis.com/auth/youtube.upload';
const YT_UPLOAD='https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth';
const DEFAULT_CHUNK=64*1024*1024;

const b64url=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const fromB64url=s=>{const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/');const raw=atob(p+'='.repeat((4-p.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
async function sha256(s){return crypto.subtle.digest('SHA-256',enc.encode(s))}
async function hmac(secret,message){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64url(await crypto.subtle.sign('HMAC',key,enc.encode(message)))}
function config(env){return{clientId:safe(env.YOUTUBE_CLIENT_ID,400),clientSecret:safe(env.YOUTUBE_CLIENT_SECRET,500),dailyCap:Math.max(1,Math.min(100,Number(env.YOUTUBE_DAILY_UPLOAD_CAP||10))),defaultPrivacy:['public','private','unlisted'].includes(env.YOUTUBE_DEFAULT_PRIVACY)?env.YOUTUBE_DEFAULT_PRIVACY:'public'}}
function secret(env){const c=config(env);return `${safe(env.RIDGE_ADMIN_TOKEN||env.VUSIC_PASSWORD,600)}:${c.clientSecret}`}
async function aesKey(env){return crypto.subtle.importKey('raw',await sha256(secret(env)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encrypt(env,obj){const iv=crypto.getRandomValues(new Uint8Array(12)),plain=enc.encode(JSON.stringify(obj)),data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(env),plain);return JSON.stringify({v:1,iv:b64url(iv),data:b64url(data)})}
async function decrypt(env,text){const x=JSON.parse(text),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64url(x.iv)},await aesKey(env),fromB64url(x.data));return JSON.parse(dec.decode(plain))}
async function readTokens(env){if(!env.RELEASE_MEDIA)return null;const obj=await env.RELEASE_MEDIA.get(TOKEN_KEY);if(!obj)return null;try{return await decrypt(env,await obj.text())}catch{return null}}
async function writeTokens(env,tokens){if(!env.RELEASE_MEDIA)throw new Error('R2 is required for YouTube OAuth');await env.RELEASE_MEDIA.put(TOKEN_KEY,await encrypt(env,tokens),{httpMetadata:{contentType:'application/json'},customMetadata:{kind:'encrypted-youtube-oauth',updatedAt:new Date().toISOString()}})}
function oauthRedirectUri(request,env){return safe(env.YOUTUBE_REDIRECT_URI,1000)||`${new URL(request.url).origin}/api/youtube/oauth/callback`}
function stateSecret(env){return secret(env)}
async function makeState(env,payload){const body=b64url(enc.encode(JSON.stringify(payload))),sig=await hmac(stateSecret(env),body);return `${body}.${sig}`}
async function parseState(env,state){try{const [body,sig]=String(state||'').split('.');if(!body||!sig||await hmac(stateSecret(env),body)!==sig)return null;const x=JSON.parse(dec.decode(fromB64url(body)));if(Number(x.exp)<Date.now())return null;return x}catch{return null}}
function ptDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\//g,'-')}
const ledgerKey=()=>`private/youtube/uploads/${ptDay()}.json`;
async function readLedger(env){const o=await env.RELEASE_MEDIA?.get(ledgerKey());if(!o)return{day:ptDay(),count:0,items:[]};return o.json().catch(()=>({day:ptDay(),count:0,items:[]}))}
async function writeLedger(env,l){await env.RELEASE_MEDIA.put(ledgerKey(),JSON.stringify(l),{httpMetadata:{contentType:'application/json'},customMetadata:{kind:'youtube-upload-ledger',day:l.day}})}
function normalTags(tags=[]){const src=Array.isArray(tags)?tags:String(tags||'').split(',');const out=[];let chars=0;for(const t of src.map(x=>safe(x,60)).filter(Boolean)){if(out.includes(t))continue;if(chars+t.length+1>450)break;out.push(t);chars+=t.length+1}return out.slice(0,40)}
async function refresh(env){const c=config(env),stored=await readTokens(env);if(!stored?.refresh_token)throw new Error('YouTube OAuth is not connected');const form=new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,refresh_token:stored.refresh_token,grant_type:'refresh_token'});const r=await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});const x=await r.json().catch(()=>({}));if(!r.ok||!x.access_token)throw new Error(`YouTube token refresh failed (${r.status}) ${safe(x.error_description||x.error,240)}`);const next={...stored,...x,refresh_token:stored.refresh_token,obtained_at:Date.now(),expires_at:Date.now()+Number(x.expires_in||3600)*1000};await writeTokens(env,next);return next}

export function youtubeCapabilities(env){const c=config(env);return{configured:!!(c.clientId&&c.clientSecret&&env.RELEASE_MEDIA),oauthServerSide:true,credentialsServerSide:true,scope:OAUTH_SCOPE,resumableUploads:true,r2Streaming:true,dailySafetyCap:c.dailyCap,defaultPrivacy:c.defaultPrivacy,customThumbnail:true,thumbnailMaxBytes:2*1024*1024,requiresGoogleCloudOAuthClient:!(c.clientId&&c.clientSecret)}}

export async function youtubeOauthStart(request,env,{returnTo='/pipeline.html'}={}){
  const c=config(env);if(!c.clientId||!c.clientSecret)throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are not configured');
  const existing=await readTokens(env),state=await makeState(env,{scope:'youtube-oauth',exp:Date.now()+10*60*1000,nonce:crypto.randomUUID(),returnTo:safe(returnTo,500)}),u=new URL(AUTH_URL);
  u.searchParams.set('client_id',c.clientId);u.searchParams.set('redirect_uri',oauthRedirectUri(request,env));u.searchParams.set('response_type','code');u.searchParams.set('scope',OAUTH_SCOPE);u.searchParams.set('access_type','offline');u.searchParams.set('include_granted_scopes','true');u.searchParams.set('state',state);if(!existing?.refresh_token)u.searchParams.set('prompt','consent');
  return{ok:true,url:u.toString(),redirectUri:oauthRedirectUri(request,env)};
}

export async function youtubeOauthCallback(request,env){
  const u=new URL(request.url),error=u.searchParams.get('error');if(error)throw new Error(`Google OAuth denied: ${safe(error,120)}`);const code=u.searchParams.get('code'),st=await parseState(env,u.searchParams.get('state'));if(!code||st?.scope!=='youtube-oauth')throw new Error('Invalid or expired YouTube OAuth callback state');
  const c=config(env),form=new URLSearchParams({code,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:oauthRedirectUri(request,env),grant_type:'authorization_code'}),r=await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form}),x=await r.json().catch(()=>({}));if(!r.ok||!x.access_token)throw new Error(`YouTube OAuth exchange failed (${r.status}) ${safe(x.error_description||x.error,240)}`);
  const old=await readTokens(env),tokens={...old,...x,refresh_token:x.refresh_token||old?.refresh_token,obtained_at:Date.now(),expires_at:Date.now()+Number(x.expires_in||3600)*1000,scope:x.scope||OAUTH_SCOPE};if(!tokens.refresh_token)throw new Error('Google did not return a refresh token; revoke/re-authorize Ridge with offline access');await writeTokens(env,tokens);return{ok:true,connected:true,returnTo:st.returnTo||'/pipeline.html'};
}

export async function youtubeStatus(env,{verify=false}={}){
  const caps=youtubeCapabilities(env),stored=caps.configured?await readTokens(env):null,out={ok:true,...caps,connected:!!stored?.refresh_token};if(!verify||!out.connected)return out;
  try{const tok=await refresh(env),r=await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:`Bearer ${tok.access_token}`}}),x=await r.json().catch(()=>({}));out.verified=r.ok;out.channel=r.ok&&x.items?.[0]?{id:x.items[0].id,title:x.items[0].snippet?.title||''}:null;if(!r.ok)out.verifyError=safe(x.error?.message||`HTTP ${r.status}`,240)}catch(e){out.verified=false;out.verifyError=safe(e?.message||e,240)}return out;
}

async function initiateUpload(env,token,{size,type,title,description,tags,privacyStatus,notifySubscribers=false,syntheticMedia=true,madeForKids=false}){
  const meta={snippet:{title:safe(title,100)||'Ridge Music Video',description:safe(description,5000),tags:normalTags(tags),categoryId:'10'},status:{privacyStatus:['public','unlisted','private'].includes(privacyStatus)?privacyStatus:config(env).defaultPrivacy,selfDeclaredMadeForKids:!!madeForKids,containsSyntheticMedia:!!syntheticMedia}};
  const u=new URL(YT_UPLOAD);u.searchParams.set('notifySubscribers',notifySubscribers?'true':'false');const r=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(size),'X-Upload-Content-Type':type},body:JSON.stringify(meta)});if(!r.ok)throw new Error(`YouTube upload session failed (${r.status}) ${safe(await r.text(),500)}`);const location=r.headers.get('Location');if(!location)throw new Error('YouTube resumable upload location missing');return location;
}
async function uploadChunks(env,token,key,session,size,type){
  let offset=0,last=null;while(offset<size){const length=Math.min(DEFAULT_CHUNK,size-offset),obj=await env.RELEASE_MEDIA.get(key,{range:{offset,length}});if(!obj)throw new Error('R2 video object disappeared during upload');const end=offset+length-1,r=await fetch(session,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':type,'Content-Length':String(length),'Content-Range':`bytes ${offset}-${end}/${size}`},body:obj.body});if(r.status===308){const range=r.headers.get('Range')||'',m=range.match(/bytes=0-(\d+)/);offset=m?Number(m[1])+1:end+1;continue}const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`YouTube video chunk failed (${r.status}) ${safe(x.error?.message||JSON.stringify(x),500)}`);last=x;offset=size}return last;
}
async function setThumbnail(env,token,videoId,key){if(!key)return{skipped:true};const obj=await env.RELEASE_MEDIA.get(key);if(!obj)return{skipped:true,reason:'missing'};if(obj.size>2*1024*1024)return{skipped:true,reason:'over-2mb'};const type=obj.httpMetadata?.contentType||'image/jpeg',r=await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':type,'Content-Length':String(obj.size)},body:obj.body});if(!r.ok)return{ok:false,status:r.status,error:safe(await r.text(),400)};return{ok:true}}

export async function youtubeUploadFromR2(env,{songId='',videoKey,thumbnailKey='',title,description='',tags=[],privacyStatus,notifySubscribers=false,syntheticMedia=true,madeForKids=false,confirmPublish=false}={}){
  if(confirmPublish!==true)throw new Error('YouTube publish requires confirmPublish=true');const caps=youtubeCapabilities(env);if(!caps.configured)throw new Error('YouTube OAuth server credentials are not configured');const stored=await readTokens(env);if(!stored?.refresh_token)throw new Error('Connect YouTube OAuth first');if(!videoKey)throw new Error('videoKey is required');
  const ledger=await readLedger(env);if(Number(ledger.count||0)>=caps.dailySafetyCap)throw new Error(`Ridge daily YouTube safety cap reached (${caps.dailySafetyCap})`);if(songId&&ledger.items?.some(x=>x.songId===songId))throw new Error('This song is already recorded as uploaded today; duplicate blocked');
  const head=await env.RELEASE_MEDIA.head(videoKey);if(!head)throw new Error('R2 video object not found');const type=head.httpMetadata?.contentType||'video/mp4',tok=await refresh(env),session=await initiateUpload(env,tok.access_token,{size:head.size,type,title,description,tags,privacyStatus,notifySubscribers,syntheticMedia,madeForKids}),video=await uploadChunks(env,tok.access_token,videoKey,session,head.size,type);if(!video?.id)throw new Error('YouTube upload finished without a video id');const thumb=await setThumbnail(env,tok.access_token,video.id,thumbnailKey);
  ledger.day=ptDay();ledger.count=Number(ledger.count||0)+1;ledger.items=Array.isArray(ledger.items)?ledger.items:[];ledger.items.push({songId:safe(songId,100),videoId:video.id,title:safe(title,100),uploadedAt:new Date().toISOString(),privacyStatus:video.status?.privacyStatus||privacyStatus||caps.defaultPrivacy});await writeLedger(env,ledger);
  return{ok:true,uploaded:true,videoId:video.id,privacyStatus:video.status?.privacyStatus||privacyStatus||caps.defaultPrivacy,thumbnail:thumb,dailyCount:ledger.count,dailyCap:caps.dailySafetyCap};
}
