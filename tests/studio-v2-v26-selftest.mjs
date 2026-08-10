import assert from 'node:assert/strict';
import fs from 'node:fs';
import {COMBO_PRESETS,LANGUAGE_GUIDES,buildLyricsPrompt,buildPolishPrompt,buildMeaningPrompt,buildAnalysisPrompt,languageCompliance} from '../studio-v2-prompts.js';

const groq=fs.readFileSync('studio-v2-groq.js','utf8');
const html=fs.readFileSync('studio-v2.html','utf8');
const combo=fs.readFileSync('studio-v2-combo.js','utf8');
const learning=fs.readFileSync('studio-v2-learning.js','utf8');
const bank=fs.readFileSync('studio-v2-bank.js','utf8');

assert.ok(groq.includes("openai/gpt-oss-20b"));
assert.ok(groq.includes('buildPolishPrompt'),'lyrics need a second editorial pass');
assert.ok(groq.includes('buildMeaningPrompt'),'song meaning must be locked before packaging');
assert.ok(groq.includes("reasoning_effort"));
assert.ok(COMBO_PRESETS.length>=10);
assert.ok(COMBO_PRESETS.some(x=>x.id==='hindi-love-lofi-fast'));
assert.ok(COMBO_PRESETS.some(x=>x.id==='naru-rival-clash'));
assert.ok(COMBO_PRESETS.some(x=>x.language==='Kumaoni'));
assert.ok(LANGUAGE_GUIDES.Hindi.includes('Devanagari'));
assert.ok(LANGUAGE_GUIDES.Kumaoni.includes('fabricate'));
const lp=buildLyricsPrompt({idea:'tea stall reunion after years apart',language:'Hindi',style:'lofi',duration:150});
for(const phrase of ['Never sacrifice grammar for rhyme','protagonist','final chorus'])assert.ok(lp.toLowerCase().includes(phrase.toLowerCase()),`missing songwriting guard: ${phrase}`);
const pp=buildPolishPrompt({draft:{lyrics:'x'},idea:'x',language:'Hindi',style:'lofi'});assert.ok(/forced rhyme/i.test(pp));assert.ok(/grammar/i.test(pp));
const mp=buildMeaningPrompt({transcript:'मैं घर लौटता हूँ',language:'Hindi'});assert.ok(/source of truth for sung words/i.test(mp));
const ap=buildAnalysisPrompt({meaning:{canonical_meaning:'घर वापसी'},workingLyrics:'नमस्ते',language:'Hindi'});assert.ok(/STRICT CONSISTENCY/.test(ap));assert.ok(/same language\/script/i.test(ap));
assert.equal(languageCompliance('मैं घर लौट रहा हूँ','Hindi').ok,true);assert.equal(languageCompliance('I am coming home','English').ok,true);assert.equal(languageCompliance('I am coming home','Hindi').ok,false);
for(const id of ['comboPreset','applyCombo','comboAuto','learnedCombo','languageCheck','mediaBank','useBank','learningState','loveResult','needsWork'])assert.ok(html.includes(`id="${id}"`),`missing ${id}`);
assert.ok(html.includes('./studio-v2-combo.js'));assert.ok(combo.includes("ridge.release.package.v1"));assert.ok(learning.includes("ridge.learning.v1"));assert.ok(bank.includes("ridge-media-bank-v1"));assert.ok(combo.includes('SceneManager.prototype'));assert.ok(combo.includes('preferredCombo'));assert.ok(combo.includes('saveCanonical'));assert.ok(!html.includes('Naruto Shippuden'));
console.log(`studio-v2-v26-selftest: PASS — ${COMBO_PRESETS.length} combos, two-stage meaning lock, canonical package, adaptive learning, capped media bank`);
