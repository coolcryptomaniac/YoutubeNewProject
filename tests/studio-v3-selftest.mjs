import assert from 'node:assert/strict';
import fs from 'node:fs';
import {VIDEO_TEMPLATES,TEMPLATE_COUNT,templateById} from '../studio-v3-templates.js';
import {buildStoryPlan,sceneAtTime,alignLyricsToSegments,mediaMatchScore} from '../studio-v3-story.js';
import {themeById,buildLyricCues} from '../studio-v3-themes.js';

const html=fs.readFileSync(new URL('../studio-v2.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../studio-v3.js',import.meta.url),'utf8');
const story=fs.readFileSync(new URL('../studio-v3-story.js',import.meta.url),'utf8');
const storage=fs.readFileSync(new URL('../studio-v3-storage.js',import.meta.url),'utf8');
const groq=fs.readFileSync(new URL('../studio-v3-groq.js',import.meta.url),'utf8');
const themes=fs.readFileSync(new URL('../studio-v3-themes.js',import.meta.url),'utf8');
const render=fs.readFileSync(new URL('../studio-v3-render.js',import.meta.url),'utf8');
const publish=fs.readFileSync(new URL('../studio-v3-publish.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../studio-v3.css',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../studio-v3-cloud.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../cloud/src/worker.js',import.meta.url),'utf8');
const wrangler=fs.readFileSync(new URL('../cloud/wrangler.toml',import.meta.url),'utf8');
const deploy=fs.readFileSync(new URL('../.github/workflows/deploy-ridge-cloud.yml',import.meta.url),'utf8');
const evalJs=fs.readFileSync(new URL('../studio-v3-eval.js',import.meta.url),'utf8');

assert.equal(TEMPLATE_COUNT,VIDEO_TEMPLATES.length);assert.ok(TEMPLATE_COUNT>=72);assert.equal(templateById('naru-neon').theme,'naru-neon');assert.equal(themeById('naru-neon').id,'naru-neon');assert.ok(VIDEO_TEMPLATES.some(x=>x.theme==='phonk-noir'));assert.ok(VIDEO_TEMPLATES.some(x=>x.theme==='pastel-pop'));
const cues=buildLyricCues('[Verse]\nपहली रात\nदूसरी याद\n[Chorus]\nफिर वही प्यार',12);assert.equal(cues.length,3);assert.equal(cues[0].section,'Verse');assert.equal(cues[2].section,'Chorus');assert.ok(cues.every(x=>x.end>x.start));
const segments=[{start:0,end:2,text:'पहली रात'},{start:2,end:4,text:'दूसरी याद'},{start:4,end:7,text:'फिर वही प्यार'}];const aligned=alignLyricsToSegments('[Verse]\nपहली रात\nदूसरी याद\n[Chorus]\nफिर वही प्यार',segments,7);assert.equal(aligned.length,3);assert.equal(aligned[0].section,'Verse');assert.ok(aligned[2].start>=4);
const plan=buildStoryPlan({duration:22,lyrics:'[Verse]\nपहली रात\nदूसरी याद\n[Chorus]\nफिर वही प्यार',idea:'rainy mountain separation and reunion',director:{story_beats:[{start:0,end:10,summary:'lonely rain on mountain road',visual_query:'rain mountain road lonely',transition:'fade',motion:'push',energy:.3},{start:10,end:22,summary:'warm reunion at sunrise',visual_query:'mountain sunrise reunion warm',transition:'dissolve',motion:'pull',energy:.8}],emotional_arc:['lonely','hopeful','warm']}});assert.ok(plan.scenes.length>=2);assert.equal(sceneAtTime(1,plan).index,0);assert.ok(sceneAtTime(18,plan).index>=1);assert.ok(mediaMatchScore({name:'rain-mountain-road.mp4',searchText:'rain mountain road'},{visualQuery:'rain mountain road lonely',meaning:'lonely rain on mountain road'})>mediaMatchScore({name:'party-club.mp4',searchText:'club party'},{visualQuery:'rain mountain road lonely',meaning:'lonely rain on mountain road'}));

const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(x=>x[1]));assert.ok(ids.has('songFile'));assert.ok(ids.has('stage'));assert.ok(ids.has('createBtn'));assert.ok(ids.has('cloudUrl'));assert.ok(ids.has('cloudStock'));assert.ok(ids.has('nvidiaMode'));assert.ok(ids.has('youtubePublish'));assert.ok(html.includes('./studio-v3.js'));assert.ok(html.includes('./studio-v3.css'));assert.ok(html.includes('./studio-v3-eval.js'));assert.ok(!html.includes('./studio-v2-lite.js'));assert.ok(!html.includes('./studio-v2-combo.js'));assert.ok(!html.includes('./studio-v2-credentials.js'));

assert.match(storage,/showDirectoryPicker/);assert.match(storage,/mode:'read'/);assert.match(storage,/put\('media-root',root\)/);assert.ok(!/putAsset|put\([^\n]*blob/i.test(storage),'V3 media library should not copy media blobs to IndexedDB');assert.match(storage,/maxFiles=500/);assert.match(storage,/ridge\.credentials\.v1/);assert.match(storage,/chooseForScene/);assert.match(storage,/mediaMatchScore/);
assert.match(render,/class SceneLease/);assert.match(render,/this\.current\?\.release/);assert.match(render,/bitmap\.close/);assert.match(render,/URL\.revokeObjectURL/);assert.ok(!render.includes('decodeAudioData'),'V3 final renderer must stream audio instead of decoding full PCM');assert.match(render,/280\*1024\*1024/);assert.match(render,/pendingLimit=\(mobile\?8:24\)\*MB/);assert.match(render,/w:640,h:360,fps:20/);assert.match(render,/w:360,h:640,fps:20/);assert.match(render,/snapshotVideo/);assert.match(render,/cleanupRidgeStorage/);assert.match(render,/transferToImageBitmap/);assert.match(render,/sceneAtTime/);assert.match(render,/chooseForScene/);assert.match(render,/project\.scenePlan/);
const chromeMimeList=render.match(/const stable=safari\?\[[^\]]+\]:\[([^\]]+)\]/)?.[1]||'';const vp8=chromeMimeList.indexOf("video/webm;codecs=vp8,opus"),mp4=chromeMimeList.indexOf("video/mp4;codecs=avc1.42E01E,mp4a.40.2");assert.ok(vp8>=0&&mp4>=0&&vp8<mp4,'non-Safari recorder preference must put VP8/WebM before MP4/H.264');
assert.equal((themes.match(/id:'naru-/g)||[]).length,5,'expected five Naru procedural packs');assert.ok(!/particles\.push|stars\.push/.test(themes),'V3 themes must not grow animation arrays');assert.match(themes,/Karaoke progress/);assert.match(themes,/cur\.section/);assert.match(themes,/createLinearGradient/);

assert.match(groq,/lockMeaning/);assert.match(groq,/packageFromLock/);assert.match(groq,/Do not translate the song into another language/);assert.match(groq,/openai\/gpt-oss-20b/);assert.match(groq,/whisper-large-v3-turbo/);assert.match(groq,/story_beats/);assert.match(groq,/emotional_arc/);assert.match(groq,/chronological/);
assert.match(story,/alignLyricsToSegments/);assert.match(story,/buildStoryPlan/);assert.match(story,/mediaMatchScore/);assert.match(app,/nvidiaMode:'shadow'/);assert.match(app,/maybeNvidiaRefine/);assert.match(app,/applyNvidiaCandidate/);assert.match(app,/\.78/);assert.match(app,/prepareCloudMedia/);assert.match(app,/rebuildSemanticTimeline/);assert.match(app,/alignLyricsToSegments/);assert.match(app,/searchStoryboard/);assert.ok(!/suno.*password|password.*suno|suno.*cookie|cookie.*suno/i.test(app),'no Suno credential scraping');

assert.match(evalJs,/ridge\.model-eval\.v1/);assert.match(evalJs,/MIN_RATED=8/);assert.match(evalJs,/NVIDIA_PROMOTE=\.75/);assert.match(evalJs,/n>=6/);assert.match(evalJs,/rateGroq/);assert.match(evalJs,/rateNvidia/);assert.match(evalJs,/useModelRecommendation/);assert.match(evalJs,/api\/pexels\/search/);assert.match(evalJs,/api\/nvidia\/refine/);assert.ok(!evalJs.includes('/api/video/generate'),'Deep diagnostics must never spend HF video credits');assert.ok(!evalJs.includes('NVIDIA_API_KEY'),'browser evaluation code must not know the NVIDIA secret name');

assert.match(cloud,/Math\.min\(10/);assert.match(cloud,/40\*1024\*1024/);assert.match(cloud,/16\*1024\*1024/);assert.match(cloud,/mobile\?1/);assert.match(cloud,/searchStoryboard/);assert.match(cloud,/representativeQueries/);assert.match(cloud,/nvidiaRefine/);
assert.match(worker,/api\.pexels\.com\/v1\/videos\/search/);assert.match(worker,/FREE_VIDEO_ONLY/);assert.match(worker,/isVerifiedFree/);assert.match(worker,/paid fallback disabled/);assert.match(worker,/env\.NVIDIA_API_KEY/);assert.match(worker,/integrate\.api\.nvidia\.com\/v1\/chat\/completions/);assert.match(worker,/meta\/llama-3\.3-70b-instruct/);assert.match(worker,/LOCKED STORY/);
assert.match(wrangler,/NVIDIA_TEXT_MODEL = "meta\/llama-3\.3-70b-instruct"/);assert.ok(!/wrangler secret put/.test(deploy),'ordinary code deploys must preserve existing Worker secrets instead of rewriting/deploying each one');assert.match(deploy,/Deploy without rewriting secrets/);assert.match(deploy,/RIDGE_R2_READY/);assert.match(deploy,/RELEASE_MEDIA/);assert.match(deploy,/push:\n\s+branches: \[main\]/);assert.match(deploy,/cloud\/\*\*/);assert.match(deploy,/Post-deploy live smoke/);assert.match(deploy,/Vusic automation smoke/);assert.match(deploy,/ridge-cloud-media\.founder-f53\.workers\.dev/);assert.match(deploy,/node \.\.\/tests\/ridge-cloud-live-smoke\.mjs/);

assert.match(publish,/navigator\.share/);assert.match(publish,/youtube\/v3\/videos/);assert.match(publish,/video_reels/);assert.match(css,/min-height:44px/);assert.match(css,/@media\(max-width:620px\)/);

console.log(`studio-v3-selftest: PASS — ${ids.size} UI ids, ${TEMPLATE_COUNT} worlds, ${plan.scenes.length} semantic scenes, voice-aligned lyrics, crashproof mobile renderer`);
