import assert from 'node:assert/strict';

const base=(process.env.RIDGE_CLOUD_URL||'https://ridge-cloud-media.founder-f53.workers.dev').replace(/\/+$/,'');
const timeout=ms=>AbortSignal.timeout(ms);

const hr=await fetch(base+'/api/health',{cache:'no-store',signal:timeout(15000)});
assert.equal(hr.status,200,'health endpoint must return 200');
const health=await hr.json();
assert.equal(health.ok,true,'Ridge Cloud health must be ok');
assert.equal(health.pexels,true,'Pexels secret must be configured');
assert.equal(health.nvidia,true,'NVIDIA secret must be configured');
assert.equal(health.freeVideo,true,'HF token must be configured');
assert.equal(health.freeOnly,true,'paid video fallback must remain disabled');

const pr=await fetch(base+'/api/pexels/search?q='+encodeURIComponent('cinematic rain night')+'&orientation=landscape&per_page=1',{signal:timeout(20000)});
assert.equal(pr.status,200,'Pexels smoke query must return 200');
const p=await pr.json();
assert.ok(Array.isArray(p.videos)&&p.videos.length>=1,'Pexels smoke query must return at least one video');
assert.match(p.videos[0].mediaUrl||'',/^https:\/\//,'Pexels result must expose streamed media URL');

const sample={language:'Hindi',current:{title:'बारिश की रात',description:'बारिश की रात में बिछड़े प्रेम की याद लौटती है।',hashtags:['#music'],tags:['music'],clean_lyrics:'बारिश गिरती है\nतेरी याद लौटती है\nरात फिर वही कहानी कहती है',intro:'एक बारिश भरी रात',outro:'यादें रह जाती हैं',story:'बारिश वाली रात में बिछड़े प्रेम की याद',hook_meaning:'हर बूंद पुराने प्रेम की याद जगाती है'}};
const nr=await fetch(base+'/api/nvidia/refine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sample),signal:timeout(65000)});
const raw=await nr.text();let n={};try{n=JSON.parse(raw)}catch{n={raw:raw.slice(0,500)}}
if(nr.status!==200)throw new Error(`NVIDIA refine ${nr.status}: ${JSON.stringify(n).slice(0,800)}`);
assert.equal(n.ok,true,'NVIDIA response must be ok');
assert.match(n.model||'',/sarvam|nvidia/i,'NVIDIA model identity missing');
assert.ok(n.candidate?.title&&n.candidate?.description&&n.candidate?.clean_lyrics,'NVIDIA candidate is incomplete');
assert.match(n.candidate.title,/\p{Script=Devanagari}/u,'Hindi title should remain in Devanagari');

console.log('ridge-cloud-live-smoke: PASS',JSON.stringify({health,pexels:p.videos.length,nvidia:{model:n.model,verdict:n.verdict,confidence:n.confidence,summary:n.changesSummary}}));
console.log('HF video generation intentionally NOT called: this smoke test spends no video credits.');