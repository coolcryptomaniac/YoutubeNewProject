import assert from 'node:assert/strict';
import {FREE_WORKERS_AI_TEXT_MODELS,WORKERS_AI_PAID_ONLY_BLOCKLIST,RETIRED_OR_DISABLED,PAID_MEDIA_PROVIDERS,freePolicyCapabilities,isWorkersAiFreeModel} from '../cloud/src/providers/free-policy.js';

assert.equal(isWorkersAiFreeModel('@cf/zai-org/glm-4.7-flash'),true);
for(const model of WORKERS_AI_PAID_ONLY_BLOCKLIST)assert.equal(isWorkersAiFreeModel(model),false,`paid-only model leaked into free router: ${model}`);
assert.ok(!FREE_WORKERS_AI_TEXT_MODELS.some(x=>WORKERS_AI_PAID_ONLY_BLOCKLIST.includes(x)),'free and paid Workers AI lists overlap');
assert.ok(RETIRED_OR_DISABLED.includes('meta/llama-3.3-70b-instruct'),'retired NVIDIA endpoint must remain blocked');
assert.ok(PAID_MEDIA_PROVIDERS.includes('veo')&&PAID_MEDIA_PROVIDERS.includes('replicate'),'paid media providers must remain blocked');
const caps=freePolicyCapabilities({AI:{},GROQ_API_KEY:'configured'});
assert.equal(caps.paidFallback,false);
assert.equal(caps.mediaGeneration.automatic,false);
assert.equal(caps.workersAI.dailyNeuronBudget,10000);
assert.equal(caps.geminiEmbedding2.enabled,false,'Gemini embedding must remain non-automatic until no-billing can be enforced');
console.log('Ridge free-only provider policy OK');
