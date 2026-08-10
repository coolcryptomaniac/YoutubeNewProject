'use strict';

import {MediaLibrary,readCredentials,saveCredentials,loadProject,saveProject,storageSummary,requestPersistentStorage,bytes} from './studio-v3-storage.js';
import {GroqSongBrain,fallbackPackage,GROQ_TEXT_MODEL,GROQ_AUDIO_MODEL} from './studio-v3-groq.js';
import {RenderEngine} from './studio-v3-render.js';
import {THEMES,themeById,drawProcedural} from './studio-v3-themes.js';
import {shareToApps,connectYouTube,publishYouTube,publishFacebookPageReel,publishingCapabilities} from './studio-v3-publish.js';

const $=s=>document.querySelector(s);
const DEFAULT={idea:'',language:'Hindi',theme:'naru-shadow',aspect:'landscape',title:'',description:'',hashtags:['#music','#musicvideo'],tags:['music','music video'],lyrics:'',intro:'',outro:'Thanks for listening',privacy:'private',story:'',hookMeaning:'',metadataStale:false};
const state={project:loadProject(DEFAULT),library:new MediaLibrary(),song:null,songUrl:'',result:null,thumb:null,thumbUrl:'',busy:false,ytConnected:false};
let engine=null;

function setStatus(text,kind=''){const e=$('#status');e.textContent=text;e.dataset.kind=kind}
function setProgress(v=0){$('#progressBar').style.width=(Math.max(0,Math.min(1,Number(v)||0))*100).toFixed(1)+'%'}
function log(text,kind=''){const box=$('#log'),d=document.createElement('div');d.className=kind;d.textContent=`${new Date().toLocaleTimeString()} · ${text}`;box.prepend(d);while(box.children.length>30)box.lastElementChild.remove()}
function save(){saveProject(state.project)}
function baseName(name='Original Song'){return String(name).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()||'Original Song'}
function projectFromUI(){state.project={...state.project,idea:$('#idea').value.trim(),language:$('#language').value,theme:$('#theme').value,aspect:$('#aspect').value,title:$('#title').value.trim(),description:$('#description').value.trim(),lyrics:$('#lyrics').value,privacy:$('#privacy').value,intro:$('#intro').value.trim(),outro:$('#outro').value.trim(),hashtags:$('#hashtags').value.split(/\s+/).filter(x=>x.startsWith('#')).slice(0,8)};save();return state.project}
function applyProject(){const p=state.project;$('#idea').value=p.idea||'';$('#language').value=p.language||'Hindi';$('#theme').value=p.theme||'naru-shadow';$('#aspect').value=p.aspect||'landscape';$('#title').value=p.title||'';$('#description').value=p.description||'';$('#lyrics').value=p.lyrics||'';$('#privacy').value=p.privacy||'private';$('#intro').value=p.intro||'';$('#outro').value=p.outro||'';$('#hashtags').value=(p.hashtags||[]).join(' ');updateLock()}
function updateLock(){const p=state.project,stale=p.metadataStale?' · refresh needed':'';$('#storyLock').textContent=p.story?`Locked story: ${p.story}${stale}`:`Song meaning will lock when Groq analyzes the audio${stale}.`;$('#storyLock').dataset.kind=p.metadataStale?'warn':'ok'}
function updateButtons(){const ready=!!state.result?.file;$('#downloadBtn').disabled=!ready;$('#shareBtn').disabled=!ready;$('#youtubePublish').disabled=!ready;$('#facebookPublish').disabled=!ready;const caps=publishingCapabilities(state.result?.file);$('#shareHint').textContent=ready?(caps.nativeShare?'Phone share ready for Instagram / Facebook / LinkedIn.':'Direct app sharing is not supported in this browser; download is available.'):'Render a video first.'}

