import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const durable=read('cloud/src/worker-v7.js');
const recovery=read('cloud/src/worker-v8.js');
const wrangler=read('cloud/wrangler.toml');
const cloudFirst=read('studio-v3-cloud-first.js');
const legacy=read('studio-v3-mobile-cloud.js');
const resilience=read('studio-v3-resilience.js');
const vusic=read('cloud/src/providers/vusic.js');
const vusicProfile=read('cloud/src/providers/vusic-profile.js');
const renderWorkflow=read('.github/workflows/ridge-cloud-render.yml');
const vusicWorkflow=read('.github/workflows/vusic-e2e-canary.yml');

assert.match(wrangler,/main\s*=\s*"src\/worker-v8\.js"/,'Worker v8 must be deployed');
assert.match(wrangler,/\[triggers\][\s\S]*crons\s*=/,'R2 cleanup cron must be configured');
assert.match(durable,/pipeline-stage\//,'pipeline uploads must use durable R2 keys');
assert.match(durable,/pipeline-render\//,'pipeline results/status must use durable R2 keys');
assert.doesNotMatch(durable,/caches\.default/,'Worker v7 durable layer must never reintroduce edge-local Cache API state');
assert.match(durable,/api\/render\/capabilities/,'generic cloud render capability route required');
assert.match(durable,/api\/render\/start/,'generic cloud render start route required');
assert.match(durable,/scheduled\(_event,env/,'scheduled R2 expiry cleanup required');
assert.match(durable,/paidFallback:false/,'paid fallback must stay disabled');
assert.match(recovery,/render-failure/,'v8 must accept signed cloud-render failure callbacks');
assert.match(recovery,/45\*60\*1000/,'v8 must expire stale cloud jobs');
assert.match(recovery,/staleJobRecovery:true/,'health must expose stale-job recovery');
assert.match(renderWorkflow,/Report render failure to Ridge Cloud/,'GitHub renderer must report failed runs');
assert.match(renderWorkflow,/retry-all-errors/,'cloud downloads/callbacks should retry transient network errors');
assert.match(renderWorkflow,/120000000/,'cloud renderer must enforce result-size ceiling');

assert.match(cloudFirst,/ridge\.cloud\.render\.job\.v1/,'browser must persist resumable cloud job id');
assert.match(cloudFirst,/sessionStorage\.setItem\('ridge\.adminToken'/,'admin token should be session-scoped');
assert.doesNotMatch(cloudFirst,/localStorage\.setItem\('ridge\.adminToken'/,'admin token must not be persisted in localStorage');
assert.match(cloudFirst,/api\/render\/start/,'browser final render must use cloud route');
assert.match(cloudFirst,/__RIDGE_CLOUD_FIRST_READY__=true/,'cloud renderer must declare readiness');
assert.match(cloudFirst,/stopImmediatePropagation/,'cloud-first controller must block legacy final-render handlers');
assert.match(legacy,/studio-v3-cloud-first\.js\?v=3\.9\.1/,'legacy mobile entrypoint must load cloud-first controller');
assert.match(legacy,/if\(window\.__RIDGE_CLOUD_FIRST_READY__\)return/,'legacy loader must fail closed before cloud readiness');
assert.match(resilience,/BUILD='3\.9\.1'/,'resilience sentinel must match current hardening build');
assert.match(resilience,/ridge\.cloud\.render\.job\.v1/,'resilience sentinel must understand cloud jobs');

assert.match(vusic,/VUSIC_HUMAN_VERIFICATION_REQUIRED/,'Vusic automation must stop for CAPTCHA\/OTP');
assert.match(vusic,/canary==='pre-agreement'/,'Vusic must expose a non-signing wizard canary');
assert.match(vusic,/no agreement was accepted and nothing was submitted/,'pre-agreement canary must stop before legal acceptance');
assert.match(vusic,/release\.confirmSubmit!==true/,'Vusic final submit must remain explicit');
assert.match(vusicProfile,/finalSubmit:false/,'Vusic normalization must default to no final submit');
assert.match(vusicWorkflow,/cron: '23 3 \* \* 1'/,'Vusic login smoke should run weekly');
assert.match(vusicWorkflow,/confirm_live.*RELEASE_CANARY/s,'live Vusic canary must require an explicit gate');
assert.match(vusicWorkflow,/canaryMode:\"pre-agreement\"/,'safe canary must support pre-agreement traversal');

console.log('Ridge v3.9 crash-resistance contracts: PASS');
