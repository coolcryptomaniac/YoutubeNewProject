'use strict';
import {COMBO_PRESETS,getCombo,comboPrompt,languageCompliance} from './studio-v2-prompts.js';
import {recordLearning,learningStats,preferredCombo,resetLearning} from './studio-v2-learning.js';
import {addFilesToBank,addToBank,listBank,fileFromBank,matchingBank,bankStats,clearBank,formatBankBytes} from './studio-v2-bank.js';
import {SceneManager} from './studio-v2-media.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const CANON='ridge.release.package.v1';
let bankReplay=false,bankingInsideAddFiles=false,lastRenderMark='',lastUploadMark='';
const fire=(el,type='input')=>el?.dispatchEvent(new Event(type,{bubbles:true}));
const set=(id,value,type='change')=>{const e=$('#'+id);if(!e||value==null)return;if(e.tagName==='SELECT'&&![...e.options].some(o=>o.value===value))return;e.value=value;fire(e,type)};
const tagsNow=()=>[$('#pexelsSearch')?.value,$('#theme')?.value,$('#editStyle')?.value,$('#language')?.value,...String($('#idea')?.value||'').toLowerCase().split(/\W+/).filter(x=>x.length>3).slice(0,6)].filter(Boolean);

function log(msg,kind=''){const box=$('#log');if(!box)return;const d=document.createElement('div');d.className=kind;d.textContent=`${new Date().toLocaleTimeString()}  V2.6 · ${msg}`;box.prepend(d)}
function saveCanonical(){
  const q=id=>$('#'+id)?.value||'';
  const pack={version:1,updatedAt:new Date().toISOString(),idea:q('idea'),language:q('language'),title:q('title'),lyrics:q('lyrics'),description:q('description'),hashtags:q('hashtags'),thumbHeadline:q('thumbHeadline'),introText:q('introText'),outroText:q('outroText'),sunoPrompt:q('sunoPrompt'),theme:q('theme'),editStyle:q('editStyle'),visualizer:q('visualizer'),lyricStyle:q('lyricStyle')};
  try{localStorage.setItem(CANON,JSON.stringify(pack))}catch{}return pack;
}
function restoreCanonical(){
  let p={};try{p=JSON.parse(localStorage.getItem(CANON)||'{}')}catch{}
  for(const id of['idea','title','lyrics','description','hashtags','thumbHeadline','introText','outroText','sunoPrompt'])if($('#'+id)&&!$('#'+id).value&&p[id])$('#'+id).value=p[id];
  $('#canonicalState').textContent=p.updatedAt?'Canonical song package restored.':'Canonical song package ready.';
}

function applyCombo(id,{overwriteIdea=true}={}){
  const c=getCombo(id);set('comboPreset',c.id);set('language',c.language);set('theme',c.theme);set('editStyle',c.edit);set('visualizer',c.visualizer);set('lyricStyle',c.lyricStyle);set('cardStyle',c.card);set('thumbStyle',c.thumb);
  if(overwriteIdea||!$('#idea').value.trim()){set('idea',c.idea,'input')}
  set('sunoPrompt',c.music,'input');
  const q=c.idea.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>4).slice(0,5).join(' ');if(q)set('pexelsSearch',q,'input');
  saveCanonical();$('#comboState').textContent=`Loaded: ${c.name}`;log(`Combo loaded: ${c.name}`,'ok');return c
}
async function applyLearned(){const c=preferredCombo(COMBO_PRESETS,$('#language').value)||COMBO_PRESETS[0];applyCombo(c.id);$('#comboState').textContent=`Learning chose: ${c.name}`}

function checkLanguage(){const e=$('#languageCheck');if(!e)return;const r=languageCompliance($('#lyrics').value,$('#language').value);e.textContent=r.ok?'Language/script check looks consistent.':r.warning;e.dataset.kind=r.ok?'ok':'warn'}

function patchSceneBank(){
  const proto=SceneManager.prototype;if(proto.__ridgeBankPatched)return;proto.__ridgeBankPatched=true;
  const addFiles=proto.addFiles,addImage=proto.addImageBlob,addVideo=proto.addVideoBlob;
  proto.addFiles=async function(files,opts={}){const list=[...files||[]];if(!bankReplay&&list.length)await addFilesToBank(list,{tags:tagsNow(),source:'download/import'}).catch(e=>log('Media bank: '+e.message,'warn'));bankingInsideAddFiles=true;try{return await addFiles.call(this,list,opts)}finally{bankingInsideAddFiles=false;renderBank()}};
  proto.addImageBlob=async function(blob,opts={}){if(!bankReplay&&!bankingInsideAddFiles&&blob?.size)await addToBank(blob,{name:opts.name||'generated-image.jpg',tags:tagsNow(),source:opts.source||'generated'}).catch(()=>{});const r=await addImage.call(this,blob,opts);renderBank();return r};
  proto.addVideoBlob=async function(blob,opts={}){if(!bankReplay&&!bankingInsideAddFiles&&blob?.size)await addToBank(blob,{name:opts.name||'generated-video.mp4',tags:tagsNow(),source:opts.source||'generated'}).catch(()=>{});const r=await addVideo.call(this,blob,opts);renderBank();return r};
}