async function updateMediaState(){const s=state.library.summary();$('#mediaState').textContent=s.items?`${s.items} media files · ${s.videos} video · ${s.images} image${s.persistent?' · folder linked':''}`:'No media folder linked · procedural templates still work';$('#folderState').textContent=s.persistent?`Folder permission: ${s.permission}`:(s.supportsPersistentFolder?'No persistent folder selected':'Use folder/file picker on this browser');const est=await storageSummary();$('#storageState').textContent=est.quota?`${bytes(est.usage)} / ${bytes(est.quota)} site storage`:'Storage ready'}
async function chooseFolder(){try{setStatus('Requesting read access to your selected media folder…');if(state.library.supportsPersistentFolder){await state.library.chooseFolder()}else{$('#folderFiles').click();return}await updateMediaState();setStatus('Media folder indexed. Files stay on your phone/storage and are loaded only when needed.','ok');refreshPreview()}catch(e){setStatus(e.message,'warn')}}
async function reconnectFolder(){try{await state.library.requestPermission();await state.library.scan();await updateMediaState();setStatus('Folder reconnected and re-indexed.','ok')}catch(e){setStatus(e.message,'warn')}}

async function loadSong(file){if(!file)return;if(state.songUrl)URL.revokeObjectURL(state.songUrl);state.song=file;state.songUrl=URL.createObjectURL(file);$('#audio').src=state.songUrl;$('#songName').textContent=`${file.name} · ${bytes(file.size)}`;if(!state.project.title)state.project.title=baseName(file.name);state.project.metadataStale=true;save();applyProject();state.result=null;updateButtons();setStatus('Song loaded. Press CREATE VIDEO.','ok');log(`Song loaded: ${file.name}`,'ok')}

function brain(){return new GroqSongBrain($('#groqKey').value.trim())}
async function analyzeSong(){
  const p=projectFromUI(),creds=readCredentials(),key=$('#groqKey').value.trim()||creds.groq||'';
  if(!key){const pack=fallbackPackage({filename:state.song?.name,language:p.language,lyrics:p.lyrics,idea:p.idea});applyPackage(pack);log('Groq key not set — used safe local metadata fallback.','warn');return pack}
  const g=new GroqSongBrain(key);let transcript='';
  try{setStatus(`Groq ${GROQ_AUDIO_MODEL} is listening to the song…`);const tr=await g.transcribe(state.song);transcript=tr.text||''}catch(e){log(`Audio transcription skipped: ${e.message}`,'warn');transcript=p.lyrics||''}
  try{setStatus(`Locking song meaning with ${GROQ_TEXT_MODEL}…`);const {lock,package:pack}=await g.analyzeSong({transcript,workingLyrics:p.lyrics,filename:state.song?.name,idea:p.idea,language:p.language});applyPackage({...pack,clean_lyrics:lock.clean_lyrics||pack.clean_lyrics,story:lock.story,hook_meaning:lock.hook_meaning});log('Groq locked one song story before creating metadata.','ok');return pack}catch(e){log(`Groq packaging failed: ${e.message}`,'warn');const pack=fallbackPackage({filename:state.song?.name,language:p.language,lyrics:p.lyrics,idea:p.idea});applyPackage(pack);return pack}
}
function applyPackage(pack){
  state.project={...state.project,title:pack.title||state.project.title,description:pack.description||state.project.description,hashtags:Array.isArray(pack.hashtags)?pack.hashtags:state.project.hashtags,tags:Array.isArray(pack.tags)?pack.tags:state.project.tags,lyrics:pack.clean_lyrics||state.project.lyrics,intro:pack.intro||state.project.intro,outro:pack.outro||state.project.outro,story:pack.story||state.project.story,hookMeaning:pack.hook_meaning||state.project.hookMeaning,metadataStale:false};
  if(pack.suggested_theme&&THEMES.some(t=>t.id===pack.suggested_theme))state.project.theme=pack.suggested_theme;save();applyProject();
}

