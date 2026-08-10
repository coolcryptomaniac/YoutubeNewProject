import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VIDEO_TEMPLATES,TEMPLATE_COUNT,pickTemplate} from '../studio-v3-templates.js';

const html=fs.readFileSync('studio-v2.html','utf8');
const app=fs.readFileSync('studio-v3.js','utf8');
const storage=fs.readFileSync('studio-v3-storage.js','utf8');
const render=fs.readFileSync('studio-v3-render.js','utf8');
const themes=fs.readFileSync('studio-v3-themes.js','utf8');
const groq=fs.readFileSync('studio-v3-groq.js','utf8');
const publish=fs.readFileSync('studio-v3-publish.js','utf8');
const cloud=fs.readFileSync('studio-v3-cloud.js','utf8');
const worker=fs.readFileSync('cloud/src/worker.js','utf8');
const wrangler=fs.readFileSync('cloud/wrangler.toml','utf8');
const deploy=fs.readFileSync('.github/workflows/deploy-ridge-cloud.yml','utf8');
const css=fs.readFileSync('studio-v3.css','utf8');

assert.match(html,/Ridge Studio 3\.2/);
assert.match(html,/CREATE VIDEO/);
assert.match(html,/Create · Edit · Publish/);
assert.match(html,/\.\/studio-v3\.js/);
assert.match(html,/\.\/studio-v3\.css/);
for(const old of ['./studio-v2-lite.js','./studio-v2-combo.js','./studio-v2-credentials.js','Daily Factory','Pexels API key'])assert.ok(!html.includes(old),`legacy runtime clutter remains: ${old}`);

