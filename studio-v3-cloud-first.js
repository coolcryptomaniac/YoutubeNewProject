(function(){
'use strict';
const DEFAULT_CLOUD='https://ridge-cloud-media.founder-f53.workers.dev';
const JOB_KEY='ridge.cloud.render.job.v1';
const $=s=>document.querySelector(s);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const base=()=>String(localStorage.getItem('ridge.releaseWorker')||$('#cloudUrl')?.value?.trim()||DEFAULT_CLOUD).replace(/\/$/,'');
const readJob=()=>{try{return JSON.parse(localStorage.getItem(JOB_KEY)||'null')}catch{return null}};
const saveJob=j=>{try{localStorage.setItem(JOB_KEY,JSON.stringify(j))}catch{}};
const clearJob=()=>{try{localStorage.removeItem(JOB_KEY)}catch{}};
const status=(m,k='')=>{const e=$('#status');if(e){e.textContent=m;e.dataset.kind=k}};
const log=(m,k='')=>{const box=$('#log');if(!box)return;const d=document.createElement('div');d.className=k;d.textContent=`${new Date().toLocaleTimeString()} · ${m}`;box.prepend(d);while(box.children.length>40)box.lastElementChild.remove()};
function migrateToken(){try{const old=localStorage.getItem('ridge.adminToken');if(old&&!sessionStorage.getItem('ridge.adminToken'))sessionStorage.setItem('ridge.adminToken',old);if(old)localStorage.removeItem('ridge.adminToken')}catch{}}
function token({promptUser=false}={}){migrateToken();let t='';try{t=sessionStorage.getItem('ridge.adminToken')||''}catch{}if(!t&&promptUser){t=prompt('Ridge admin token (kept only for this browser session):')||'';if(t)try{sessionStorage.setItem('ridge.adminToken',t)}catch{}}return t}
async function api(path,t,opts={},timeout=25000){
  const h=new Headers(opts.headers||{});if(t)h.set('Authorization','Bearer '+t);const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
  try{const r=await fetch(base()+path,{...opts,headers:h,signal:ctrl.signal});const text=await r.text();let j={};try{j=text?JSON.parse(text):{}}catch{throw Error(`Ridge Cloud returned an invalid response (${r.status}).`)}if(!r.ok)throw Error(j.error||j.detail||`Ridge Cloud HTTP ${r.status}`);return j}catch(e){if(e?.name==='AbortError')throw Error('Ridge Cloud request timed out; the job is safe to retry.');throw e}finally{clearTimeout(timer)}
}
async function stage(file,t){const f=new FormData();f.append('file',file,file.name);const r=await api('/api/release/stage',t,{method:'POST',body:f},90000);if(r.storage&&r.storage!=='r2')throw Error('Ridge refused edge-local staging. R2 global storage is required for crash-resistant rendering.');return r}
async function coverFile(title){
  const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d',{alpha:false});
  const g=x.createLinearGradient(0,0,1280,720);g.addColorStop(0,'#090d18');g.addColorStop(.55,'#1a1730');g.addColorStop(1,'#30131f');x.fillStyle=g;x.fillRect(0,0,1280,720);
  x.fillStyle='rgba(255,255,255,.08)';for(let i=0;i<28;i++){const y=120+i*15,w=80+((i*97)%420);x.fillRect(70,y,w,3)}
  x.fillStyle='#fff';x.font='900 58px system-ui';x.fillText(String(title||'Ridge Music').slice(0,34),64,590);x.fillStyle='#ff7a9c';x.font='700 25px system-ui';x.fillText('RIDGE STUDIO · CLOUD MASTER',66,642);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));c.width=c.height=1;if(!blob)throw Error('Could not prepare cloud-render cover');return new File([blob],'ridge-cover.jpg',{type:'image/jpeg'});
}
function queries(){const lyrics=$('#lyrics')?.value||'',title=$('#title')?.value||'',idea=$('#idea')?.value||'';const lines=lyrics.split(/\n+/).map(x=>x.replace(/^\[[^\]]+\]\s*/,'').trim()).filter(x=>x.length>10).slice(0,5);return [idea,title,...lines].filter(Boolean).slice(0,6)}
function installDownload(url){const b=$('#downloadBtn');if(!b)return;b.disabled=false;b.textContent='Download cloud video';b.dataset.cloudUrl=url}
async function getJobState(job,t){return api('/api/render/status/'+encodeURIComponent(job.id),t,{},20000)}
async function watch(job,t){
  let delay=3500;for(let i=0;i<360;i++){
    if(document.visibilityState==='hidden')await sleep(Math.max(delay,12000));else await sleep(delay);
    let s;try{s=await getJobState(job,t)}catch(e){if(i<4){log(`Cloud watcher retry: ${e.message}`,'warn');delay=Math.min(20000,Math.round(delay*1.5));continue}throw e}
    saveJob({...job,status:s.status,lastChecked:Date.now()});
    if(s.status==='failed'){clearJob();throw Error(s.error||'Cloud render failed safely')}
    if(s.status==='done'){clearJob();installDownload(s.downloadUrl);status('Cloud master ready — download it, then release to Vusic/YouTube.','ok');log('Cloud render completed. No browser MediaRecorder was used.','ok');return s}
    const elapsed=Math.max(0,Date.now()-Number(job.startedAt||Date.now()));status(`Cloud rendering safely · ${Math.round(elapsed/60000)} min · job survives tab/browser restarts`,'ok');delay=Math.min(20000,Math.round(delay*1.18));
  }
  status('Cloud job is still running. Reopen Ridge later; the job ID is saved on this device.','warn');return null;
}
async function resumeExisting(t){const job=readJob();if(!job?.id)return false;if(Date.now()-Number(job.startedAt||0)>24*60*60*1000){clearJob();return false}try{const s=await getJobState(job,t);if(s.status==='done'){clearJob();installDownload(s.downloadUrl);status('Recovered completed cloud render after restart.','ok');return true}if(s.status==='failed'){clearJob();return false}status(`Resuming cloud job ${String(job.id).slice(0,8)}…`,'ok');watch(job,t).catch(e=>{status(e.message,'err');log(e.message,'err')});return true}catch(e){log(`Could not resume saved cloud job yet: ${e.message}`,'warn');return false}}
async function cloudCreate(ev){
  ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();const btn=$('#createBtn');if(btn.disabled)return;btn.disabled=true;
  try{
    const t=token({promptUser:true});if(!t){status('Ridge Cloud authorization is required; local final encoding is disabled to prevent crashes.','warn');return}
    if(await resumeExisting(t))return;
    const audio=$('#songFile')?.files?.[0];if(!audio){status('Choose a song first.','warn');$('#songFile')?.click();return}
    const caps=await api('/api/render/capabilities','',{},15000);if(!caps.ready)throw Error('Ridge Cloud is not ready. R2 storage and GitHub cloud rendering must both be enabled; local final rendering stays disabled.');
    const title=($('#title')?.value||audio.name.replace(/\.[^.]+$/,'')).trim()||'Ridge Music';
    status('Uploading song to resumable R2 storage…','ok');log('Final rendering is cloud-first on this device.','ok');
    const a=await stage(audio,t);status('Audio staged globally. Preparing lightweight cover…','ok');const c=await stage(await coverFile(title),t);
    const body={audioUrl:a.url,coverUrl:c.url,title,lyrics:$('#lyrics')?.value||'',queries:queries(),mode:'auto'};
    const job=await api('/api/render/start',t,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},30000);const saved={id:job.id,startedAt:Date.now(),title,status:'queued',cloud:base()};saveJob(saved);
    status('Cloud render queued. You may close/reopen Ridge; it will resume this job.','ok');await watch(saved,t);
  }catch(e){status(e.message,'err');log(e.message,'err')}finally{btn.disabled=false}
}
function install(){
  migrateToken();document.documentElement.dataset.ridgeRender='cloud-first';window.__RIDGE_CLOUD_FIRST_READY__=true;
  const b=$('#createBtn');if(b){b.textContent='DIRECT + CREATE IN CLOUD';b.addEventListener('click',cloudCreate,true)}const q=$('#qualityState');if(q)q.textContent='Cloud final render · resumable · crash-resistant';
  const d=$('#downloadBtn');if(d)d.addEventListener('click',ev=>{if(!d.dataset.cloudUrl)return;ev.preventDefault();ev.stopImmediatePropagation();location.href=d.dataset.cloudUrl},true);
  const existing=readJob();if(existing?.id){const t=token();if(t)resumeExisting(t);else status(`Saved cloud job ${String(existing.id).slice(0,8)} detected. Press Create to resume it.`,'warn')}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
