(function(){
'use strict';
// Compatibility entrypoint kept because Studio 3.9 pages already load this file.
// Heavy final rendering is now cloud-first on every device; the dedicated
// controller owns job persistence, R2 staging and restart recovery.
if(window.__RIDGE_CLOUD_FIRST_LOADER__)return;
window.__RIDGE_CLOUD_FIRST_LOADER__=true;
const s=document.createElement('script');
s.src='./studio-v3-cloud-first.js?v=3.9.1';
s.defer=true;
s.onerror=()=>{const e=document.querySelector('#status');if(e){e.textContent='Cloud-first renderer failed to load. Local final rendering remains disabled for safety.';e.dataset.kind='err'}};
document.head.appendChild(s);
})();