const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]));
const refs=new Set([...app.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map(x=>x[1]));
const missing=[...refs].filter(x=>!ids.has(x));assert.deepEqual(missing,[],`V3 missing DOM ids: ${missing.join(', ')}`);
for(const id of ['firstRun','firstRunFolder','firstRunSkip','songFile','createBtn','stage','shareBtn','youtubePublish','settingsPanel','folderFiles','templateSelect','cloudUrl','cloudStock','freeVideoMinutes','testCloud','nvidiaMode','nvidiaState','applyNvidia'])assert.ok(ids.has(id),`missing core UI id ${id}`);
assert.ok(!html.includes('NVIDIA_API_KEY'),'NVIDIA key must not have a browser input or literal secret name in the page');

assert.equal(TEMPLATE_COUNT,72,'expected 72 compact genre/mood recipes');
assert.equal(VIDEO_TEMPLATES.length,72);
assert.equal(new Set(VIDEO_TEMPLATES.map(x=>x.id)).size,72,'template ids must be unique');
assert.ok(VIDEO_TEMPLATES.every(x=>x.queries.length===4&&x.theme&&x.genre&&x.mood));
assert.equal(pickTemplate({text:'dark phonk night drive bass'}).genre,'phonk');
assert.equal(pickTemplate({text:'बारिश sad lonely memory'}).genre,'rain');

assert.match(storage,/showDirectoryPicker/);assert.match(storage,/mode:'read'/);assert.match(storage,/put\('media-root',root\)/);assert.match(storage,/put\('media-index',out\)/);
assert.ok(!/putAsset|put\([^\n]*blob/i.test(storage),'V3 media library should not copy media blobs to IndexedDB');
assert.match(storage,/maxFiles=500/);assert.match(storage,/addRemote/);assert.match(storage,/source:'remote'/);assert.match(storage,/ridge\.credentials\.v1/);assert.match(storage,/ridge\.project\.v3/);

assert.match(render,/class SceneLease/);assert.match(render,/this\.lease=new SceneLease/);assert.match(render,/this\.current\?\.release/);assert.match(render,/this\.lease\.clear\(\)/);assert.match(render,/bitmap\.close/);assert.match(render,/URL\.revokeObjectURL/);
assert.ok(!render.includes('decodeAudioData'),'V3 final renderer must stream audio instead of decoding full PCM');assert.match(render,/createMediaElementSource/);assert.match(render,/getDirectory/);assert.match(render,/280\*1024\*1024/);assert.match(render,/960,h:540,fps:24/);assert.match(render,/540,h:960,fps:24/);
assert.match(render,/item\.source==='remote'/);assert.match(render,/crossOrigin='anonymous'/);assert.match(render,/v\.src=item\.remoteUrl/);

assert.equal((themes.match(/id:'naru-/g)||[]).length,5,'expected five ready-made Naru procedural packs');assert.match(themes,/buildLyricCues/);assert.match(themes,/drawProcedural/);assert.ok(!/particles\.push|stars\.push|while\([^\)]*length</.test(themes),'V3 themes must not grow animation arrays');

assert.match(groq,/lockMeaning/);assert.match(groq,/packageFromLock/);assert.match(groq,/Do not translate the song into another language/);assert.match(groq,/openai\/gpt-oss-20b/);assert.match(groq,/whisper-large-v3-turbo/);
assert.match(app,/prepareUserGesture\(state\.song\)/);assert.match(app,/firstRunFolder/);assert.match(app,/closeFirstRun/);assert.match(app,/https:\/\/suno\.com\//);assert.match(app,/prepareCloudMedia/);assert.match(app,/generateFreeClips/);assert.match(app,/pickTemplate/);
assert.match(app,/nvidiaMode:'shadow'/);assert.match(app,/maybeNvidiaRefine/);assert.match(app,/applyNvidiaCandidate/);assert.match(app,/review\.confidence/);assert.match(app,/\.78/);
assert.ok(!/suno.*password|password.*suno|suno.*cookie|cookie.*suno/i.test(app),'no Suno credential scraping');assert.ok(!/Pollinations|PexelsClient|SceneManager|ridge-media-bank-v1/.test(app),'old heavy media/provider runtime leaked into V3 app');

assert.match(cloud,/windowMinutes=3/);assert.match(cloud,/Math\.min\(10/);assert.match(cloud,/40\*1024\*1024/);assert.match(cloud,/No verified-free video model/);assert.match(cloud,/nvidiaRefine/);assert.match(cloud,/api\/nvidia\/refine/);
assert.match(worker,/api\.pexels\.com\/v1\/videos\/search/);assert.match(worker,/max-age=86400/);assert.match(worker,/videos\.pexels\.com/);assert.match(worker,/FREE_VIDEO_ONLY/);assert.match(worker,/isVerifiedFree/);assert.match(worker,/is_free===true/);assert.match(worker,/return json\(\{error:'No provider currently marks this model as free; paid fallback disabled'/);
assert.match(worker,/env\.NVIDIA_API_KEY/);assert.match(worker,/integrate\.api\.nvidia\.com\/v1\/chat\/completions/);assert.match(worker,/sarvamai\/sarvam-m/);assert.match(worker,/LOCKED STORY/);assert.match(worker,/api\/nvidia\/refine/);
assert.match(wrangler,/NVIDIA_TEXT_MODEL = "sarvamai\/sarvam-m"/);assert.match(deploy,/secrets\.NVIDIA_API_KEY/);assert.match(deploy,/wrangler secret put NVIDIA_API_KEY/);

assert.match(publish,/navigator\.share/);assert.match(publish,/youtube\/v3\/videos/);assert.match(publish,/video_reels/);assert.match(publish,/instagramDirect:false/);assert.match(publish,/linkedinDirect:false/);assert.match(publish,/8\*1024\*1024/);
assert.match(css,/min-height:44px/);assert.match(css,/@media\(max-width:620px\)/);assert.match(css,/grid-template-columns:1fr/);

console.log(`studio-v3-selftest: PASS — ${ids.size} UI ids, ${TEMPLATE_COUNT} recipes, Groq primary + NVIDIA shadow, local+cloud streaming media`);
