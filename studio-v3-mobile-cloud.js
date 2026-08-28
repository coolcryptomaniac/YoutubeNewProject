(function(){
'use strict';
const $=s=>document.querySelector(s);
const mobile=()=>/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')||innerWidth<760||(Number(navigator.deviceMemory)||8)<=4;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const status=(m,k='')=>{const e=$('#status');if(e){e.textContent=m;e.dataset.kind=k}};
const log=(m,k='')=>{const box=$('#log');if(!box)return;const d=document.createElement('div');d.className=k;d.textContent=`${new Date().toLocaleTimeString()} · ${m}`;box.prepend(d);while(box.children.length>36)box.lastElementChild.remove()};
function base(){return (localStorage.getItem('ridge.releaseWorker')||$('#cloudUrl')?.value?.trim()||'https://ridge-cloud-media.founder-f53.workers.dev').replace(/\/$/,'')}
function token(){let t=localStorage.getItem('ridge.adminToken')||'';if(!t){t=prompt('Ridge admin token (saved only on this device):')||'';if(t)localStorage.setItem('ridge.adminToken',t)}return t}
async function api(path,t,opts={}){const h=new Headers(opts.headers||{});if(t)h.set('Authorization','Bearer '+t);const r=await fetch(base()+path,{...opts,headers:h});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`Ridge Cloud HTTP ${r.status}`);return j}
async function stage(file,t){const f=new FormData();f.append('file',file,file.name);const r=await api('/api/release/stage',t,{method:'POST',body:f});if(r.storage!=='r2')throw Error('Crash-proof mobile rendering requires R2 staging. Enable Cloudflare R2 once; Ridge will never fall back to Android encoding.');return r}
async function coverFile(){const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d',{alpha:false});const s=$('#stage');x.fillStyle='#090d18';x.fillRect(0,0,c.width,c.height);try{if(s?.width&&s?.height)x.drawImage(s,0,0,c.width,c.height)}catch{}const title=($('#title')?.value||$('#songFile')?.files?.[0]?.name||'Ridge Music').replace(/\.[^.]+$/,'');x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,510,1280,210);x.fillStyle='#fff';x.font='900 54px system-ui';x.fillText(title.slice(0,36),54,610);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));c.width=c.height=1;if(!blob)throw Error('Could not prepare cloud-render cover');return new File([blob],'ridge-cover.jpg',{type:'image/jpeg'})}
function queries(){const lyrics=$('#lyrics')?.value||'',title=$('#title')?.value||'',idea=$('#idea')?.value||'';const lines=lyrics.split(/\n+/).map(x=>x.replace(/^\[[^\]]+\]\s*/, '').trim()).filter(x=>x.length>10).slice(0,5);return [idea,title,...lines].filter(Boolean).slice(0,6)}
async function cloudCreate(ev){
  if(!mobile())return;
  ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
  const audio=$('#songFile')?.files?.[0];if(!audio){status('Choose a song first.','warn');$('#songFile')?.click();return}
  const btn=$('#createBtn');btn.disabled=true;
  try{
    const t=token();if(!t){status('Ridge admin token is required for crash-proof cloud rendering.','warn');return}
    const caps=await api('/api/mobile/capabilities','');
    if(!caps.crashProof)throw Error('Ridge Cloud is not fully ready: enable Cloudflare R2 and configure RIDGE_GITHUB_TOKEN. Android final encoding stays disabled so the tab cannot crash.');
    status('Android safe mode: uploading song for cloud rendering…','ok');log('Phone encoding bypassed. Final video will render in GitHub Actions.','ok');
    const [a,c]=await Promise.all([stage(audio,t),coverFile().then(f=>stage(f,t))]);
    const body={audioUrl:a.url,coverUrl:c.url,title:($('#title')?.value||audio.name.replace(/\.[^.]+$/,'')).trim(),lyrics:$('#lyrics')?.value||'',queries:queries(),mode:'auto'};
    const job=await api('/api/mobile/render',t,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    status('Cloud render queued. You can keep this tab open; Android is no longer encoding the video.','ok');
    for(let i=0;i<180;i++){
      await sleep(8000);const s=await api('/api/mobile/render-status/'+encodeURIComponent(job.id),t);
      if(s.status==='failed')throw Error(s.error||'Cloud render failed');
      if(s.status==='done'){
        status('Cloud video ready — tap Download cloud video.','ok');log('Cloud render complete without Android MediaRecorder.','ok');
        let b=$('#cloudDownloadBtn');if(!b){b=document.createElement('button');b.id='cloudDownloadBtn';b.className='primary wide';b.textContent='Download cloud video';$('#downloadBtn')?.insertAdjacentElement('afterend',b)}b.onclick=()=>location.href=s.downloadUrl;return;
      }
      status(`Cloud rendering… ${Math.min(99,Math.round((i+1)/180*100))}% watcher · phone stays idle`,'ok');
    }
    throw Error('Cloud render is still running. Reopen Ridge later; the phone did not encode anything locally.');
  }catch(e){status(e.message,'err');log(e.message,'err')}finally{btn.disabled=false}
}
function install(){if(!mobile())return;document.documentElement.dataset.ridgeRender='cloud-only';const b=$('#createBtn');if(b){b.textContent='DIRECT + CREATE IN CLOUD';b.addEventListener('click',cloudCreate,true)}const q=$('#qualityState');if(q)q.textContent='Android · cloud final render · no local encoding';}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