async function injectFiles(files){if(!files.length)return;const input=$('#mediaFiles'),dt=new DataTransfer();for(const f of files)dt.items.add(f);bankReplay=true;input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>bankReplay=false,1500)}
async function useMatchingBank(){const assets=await matchingBank(tagsNow(),8),files=[];for(const a of assets){const f=await fileFromBank(a.id);if(f)files.push(f)}if(!files.length){$('#bankState').textContent='No matching saved media yet. Download/import a few Pexels clips first.';return}await injectFiles(files);$('#bankState').textContent=`Added ${files.length} matching saved assets to this edit.`;log(`Reused ${files.length} on-device media-bank assets.`,'ok')}
async function renderBank(){
  const box=$('#mediaBank');if(!box)return;const [stats,items]=await Promise.all([bankStats(),listBank({limit:18})]);$('#bankState').textContent=`${stats.items} saved · ${stats.videos} video · ${stats.images} image · ${formatBankBytes(stats.bytes)}`;box.innerHTML='';
  for(const a of items){const b=document.createElement('button');b.className='bank-item';b.dataset.bankId=a.id;b.title=(a.tags||[]).join(', ');b.innerHTML=`<b>${a.type.startsWith('video/')?'▶':'▧'}</b><span>${a.name.slice(0,28)}</span>`;b.onclick=async()=>{const f=await fileFromBank(a.id);if(f)await injectFiles([f])};box.appendChild(b)}
}

function updateLearningState(){const s=learningStats();$('#learningState').textContent=`Local learning: ${s.liked} liked · ${s.disliked} needs-work · ${s.renders} renders`}
function feedback(score){recordLearning('feedback',score,{canonical:saveCanonical()});updateLearningState();$('#learningState').textContent+=(score>0?' · learned from this result':' · marked for prompt/style correction');log(score>0?'Result saved as a positive example.':'Result marked as needs work.','ok')}
function observeOutcomes(){
  const watch=(id,kind,score,needle)=>{const e=$('#'+id);if(!e)return;new MutationObserver(()=>{const t=e.textContent||'';if(!needle.test(t))return;const key=kind+'|'+t;if(kind==='render'&&key!==lastRenderMark){lastRenderMark=key;recordLearning(kind,score,{canonical:saveCanonical()});updateLearningState()}if(kind==='upload'&&key!==lastUploadMark){lastUploadMark=key;recordLearning(kind,score,{canonical:saveCanonical()});updateLearningState()}}).observe(e,{childList:true,subtree:true,characterData:true})};
  watch('renderStatus','render',.25,/Rendered|ready to download/i);watch('uploadStatus','upload',.75,/Uploaded:|youtu\.be/i)
}

function bindCanonical(){for(const id of['idea','language','title','lyrics','description','hashtags','thumbHeadline','introText','outroText','sunoPrompt','theme','editStyle','visualizer','lyricStyle'])$('#'+id)?.addEventListener(id==='language'||$('#'+id)?.tagName==='SELECT'?'change':'input',()=>{saveCanonical();if(id==='lyrics'||id==='language')checkLanguage()});setInterval(saveCanonical,2500)}

async function init(){
  if(!$('#comboPreset'))return;patchSceneBank();restoreCanonical();
  $('#comboPreset').innerHTML=COMBO_PRESETS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const remembered=localStorage.getItem('ridge.combo.last');if(remembered&&COMBO_PRESETS.some(c=>c.id===remembered))$('#comboPreset').value=remembered;
  $('#applyCombo').onclick=()=>{const id=$('#comboPreset').value;localStorage.setItem('ridge.combo.last',id);applyCombo(id)};
  $('#comboAuto').onclick=()=>{const id=$('#comboPreset').value;localStorage.setItem('ridge.combo.last',id);applyCombo(id);setTimeout(()=>$('#fullAuto')?.click(),100)};
  $('#learnedCombo').onclick=applyLearned;
  $('#loveResult').onclick=()=>feedback(1);$('#needsWork').onclick=()=>feedback(-1);$('#resetLearning').onclick=()=>{if(confirm('Reset only Ridge local learning history? Your provider keys and media bank stay untouched.')){resetLearning();updateLearningState()}};
  $('#useBank').onclick=useMatchingBank;$('#refreshBank').onclick=renderBank;$('#clearMediaBank').onclick=async()=>{if(confirm('Clear the reusable media bank on this browser? Current project scenes are not removed.')){await clearBank();renderBank()}};
  $('#mediaFiles')?.addEventListener('change',()=>setTimeout(renderBank,600));
  $('#generateLyrics')?.addEventListener('click',()=>setTimeout(()=>{checkLanguage();saveCanonical()},1800));$('#analyze')?.addEventListener('click',()=>setTimeout(()=>{checkLanguage();saveCanonical()},2200));
  bindCanonical();observeOutcomes();checkLanguage();updateLearningState();await renderBank();
  const stats=learningStats();if(stats.liked>1){const c=preferredCombo(COMBO_PRESETS,$('#language').value);if(c)$('#comboState').textContent=`Learned preference available: ${c.name}`}
  log('V2.6 combo engine + adaptive prompt memory + on-device media bank ready.','ok')
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120),{once:true});else setTimeout(init,120);

export {applyCombo,saveCanonical,CANON};