import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const worker=read('cloud/src/worker-v7.js');
const wrangler=read('cloud/wrangler.toml');
const cloudFirst=read('studio-v3-cloud-first.js');
const legacy=read('studio-v3-mobile-cloud.js');
const resilience=read('studio-v3-resilience.js');
const vusic=read('cloud/src/providers/vusic.js');
const vusicWorkflow=read('.github/workflows/vusic-e2e-canary.yml');

assert.match(wrangler,/main\s*=\s*"src\/worker-v7\.js"/,'Worker v7 must be deployed');
assert.match(wrangler,/\[triggers\][\s\S]*crons\s*=/,'R2 cleanup cron must be configured');
assert.match(worker,/pipeline-stage\//,'pipeline uploads must use durable R2 keys');
assert.match(worker,/pipeline-render\//,'pipeline results/status must use durable R2 keys');
assert.doesNotMatch(worker,/caches\.default/,'Worker v7 must never reintroduce edge-local Cache API state');
assert.match(worker,/api\/render\/capabilities/,'generic cloud render capability route required');
assert.match(worker,/api\/render\/start/,'generic cloud render start route required');
assert.match(worker,/scheduled\(_event,env/,'scheduled R2 expiry cleanup required');
assert.match(worker,/paidFallback:false/,'paid fallback must stay disabled');

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
assert.match(vusic,/dryRun:true/,'Vusic review-mode validation must remain available');
assert.match(vusicWorkflow,/cron: '23 3 \* \* 1'/,'Vusic login smoke should run weekly');
assert.match(vusicWorkflow,/confirm_live.*RELEASE_CANARY/s,'live Vusic canary must require an explicit gate');
assert.match(vusicWorkflow,/canaryMode:\"pre-agreement\"/,'scheduled/manual safe canary must support pre-agreement traversal');

console.log('Ridge v3.9 crash-resistance contracts: PASS');