async function refreshPreview(){
  if(!engine)return;projectFromUI();const q=engine.quality(state.project.aspect);$('#stage').width=q.w;$('#stage').height=q.h;engine.resetSequence(state.project);await new Promise(r=>setTimeout(r,80));engine.drawFrame(4,120,{low:.34,mid:.22,high:.16,energy:.27},state.project);$('#qualityState').textContent=`${q.w}×${q.h} · ${q.fps} fps safe mode`;
}
async function createVideo(){
  if(state.busy)return;if(!state.song){$('#songFile').click();setStatus('Choose a song first.','warn');return}
  state.busy=true;$('#createBtn').disabled=true;setProgress(0);
  try{
    await engine.prepareUserGesture();projectFromUI();await analyzeSong();setStatus('Preparing local media sequence…');engine.resetSequence(state.project);await refreshPreview();
    setStatus('Rendering safely to disk… keep this tab visible.');const result=await engine.render(state.song,state.project,{onProgress:p=>{setProgress(p);setStatus(`Rendering ${Math.round(p*100)}% · one scene decoded at a time`)}});state.result=result;setProgress(1);await makeThumbnail();updateButtons();setStatus(`Video ready · ${bytes(result.file.size)} · ${result.quality.w}×${result.quality.h}`,'ok');log('Create complete. Review, edit, download or publish.','ok');
  }catch(e){setStatus(e.message,'err');log(e.message,'err')}
  finally{state.busy=false;$('#createBtn').disabled=false}
}

async function preview(){if(!state.song){setStatus('Choose a song first.','warn');return}try{projectFromUI();const q=engine.quality(state.project.aspect);$('#stage').width=q.w;$('#stage').height=q.h;await engine.startPreview($('#audio'),state.project);setStatus('Preview playing.','ok')}catch(e){setStatus(e.message,'err')}}
function stopPreview(){engine.stopPreview();$('#audio').pause();setStatus('Preview stopped.','ok')}

async function makeThumbnail(){
  const p=state.project,theme=themeById(p.theme),c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d',{alpha:false});drawProcedural(x,1280,720,4,{low:.42,mid:.28,high:.18},theme);const g=x.createLinearGradient(0,720,0,220);g.addColorStop(0,'rgba(0,0,0,.88)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,180,1280,540);x.fillStyle='#fff';x.shadowColor='rgba(0,0,0,.9)';x.shadowBlur=30;x.font='900 82px system-ui';x.textAlign='left';let text=(p.title||'ORIGINAL MUSIC').toUpperCase();while(text.length>4&&x.measureText(text).width>1110)text=text.slice(0,-2);x.fillText(text,70,590);x.fillStyle=theme.palette[0];x.fillRect(72,646,220,8);x.font='800 22px system-ui';x.fillText('ORIGINAL MUSIC VIDEO',72,688);state.thumb=await new Promise(r=>c.toBlob(r,'image/jpeg',.93));if(state.thumbUrl)URL.revokeObjectURL(state.thumbUrl);state.thumbUrl=URL.createObjectURL(state.thumb);$('#thumb').src=state.thumbUrl;$('#thumb').hidden=false;$('#downloadThumb').disabled=false;return state.thumb;
}
function downloadFile(file,name=file?.name||'ridge-video'){if(!file)return;const u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000)}

async function connectYT(){try{const id=$('#youtubeClient').value.trim();await connectYouTube(id);state.ytConnected=true;$('#youtubeState').textContent='YouTube connected';setStatus('YouTube connected.','ok')}catch(e){setStatus(e.message,'err')}}
async function uploadYT(){if(!state.result?.file)return;try{projectFromUI();setStatus('Uploading to YouTube…');await publishYouTube(state.result.file,state.project,{clientId:$('#youtubeClient').value.trim(),onProgress:p=>setStatus(`YouTube upload ${Math.round(p*100)}%`)});setStatus('YouTube upload complete.','ok');log('Published to YouTube.','ok')}catch(e){setStatus(e.message,'err')}}
async function shareApps(){if(!state.result?.file)return;try{projectFromUI();await shareToApps(state.result.file,state.project);setStatus('Share sheet opened. Choose Instagram, Facebook or LinkedIn.','ok')}catch(e){setStatus(e.message,'warn')}}
async function uploadFacebook(){if(!state.result?.file)return;try{projectFromUI();setStatus('Publishing Facebook Page Reel…');await publishFacebookPageReel(state.result.file,state.project,{pageToken:$('#facebookToken').value.trim(),apiVersion:$('#metaVersion').value.trim()||'v25.0',onProgress:p=>setStatus(`Facebook ${Math.round(p*100)}%`)});setStatus('Facebook Page Reel published.','ok');log('Published to Facebook Page.','ok')}catch(e){setStatus(e.message,'err')}}

