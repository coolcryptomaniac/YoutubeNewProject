(function(){
'use strict';
const BUILD='3.8.2';
const PENDING='ridge.render.pending.v2';
const FAILS='ridge.render.failures.v2';
const LAST_OK='ridge.render.last-ok.v2';
const $=s=>document.querySelector(s);
const mobile=()=>/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')||innerWidth<760||(Number(navigator.deviceMemory)||8)<=4;
const read=(k,f=null)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const remove=k=>{try{localStorage.removeItem(k)}catch{}};
const prior=read(PENDING,null),priorFresh=!!(prior&&Date.now()-Number(prior.started||0)<6*60*60*1000);
let failures=Math.max(0,Number(read(FAILS,0))||0);
if(priorFresh)failures=Math.min(3,failures+1);
write(FAILS,failures);
const recovery=mobile()?Math.max(1,failures):failures;
window.__RIDGE_RESILIENCE__={build:BUILD,mobile:mobile(),recovery,extreme:mobile()||recovery>0};
let notice=false,creating=false;
function log(text,kind='warn'){const box=$('#log');if(!box)return;const d=document.createElement('div');d.className=kind;d.textContent=`${new Date().toLocaleTimeString()} · ${text}`;box.prepend(d);while(box.children.length>36)box.lastElementChild.remove()}
function status(text,kind='warn'){const e=$('#status');if(e){e.textContent=text;e.dataset.kind=kind}}
function harden(){
  if(!mobile()&&recovery===0)return;
  const stock=$('#cloudStock'),mins=$('#freeVideoMinutes'),nvidia=$('#nvidiaMode'),quality=$('#qualityState');
  if(stock){stock.checked=false;stock.disabled=true}
  if(mins){mins.value='0';mins.disabled=true}
  if(nvidia){nvidia.value=recovery>=2?'off':'shadow';if(recovery>=2)nvidia.disabled=true}
  document.documentElement.dataset.ridgeSafe=recovery>=2?'recovery':'mobile';
  if(quality)quality.textContent=recovery>=2?`Crash recovery ${recovery} · minimal renderer`:'Android ultra-safe · procedural renderer';
  if(!notice){notice=true;log(priorFresh?`Ridge detected an interrupted previous render and escalated to recovery level ${recovery}.`:`Ridge ${BUILD} mobile crash guard is active. Heavy cloud/media preparation is disabled during rendering.`,'warn')}
}
function markStart(){
  harden();creating=true;
  const file=$('#songFile')?.files?.[0];
  write(PENDING,{started:Date.now(),build:BUILD,recovery,name:file?.name||'',size:Number(file?.size)||0});
  if(recovery>=2)status(`Recovery level ${recovery}: using the smallest safe render path. Keep this tab visible.`,'warn');
}
function markSuccess(){creating=false;remove(PENDING);write(FAILS,0);write(LAST_OK,{at:Date.now(),build:BUILD});const q=$('#qualityState');if(q&&mobile())q.textContent='Android safe · last render completed'}
function markFailure(reason='render error'){creating=false;remove(PENDING);failures=Math.min(3,Math.max(failures,1)+1);write(FAILS,failures);log(`Render failed safely (${reason}). Next attempt will use recovery level ${failures}.`,'err')}
function inspect(){
  const s=String($('#status')?.textContent||'');
  if(/video ready|create complete|upload complete/i.test(s)){markSuccess();return}
  if(creating&&/render stopped|mediarecorder failed|could not read song|browser blocked render|reached ridge.s crash-prevention limit|error/i.test(s))markFailure(s.slice(0,180));
}
function install(){
  harden();
  $('#createBtn')?.addEventListener('click',markStart,true);
  $('#previewBtn')?.addEventListener('click',harden,true);
  for(const id of['cloudStock','freeVideoMinutes','nvidiaMode'])$('#'+id)?.addEventListener('change',harden,true);
  const target=$('#status');if(target)new MutationObserver(inspect).observe(target,{childList:true,subtree:true,characterData:true});
  window.addEventListener('pageshow',harden);
  window.addEventListener('pagehide',()=>{if(!creating)return;write(PENDING,{...(read(PENDING,{})||{}),pageHiddenAt:Date.now()})});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')harden()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
