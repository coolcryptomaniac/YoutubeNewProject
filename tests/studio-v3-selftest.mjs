import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('studio-v2.html','utf8');
const app=fs.readFileSync('studio-v3.js','utf8');
const storage=fs.readFileSync('studio-v3-storage.js','utf8');
const render=fs.readFileSync('studio-v3-render.js','utf8');
const themes=fs.readFileSync('studio-v3-themes.js','utf8');
const groq=fs.readFileSync('studio-v3-groq.js','utf8');
const publish=fs.readFileSync('studio-v3-publish.js','utf8');
const css=fs.readFileSync('studio-v3.css','utf8');

assert.match(html,/Ridge Studio 3/);
assert.match(html,/CREATE VIDEO/);
assert.match(html,/Create · Edit · Publish/);
assert.match(html,/\.\/studio-v3\.js/);
assert.match(html,/\.\/studio-v3\.css/);
for(const old of ['./studio-v2-lite.js','./studio-v2-combo.js','./studio-v2-credentials.js','Daily Factory','Pexels API key'])assert.ok(!html.includes(old),`legacy runtime clutter remains: ${old}`);

const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]));
const refs=new Set([...app.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map(x=>x[1]));
const missing=[...refs].filter(x=>!ids.has(x));
assert.deepEqual(missing,[],`V3 missing DOM ids: ${missing.join(', ')}`);
for(const id of ['firstRun','firstRunFolder','firstRunSkip','songFile','createBtn','stage','shareBtn','youtubePublish','settingsPanel','folderFiles'])assert.ok(ids.has(id),`missing core UI id ${id}`);

assert.match(storage,/showDirectoryPicker/);
assert.match(storage,/mode:'read'/);
assert.match(storage,/put\('media-root',root\)/);
assert.match(storage,/put\('media-index',out\)/);
assert.ok(!/putAsset|put\([^\n]*blob/i.test(storage),'V3 media library should not copy media blobs to IndexedDB');
assert.match(storage,/maxFiles=500/);
assert.match(storage,/ridge\.credentials\.v1/);
assert.match(storage,/ridge\.project\.v3/);

assert.match(render,/class SceneLease/);
assert.match(render,/this\.current\?\.release/);
assert.match(render,/bitmap\.close/);
assert.match(render,/URL\.revokeObjectURL/);
assert.ok(!render.includes('decodeAudioData'),'V3 final renderer must stream audio instead of decoding full PCM');
assert.match(render,/createMediaElementSource/);
assert.match(render,/getDirectory/);
assert.match(render,/280\*1024\*1024/);
assert.match(render,/960,h:540,fps:24/);
assert.match(render,/540,h:960,fps:24/);
assert.match(render,/one scene/i);

assert.equal((themes.match(/id:'naru-/g)||[]).length,5,'expected five ready-made Naru procedural packs');
assert.match(themes,/buildLyricCues/);
assert.match(themes,/drawProcedural/);
assert.ok(!/particles\.push|stars\.push|while\([^\)]*length</.test(themes),'V3 themes must not grow animation arrays');

assert.match(groq,/lockMeaning/);
assert.match(groq,/packageFromLock/);
assert.match(groq,/Do not translate the song into another language/);
assert.match(groq,/openai\/gpt-oss-20b/);
assert.match(groq,/whisper-large-v3-turbo/);

assert.match(app,/prepareUserGesture\(state\.song\)/);
assert.match(app,/firstRunFolder/);
assert.match(app,/closeFirstRun/);
assert.match(app,/platform\.suno\.com/);
assert.ok(!/suno.*password|password.*suno|suno.*cookie|cookie.*suno/i.test(app),'no Suno credential scraping');
assert.ok(!/Pollinations|PexelsClient|SceneManager|ridge-media-bank-v1/.test(app),'old heavy media/provider runtime leaked into V3 app');

assert.match(publish,/navigator\.share/);
assert.match(publish,/youtube\/v3\/videos/);
assert.match(publish,/video_reels/);
assert.match(publish,/instagramDirect:false/);
assert.match(publish,/linkedinDirect:false/);
assert.match(publish,/8\*1024\*1024/);

assert.match(css,/min-height:44px/);
assert.match(css,/@media\(max-width:620px\)/);
assert.match(css,/grid-template-columns:1fr/);

console.log(`studio-v3-selftest: PASS — ${ids.size} UI ids, local handle library, streaming render, canonical Groq, social publish adapters`);
