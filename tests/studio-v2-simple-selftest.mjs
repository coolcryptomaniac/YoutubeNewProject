import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GROQ_MODEL,GROQ_WHISPER_MODEL,GroqHelper} from '../studio-v2-groq.js';

const simple=fs.readFileSync(new URL('../studio-v2-simple.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../studio-v2-main.js',import.meta.url),'utf8');

assert.equal(GROQ_MODEL,'llama-3.1-8b-instant');
assert.equal(GROQ_WHISPER_MODEL,'whisper-large-v3-turbo');
assert.equal(typeof GroqHelper.prototype.lyrics,'function');
assert.equal(typeof GroqHelper.prototype.transcribeAudio,'function');
assert.equal(typeof GroqHelper.prototype.analyzeSong,'function');
assert.match(simple,/FULL AUTO/);
assert.match(simple,/Suno guided/);
assert.match(simple,/Pexels video/);
assert.match(simple,/Pollinations images/);
assert.match(simple,/Restart from here/);
assert.match(simple,/Pause after each completed step/);
for(let n=1;n<=6;n++)assert.ok(simple.includes(`data-simple-step=\\"${n}\\"`)||simple.includes(`data-simple-step="${n}"`),`simple step ${n} missing`);
assert.ok(main.includes("./studio-v2-simple.js"));
assert.ok(!main.includes("./studio-v2-plus.js"),'Daily Factory / old Creator Plus should not boot by default');
for(const forbidden of ['sunoPassword','suno_password','sunoCookie','suno_cookie','SUNO_SESSION','sunoSessionToken'])assert.ok(!simple.includes(forbidden),`Simple Mode must not collect ${forbidden}`);
assert.match(simple,/transcribeAudio/);
assert.match(simple,/analyzeSong/);
assert.match(simple,/pexels_queries/);
assert.match(simple,/scene_prompts/);

console.log('studio-v2-simple-selftest: PASS — six interruptible steps, Groq song analysis, Pexels/Pollinations, no Suno credentials');