function bind(){
  $('#songFile').onchange=e=>loadSong(e.target.files?.[0]);$('#folderFiles').onchange=e=>{state.library.importFiles(e.target.files);updateMediaState();refreshPreview()};
  $('#chooseFolder').onclick=chooseFolder;$('#reconnectFolder').onclick=reconnectFolder;$('#rescanFolder').onclick=async()=>{try{await state.library.scan();await updateMediaState();setStatus('Folder scan refreshed.','ok')}catch(e){setStatus(e.message,'warn')}};$('#forgetFolder').onclick=async()=>{await state.library.forgetFolder();await updateMediaState();refreshPreview()};
  $('#createBtn').onclick=createVideo;$('#previewBtn').onclick=preview;$('#stopBtn').onclick=stopPreview;$('#downloadBtn').onclick=()=>downloadFile(state.result?.file);$('#downloadThumb').onclick=()=>downloadFile(state.thumb,`${baseName(state.project.title)}-thumbnail.jpg`);$('#makeThumb').onclick=()=>makeThumbnail().catch(e=>setStatus(e.message,'err'));
  $('#connectYoutube').onclick=connectYT;$('#youtubePublish').onclick=uploadYT;$('#shareBtn').onclick=shareApps;$('#facebookPublish').onclick=uploadFacebook;
  $('#testGroq').onclick=async()=>{try{setStatus('Testing Groq…');const ok=await brain().test();setStatus(ok?'Groq ready.':'Groq returned an unexpected response.',ok?'ok':'warn')}catch(e){setStatus(e.message,'err')}};
  $('#openSuno').onclick=()=>window.open('https://platform.suno.com/','_blank','noopener');
  for(const id of['idea','language','theme','aspect','title','description','hashtags','lyrics','privacy','intro','outro'])$('#'+id)?.addEventListener(['language','theme','aspect','privacy'].includes(id)?'change':'input',()=>{projectFromUI();if(['lyrics','idea','language'].includes(id)){state.project.metadataStale=true;save();updateLock()}if(['theme','aspect'].includes(id))refreshPreview()});
  const saveCred=(id,key)=>$('#'+id)?.addEventListener('input',e=>saveCredentials({[key]:e.target.value.trim()}));saveCred('groqKey','groq');saveCred('youtubeClient','youtubeClient');
  $('#editToggle').onclick=()=>{$('#editPanel').hidden=!$('#editPanel').hidden;$('#editToggle').textContent=$('#editPanel').hidden?'Edit release':'Hide editor'};
  $('#settingsToggle').onclick=()=>{$('#settingsPanel').hidden=!$('#settingsPanel').hidden};
}

async function init(){
  $('#theme').innerHTML=THEMES.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');applyProject();const creds=readCredentials();$('#groqKey').value=creds.groq||'';$('#youtubeClient').value=creds.youtubeClient||'';engine=new RenderEngine($('#stage'),state.library,{onState:x=>x?.message&&log(x.message,x.type||'warn')});
  await state.library.restore();await requestPersistentStorage();bind();await updateMediaState();await refreshPreview();updateButtons();
  if(!state.library.summary().items)$('#firstRun').hidden=false;setStatus('Ready. Add a song and press CREATE VIDEO.','ok');
}

window.addEventListener('beforeunload',()=>{engine?.close();if(state.songUrl)URL.revokeObjectURL(state.songUrl);if(state.thumbUrl)URL.revokeObjectURL(state.thumbUrl)});
init().catch(e=>{console.error(e);setStatus('Startup recovered: '+e.message,'err')});
