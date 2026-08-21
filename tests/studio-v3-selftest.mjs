import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VIDEO_TEMPLATES,TEMPLATE_COUNT,pickTemplate} from '../studio-v3-templates.js';
import {alignLyricsToSegments,buildStoryPlan,sceneAtTime,mediaMatchScore,storyPlanSummary} from '../studio-v3-story.js';

const html=fs.readFileSync('studio-v2.html','utf8');
const app=fs.readFileSync('studio-v3.js','utf8');
const story=fs.readFileSync('studio-v3-story.js','utf8');
const evalJs=fs.readFileSync('studio-v3-eval.js','utf8');
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

assert.match(html,/Ridge Studio 3\.(?:8|9)/);
assert.match(html,/DIRECT \+ CREATE VIDEO/);assert.match(html,/Lyrics · Story · Music Video/);assert.match(html,/\.\/studio-v3\.js/);assert.match(html,/\.\/studio-v3-eval\.js/);assert.match(html,/\.\/studio-v3\.css/);
for(const old of ['./studio-v2-lite.js','./studio-v2-combo.js','./studio-v2-credentials.js','Daily Factory','Pexels API key'])assert.ok(!html.includes(old),`legacy runtime clutter remains: ${old}`);

const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]));
const refs=new Set([...app.matchAll(/\$\(['"]#([A-Za-z0-9_-]+)['"]\)/g)].map(x=>x[1]));
const missing=[...refs].filter(x=>!ids.has(x));assert.deepEqual(missing,[],`V3 missing DOM ids: ${missing.join(', ')}`);
for(const id of ['firstRun','songFile','createBtn','stage','shareBtn','settingsPanel','templateSelect','cloudUrl','freeVideoMinutes','testCloud','deepCloudTest','nvidiaMode','nvidiaState','applyNvidia','rateGroq','rateNvidia','rateTie','modelEvalState','useModelRecommendation','cloudDeepState'])assert.ok(ids.has(id),`missing core UI id ${id}`);
assert.ok(!html.includes('NVIDIA_API_KEY'),'NVIDIA key must never appear in browser HTML');

assert.equal(TEMPLATE_COUNT,72,'expected 72 compact genre/mood recipes');assert.equal(VIDEO_TEMPLATES.length,72);assert.equal(new Set(VIDEO_TEMPLATES.map(x=>x.id)).size,72,'template ids must be unique');assert.ok(VIDEO_TEMPLATES.every(x=>x.queries.length===4&&x.theme&&x.genre&&x.mood));assert.equal(pickTemplate({text:'dark phonk night drive bass'}).genre,'phonk');assert.equal(pickTemplate({text:'बारिश sad lonely memory'}).genre,'rain');

// Semantic timeline is executable, chronological and meaning-bearing.
const lyrics='[Verse]\nबारिश में घर याद आता है\nखाली सड़क मुझे बुलाती है\n[Chorus]\nमैं लौट आऊँगा घर\nमैं लौट आऊँगा घर';
const segments=[{start:2,end:6,text:'बारिश में घर याद आता है'},{start:6.2,end:10,text:'खाली सड़क मुझे बुलाती है'},{start:10.4,end:14,text:'मैं लौट आऊँगा घर'},{start:14.2,end:18,text:'मैं लौट आऊँगा घर'}];
const cues=alignLyricsToSegments(lyrics,segments,20);assert.equal(cues.length,4);assert.equal(cues[0].section,'Verse');assert.equal(cues[2].section,'Chorus');assert.ok(cues.every((x,i)=>x.end>x.start&&(!i||x.start>=cues[i-1].start)),'lyric cues must remain chronological');assert.equal(cues[0].source,'whisper');
const plan=buildStoryPlan({title:'घर वापसी',story:'A traveller misses home in the rain and decides to return.',hookMeaning:'The chorus promises a return home.',lyrics,visualAnchors:['rain window','empty road','mountain home'],storyBeats:[{section:'Verse',lyric:'बारिश में घर याद आता है',meaning:'Rain triggers homesickness',visual:'traveller at a rainy bus window',query:'rain bus window traveller',energy:.3},{section:'Chorus',lyric:'मैं लौट आऊँगा घर',meaning:'He chooses to return',visual:'traveller walking toward mountain home at sunrise',query:'mountain home sunrise traveller',energy:.72}]},120);
assert.ok(plan.scenes.length>=16&&plan.scenes.length<=48,`unexpected scene count ${plan.scenes.length}`);assert.equal(plan.scenes[0].start,0);assert.equal(plan.scenes.at(-1).end,120);assert.ok(plan.scenes.every((x,i)=>x.end>x.start&&(!i||x.start>=plan.scenes[i-1].end-.001)),'story scenes must be chronological');assert.ok(sceneAtTime(90,plan)?.meaning,'scene lookup must preserve lyric meaning');assert.match(storyPlanSummary(plan),/meaning-matched scenes/);assert.ok(mediaMatchScore({id:'1',name:'rain bus window.mp4',kind:'video'},plan.scenes[0])>mediaMatchScore({id:'2',name:'laser club.mp4',kind:'video'},plan.scenes[0]),'semantic media match must prefer story-relevant footage');

assert.match(storage,/showDirectoryPicker/);assert.match(storage,/mode:'read'/);assert.match(storage,/put\('media-root',root\)/);assert.ok(!/putAsset|put\([^\n]*blob/i.test(storage),'V3 media library should not copy media blobs to IndexedDB');assert.match(storage,/maxFiles=500/);assert.match(storage,/ridge\.credentials\.v1/);assert.match(storage,/chooseForScene/);assert.match(storage,/mediaMatchScore/);
assert.match(render,/class SceneLease/);assert.match(render,/this\.current\?\.release/);assert.match(render,/bitmap\.close/);assert.match(render,/URL\.revokeObjectURL/);assert.ok(!render.includes('decodeAudioData'),'V3 final renderer must stream audio instead of decoding full PCM');assert.match(render,/280\*1024\*1024/);assert.match(render,/pendingLimit=\(mobile\?8:24\)\*MB/);assert.match(render,/w:640,h:360,fps:20/);assert.match(render,/w:360,h:640,fps:20/);assert.match(render,/snapshotVideo/);assert.match(render,/cleanupRidgeStorage/);assert.match(render,/transferToImageBitmap/);assert.match(render,/sceneAtTime/);assert.match(render,/chooseForScene/);assert.match(render,/project\.scenePlan/);
const chromeMimeList=render.match(/const stable=safari\?\[[^\]]+\]:\[([^\]]+)\]/)?.[1]||'';const vp8=chromeMimeList.indexOf("video/webm;codecs=vp8,opus"),mp4=chromeMimeList.indexOf("video/mp4;codecs=avc1.42E01E,mp4a.40.2");assert.ok(vp8>=0&&mp4>=0&&vp8<mp4,'non-Safari recorder preference must put VP8/WebM before MP4/H.264');
assert.equal((themes.match(/id:'naru-/g)||[]).length,5,'expected five Naru procedural packs');assert.ok(!/particles\.push|stars\.push/.test(themes),'V3 themes must not grow animation arrays');assert.match(themes,/Karaoke progress/);assert.match(themes,/cur\.section/);assert.match(themes,/createLinearGradient/);

assert.match(groq,/lockMeaning/);assert.match(groq,/packageFromLock/);assert.match(groq,/Do not translate the song into another language/);assert.match(groq,/openai\/gpt-oss-20b/);assert.match(groq,/whisper-large-v3-turbo/);assert.match(groq,/story_beats/);assert.match(groq,/emotional_arc/);assert.match(groq,/chronological/);
assert.match(story,/alignLyricsToSegments/);assert.match(story,/buildStoryPlan/);assert.match(story,/mediaMatchScore/);assert.match(app,/nvidiaMode:'shadow'/);assert.match(app,/maybeNvidiaRefine/);assert.match(app,/applyNvidiaCandidate/);assert.match(app,/\.78/);assert.match(app,/prepareCloudMedia/);assert.match(app,/rebuildSemanticTimeline/);assert.match(app,/alignLyricsToSegments/);assert.match(app,/searchStoryboard/);assert.ok(!/suno.*password|password.*suno|suno.*cookie|cookie.*suno/i.test(app),'no Suno credential scraping');

assert.match(evalJs,/ridge\.model-eval\.v1/);assert.match(evalJs,/MIN_RATED=8/);assert.match(evalJs,/NVIDIA_PROMOTE=\.75/);assert.match(evalJs,/n>=6/);assert.match(evalJs,/rateGroq/);assert.match(evalJs,/rateNvidia/);assert.match(evalJs,/useModelRecommendation/);assert.match(evalJs,/api\/pexels\/search/);assert.match(evalJs,/api\/nvidia\/refine/);assert.ok(!evalJs.includes('/api/video/generate'),'Deep diagnostics must never spend HF video credits');assert.ok(!evalJs.includes('NVIDIA_API_KEY'),'browser evaluation code must not know the NVIDIA secret name');

assert.match(cloud,/Math\.min\(10/);assert.match(cloud,/40\*1024\*1024/);assert.match(cloud,/16\*1024\*1024/);assert.match(cloud,/mobile\?1/);assert.match(cloud,/searchStoryboard/);assert.match(cloud,/representativeQueries/);assert.match(cloud,/nvidiaRefine/);
assert.match(worker,/api\.pexels\.com\/v1\/videos\/search/);assert.match(worker,/FREE_VIDEO_ONLY/);assert.match(worker,/isVerifiedFree/);assert.match(worker,/paid fallback disabled/);assert.match(worker,/env\.NVIDIA_API_KEY/);assert.match(worker,/integrate\.api\.nvidia\.com\/v1\/chat\/completions/);assert.match(worker,/meta\/llama-3\.3-70b-instruct/);assert.match(worker,/LOCKED STORY/);
assert.match(wrangler,/NVIDIA_TEXT_MODEL = "meta\/llama-3\.3-70b-instruct"/);assert.match(deploy,/secrets\.NVIDIA_API_KEY/);assert.match(deploy,/wrangler secret put NVIDIA_API_KEY/);assert.match(deploy,/push:\n\s+branches: \[main\]/);assert.match(deploy,/cloud\/\*\*/);assert.match(deploy,/Post-deploy live smoke/);assert.match(deploy,/ridge-cloud-media\.founder-f53\.workers\.dev/);assert.match(deploy,/node \.\.\/tests\/ridge-cloud-live-smoke\.mjs/);

assert.match(publish,/navigator\.share/);assert.match(publish,/youtube\/v3\/videos/);assert.match(publish,/video_reels/);assert.match(css,/min-height:44px/);assert.match(css,/@media\(max-width:620px\)/);

console.log(`studio-v3-selftest: PASS — ${ids.size} UI ids, ${TEMPLATE_COUNT} worlds, ${plan.scenes.length} semantic scenes, voice-aligned lyrics, crashproof mobile renderer`);
