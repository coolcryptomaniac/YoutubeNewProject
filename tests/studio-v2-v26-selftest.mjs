import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COMBO_PRESETS,LANGUAGE_GUIDES,buildLyricsPrompt,buildPolishPrompt,buildAnalysisPrompt,languageCompliance} from '../studio-v2-prompts.js';

const groq=fs.readFileSync('studio-v2-groq.js','utf8');
const html=fs.readFileSync('studio-v2.html','utf8');
const combo=fs.readFileSync('studio-v2-combo.js','utf8');
const learning=fs.readFileSync('studio-v2-learning.js','utf8');
const bank=fs.readFileSync('studio-v2-bank.js','utf8');

assert.ok(groq.includes("openai/gpt-oss-20b"),'Groq should use the current replacement text model');
assert.ok(!groq.includes("const MODEL='llama-3.1-8b-instant'"),'deprecated Groq text model must not be hard-coded');
assert.ok(groq.includes('buildPolishPrompt'),'lyrics must have a second editorial pass');
assert.ok(groq.includes("reasoning_effort"),'GPT-OSS reasoning mode should be explicit');

assert.ok(COMBO_PRESETS.length>=10,'expected at least ten one-click combos');
assert.ok(COMBO_PRESETS.some(x=>x.id==='hindi-love-lofi-fast'),'Hindi romantic + lofi + fast combo required');
assert.ok(COMBO_PRESETS.some(x=>x.id==='naru-battle-phonk'),'original Naru battle combo required');
assert.ok(COMBO_PRESETS.some(x=>x.language==='Kumaoni'),'Kumaoni combo required');
assert.ok(LANGUAGE_GUIDES.Hindi.includes('Devanagari'));
assert.ok(LANGUAGE_GUIDES.Kumaoni.includes('fabricate'));

const lp=buildLyricsPrompt({idea:'tea stall reunion after years apart',language:'Hindi',style:'lofi',duration:150});
for(const phrase of ['Never sacrifice grammar for rhyme','one coherent song','editorial pass'])assert.ok(lp.includes(phrase));
const pp=buildPolishPrompt({draft:{lyrics:'x'},idea:'x',language:'Hindi',style:'lofi'});
assert.ok(/forced rhyme/i.test(pp));
assert.ok(/grammar/i.test(pp));
const ap=buildAnalysisPrompt({workingLyrics:'नमस्ते',language:'Hindi'});
assert.ok(/CONSISTENCY RULE/.test(ap));
assert.ok(/same language\/script/.test(ap));

assert.equal(languageCompliance('मैं घर लौट रहा हूँ','Hindi').ok,true);
assert.equal(languageCompliance('I am coming home','English').ok,true);
assert.equal(languageCompliance('I am coming home','Hindi').ok,false);

for(const id of ['comboPreset','applyCombo','comboAuto','learnedCombo','languageCheck','mediaBank','useBank','learningState','loveResult','needsWork'])assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
assert.ok(html.includes('./studio-v2-combo.js'));
assert.ok(combo.includes("ridge.release.package.v1"),'canonical release package must persist');
assert.ok(learning.includes("ridge.learning.v1"),'learning namespace must be stable');
assert.ok(bank.includes("ridge-media-bank-v1"),'media bank must be stable IndexedDB');
assert.ok(combo.includes('SceneManager.prototype'),'media imports should be captured into reusable bank');
assert.ok(combo.includes('preferredCombo'),'learning should affect combo selection');
assert.ok(combo.includes('saveCanonical'),'title/lyrics/description canonical state must be synchronized');
assert.ok(!html.includes('Naruto Shippuden'),'do not ship copyrighted franchise assets in the UI');

console.log(`studio-v2-v26-selftest: PASS — ${COMBO_PRESETS.length} combos, language rules, canonical package, adaptive learning, media bank`);