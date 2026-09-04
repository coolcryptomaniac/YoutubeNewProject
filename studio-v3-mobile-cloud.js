(function(){
'use strict';
// Compatibility entrypoint kept because Studio 3.9 pages already load this file.
// Heavy final rendering is cloud-first on every device. Until that controller
// declares itself ready, CREATE is blocked so a loader/network failure can never
// fall through to the legacy in-browser MediaRecorder path.
if(window.__RIDGE_CLOUD_FIRST_LOADER__)return;
window.__RIDGE_CLOUD_FIRST_LOADER__=true;
const guard=ev=>{
  if(window.__RIDGE_CLOUD_FIRST_READY__)return;
  ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
  const e=document.querySelector('#status');if(e){e.textContent='Cloud-first renderer is not ready. Local final rendering is disabled to prevent another browser crash.';e.dataset.kind='err'}
};
window.__RIDGE_CLOUD_FIRST_GUARD__=guard;
const installGuard=()=>document.querySelector('#createBtn')?.addEventListener('click',guard,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGuard,{once:true});else installGuard();
const s=document.createElement('script');
s.src='./studio-v3-cloud-first.js?v=3.9.1';
s.defer=true;
s.onerror=()=>{const e=document.querySelector('#status');if(e){e.textContent='Cloud-first renderer failed to load. Local final rendering remains disabled for safety.';e.dataset.kind='err'}};
document.head.appendChild(s);
})();
