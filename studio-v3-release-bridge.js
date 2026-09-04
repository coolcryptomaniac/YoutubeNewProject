(function(){
'use strict';
const $=s=>document.querySelector(s);
const mobile=()=>/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')||innerWidth<760;
const log=(m,bad=false)=>{const box=$('#log');if(!box)return;const d=document.createElement('div');d.className=bad?'err':bad;d.textContent=`${new Date().toLocaleTimeString()} · ${m}`;box.prepend(d);while(box.children.length>36)box.lastElementChild.remove()};
const status=(m,k='')=>{const e=$('#status');if(e){e.textContent=m;e.dataset.kind=k}};
let safeNoticeShown=false;
function forceSafe(){
  if(document.documentElement.dataset.ridgeRender==='cloud-first'){const q=$('#qualityState');if(q)q.textContent='Cloud final render · resumable · crash-resistant';return true}
  if(!mobile())return false;
  const stock=$('#cloudStock'),mins=$('#freeVideoMinutes'),nvidia=$('#nvidiaMode'),quality=$('#qualityState');
  if(stock)stock.checked=false;if(mins)mins.value='0';if(nvidia&&nvidia.value==='prefer')nvidia.value='shadow';
  document.documentElement.dataset.ridgeSafe='mobile';if(quality)quality.textContent='Android ultra-safe · procedural preview';
  if(!safeNoticeShown){safeNoticeShown=true;log('Android preview guard active. Final rendering stays in Ridge Cloud so local media decoding cannot overlap final encoding.','ok')}
  return true;
}
function ridgeToken(){
  try{const old=localStorage.getItem('ridge.adminToken');if(old&&!sessionStorage.getItem('ridge.adminToken'))sessionStorage.setItem('ridge.adminToken',old);if(old)localStorage.removeItem('ridge.adminToken')}catch{}
  let t='';try{t=sessionStorage.getItem('ridge.adminToken')||''}catch{}
  if(!t){t=prompt('Ridge admin token (kept only for this browser session):')||'';if(t)try{sessionStorage.setItem('ridge.adminToken',t)}catch{}}
  return t;
}
async function makeCover(){
  const title=($('#title')?.value||($('#songFile')?.files?.[0]?.name||'Original Music').replace(/\.[^.]+$/,'')).trim(),artist='Mohit Pandey';
  const c=document.createElement('canvas');c.width=3000;c.height=3000;const x=c.getContext('2d',{alpha:false,desynchronized:true});const src=$('#stage');
  const g=x.createLinearGradient(0,0,3000,3000);g.addColorStop(0,'#111934');g.addColorStop(.48,'#482751');g.addColorStop(1,'#090d18');x.fillStyle=g;x.fillRect(0,0,3000,3000);
  if(src&&src.width&&src.height&&!mobile()){try{const r=Math.max(3000/src.width,3000/src.height),w=src.width*r,h=src.height*r;x.globalAlpha=.82;x.drawImage(src,(3000-w)/2,(3000-h)/2,w,h);x.globalAlpha=1}catch{}}
  const shade=x.createLinearGradient(0,1200,0,3000);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.88)');x.fillStyle=shade;x.fillRect(0,1000,3000,2000);
  x.fillStyle='#fff';x.textAlign='left';let fs=250;x.font=`900 ${fs}px system-ui`;let t=(title||'ORIGINAL MUSIC').toUpperCase();while(fs>110&&x.measureText(t).width>2460){fs-=10;x.font=`900 ${fs}px system-ui`}x.fillText(t,270,2250);x.font='700 82px system-ui';x.fillStyle='rgba(255,255,255,.82)';x.fillText(artist.toUpperCase(),275,2450);x.fillStyle='rgba(255,255,255,.92)';x.fillRect(275,2540,430,12);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));x.clearRect(0,0,3000,3000);c.width=c.height=1;if(!blob)throw Error('Could not create 3000×3000 JPG cover');return new File([blob],`${(title||'cover').replace(/[^a-z0-9_-]+/gi,'-')}-cover.jpg`,{type:'image/jpeg'});
}
async function api(base,path,token,opts={}){const h=new Headers(opts.headers||{});if(token)h.set('Authorization','Bearer '+token);const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),90000);let r;try{r=await fetch(base.replace(/\/$/,'')+path,{...opts,headers:h,signal:ctrl.signal})}catch(e){if(e?.name==='AbortError')throw Error('Ridge Cloud timed out. Nothing was submitted; retry safely.');throw Error('Ridge Cloud is unreachable. Fix the Worker deployment first.')}finally{clearTimeout(timer)}const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`Ridge Cloud HTTP ${r.status}`);return j;}
async function stage(base,token,file){const f=new FormData();f.append('file',file,file.name);const out=await api(base,'/api/release/stage',token,{method:'POST',body:f});if(out.storage!=='r2')throw Error('Release asset did not reach R2 global storage; Vusic was not opened.');return out;}
async function releaseCurrent(){
  forceSafe();const audio=$('#songFile')?.files?.[0];if(!audio){status('Choose a song first.','warn');$('#songFile')?.click();return}
  const agreed=confirm('Release this exact song to Vusic? Ridge will upload the audio and artwork, fill your artist metadata, accept the Vusic distribution agreement as Mohit Pandey, and press the final Submit Release control. Cancel to make no submission.');if(!agreed){status('Vusic release cancelled before upload.','warn');return}
  const base=localStorage.getItem('ridge.releaseWorker')||$('#cloudUrl')?.value?.trim()||'https://ridge-cloud-media.founder-f53.workers.dev',token=ridgeToken();if(!token)return;
  const btn=$('#vusicCurrent');btn.disabled=true;
  try{
    status('Checking Vusic automation…');const caps=await api(base,'/api/release/capabilities',token);if(!caps.vusic?.configured)throw Error('Vusic automation is not configured in Ridge Cloud. Check Browser Run and VUSIC_USERNAME / VUSIC_PASSWORD secrets.');if(caps.stagingMode!=='r2'||!caps.vusic?.mediaStaging)throw Error('Vusic automatic ingestion needs global R2 staging. Redeploy Ridge Cloud with RELEASE_MEDIA enabled.');
    status('Preparing this exact song + 3000×3000 cover for Vusic…');log(`Vusic ready · Browser Run ✓ · ${caps.stagingMode.toUpperCase()} staging ✓`);const cover=await makeCover();
    // Sequential uploads deliberately cap peak browser/network memory.
    const a=await stage(base,token,audio);const art=await stage(base,token,cover);
    const title=($('#title')?.value||audio.name.replace(/\.[^.]+$/,'')).trim(),lyrics=$('#lyrics')?.value||'',language=$('#language')?.value||'Hindi',releaseDate=localStorage.getItem('ridge.currentReleaseDate')||'';
    const p={title,artist:'Mohit Pandey',primaryArtist:'Mohit Pandey',composer:'Mohit Pandey',lyricist:'Mohit Pandey',label:'Vusic Records',copyrightOwner:'Vusic Records',signatory:'Mohit Pandey',releasedPreviously:false,platforms:'all',explicitContent:false,releaseDate,genre:'auto',language,lyrics,audioUrl:a.url,audioName:a.name,audioType:audio.type||'audio/mpeg',artworkUrl:art.url,artworkName:art.name,artworkType:'image/jpeg',confirmSubmit:true};
    if(releaseDate)log(`Target release date: ${releaseDate}`);log('Song and cover staged in R2; opening isolated Vusic Browser Run.');const out=await api(base,'/api/release/vusic',token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});status(out.message||'Vusic release completed.','ok');log(out.message||'Vusic release completed.','ok');
  }catch(e){status(e.message,'err');log(e.message,true)}finally{btn.disabled=false}
}
function install(){
  forceSafe();const pub=document.querySelector('.publish-card');if(!pub||$('#vusicCurrent'))return;
  const wrap=document.createElement('div');wrap.className='youtube-box';wrap.innerHTML='<div><b>Vusic</b><span>Current Ridge song + fresh 3000×3000 cover + optional release date</span></div><div class="actions"><button class="primary" id="vusicCurrent">Release current song</button><button id="forgetRidgeAdmin">Forget admin token</button></div><p class="hint">Ridge stages the exact song and cover in R2, fills Vusic in isolated Browser Run, and asks for confirmation before accepting the distribution agreement and submitting.</p>';pub.appendChild(wrap);
  $('#vusicCurrent').addEventListener('click',releaseCurrent);$('#forgetRidgeAdmin').addEventListener('click',()=>{try{localStorage.removeItem('ridge.adminToken');sessionStorage.removeItem('ridge.adminToken')}catch{}log('Ridge admin token removed from this browser session.','ok')});
  for(const id of['createBtn','previewBtn'])$('#'+id)?.addEventListener('click',()=>forceSafe(),true);for(const id of['cloudStock','freeVideoMinutes','nvidiaMode'])$('#'+id)?.addEventListener('change',()=>{if(mobile())forceSafe()});window.addEventListener('pageshow',()=>forceSafe());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
