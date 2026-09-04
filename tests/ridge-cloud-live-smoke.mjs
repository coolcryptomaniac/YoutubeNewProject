import assert from 'node:assert/strict';

const base=(process.env.RIDGE_CLOUD_URL||'https://ridge-cloud-media.founder-f53.workers.dev').replace(/\/+$/,'');
const timeout=ms=>AbortSignal.timeout(ms);

const hr=await fetch(base+'/api/health',{cache:'no-store',signal:timeout(15000)});
assert.equal(hr.status,200,'health endpoint must return 200');
const health=await hr.json();
assert.equal(health.ok,true,'Ridge Cloud health must be ok');
assert.equal(health.pexels,true,'Pexels secret must be configured');
assert.equal(health.freeVideo,true,'HF token must be configured');
assert.equal(health.freeOnly,true,'paid video fallback must remain disabled');
assert.equal(health.adaptiveTextRefine,true,'adaptive text refinement must be enabled');
assert.equal(health.textRefine?.paidFallback,false,'paid text fallback must remain disabled');
assert.equal(health.textRefine?.groqAutomatic,false,'Groq must remain opt-in because production models can be billed');
assert.equal(health.textRefine?.fallbackBypass,true,'text refinement must have a keep-current bypass');

const rr=await fetch(base+'/api/resilience/health',{cache:'no-store',signal:timeout(15000)});
assert.equal(rr.status,200,'resilience health must return 200');
const resilience=await rr.json();
assert.equal(resilience.ok,true,'resilience health must be ok');
assert.equal(resilience.r2,true,'R2 durable storage binding must be active');
assert.equal(resilience.githubRender,true,'GitHub cloud renderer must be configured');
assert.equal(resilience.localFinalRender,false,'local final rendering must remain disabled');
assert.equal(resilience.paidFallback,false,'paid fallback must remain disabled');

const pr=await fetch(base+'/api/pexels/search?q='+encodeURIComponent('cinematic rain night')+'&orientation=landscape&per_page=1',{signal:timeout(20000)});
assert.equal(pr.status,200,'Pexels smoke query must return 200');
const p=await pr.json();
assert.ok(Array.isArray(p.videos)&&p.videos.length>=1,'Pexels smoke query must return at least one video');
assert.match(p.videos[0].mediaUrl||'',/^https:\/\//,'Pexels result must expose streamed media URL');

const sample={language:'Hindi',current:{title:'बारिश की रात',description:'बारिश की रात में बिछड़े प्रेम की याद लौटती है।',hashtags:['#music'],tags:['music'],clean_lyrics:'बारिश गिरती है\nतेरी याद लौटती है\nरात फिर वही कहानी कहती है',intro:'एक बारिश भरी रात',outro:'यादें रह जाती हैं',story:'बारिश वाली रात में बिछड़े प्रेम की याद',hook_meaning:'हर बूंद पुराने प्रेम की याद जगाती है'}};
const tr=await fetch(base+'/api/text/refine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sample),signal:timeout(150000)});
const raw=await tr.text();let t={};try{t=JSON.parse(raw)}catch{t={raw:raw.slice(0,500)}}
if(tr.status!==200)throw new Error(`adaptive text refine ${tr.status}: ${JSON.stringify(t).slice(0,1000)}`);
assert.equal(t.ok,true,'adaptive text response must be ok');
assert.ok(['workers-ai','nvidia-nim','groq','bypass'].includes(t.provider),'unexpected text provider: '+t.provider);
assert.equal(t.paidFallback,false,'adaptive text router must not use paid fallback');
assert.ok(t.candidate?.title&&t.candidate?.description&&t.candidate?.clean_lyrics,'adaptive text candidate is incomplete');
assert.match(t.candidate.title,/\p{Script=Devanagari}/u,'Hindi title should remain in Devanagari');

console.log('ridge-cloud-live-smoke: PASS',JSON.stringify({health:{pexels:health.pexels,freeVideo:health.freeVideo,textRefine:health.textRefine},resilience:{r2:resilience.r2,githubRender:resilience.githubRender},pexels:p.videos.length,textRefine:{provider:t.provider,model:t.model,degraded:t.degraded,attempts:t.attempts?.length||0,summary:t.changesSummary}}));
console.log('HF video generation intentionally NOT called: this smoke test spends no video credits.');
