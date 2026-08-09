'use strict';

const STABLE_KEY='ridge.credentials.v1';
const $=s=>document.querySelector(s);

function parseStored(v){
  if(v==null)return '';
  try{const x=JSON.parse(v);return typeof x==='string'?x:v}catch{return v}
}
function first(storage,keys=[]){
  for(const k of keys){try{const v=parseStored(storage.getItem(k));if(v)return String(v)}catch{}}
  return '';
}
function readStable(){try{return JSON.parse(localStorage.getItem(STABLE_KEY)||'{}')||{}}catch{return {}}}
function writeStable(next){
  const clean={version:1,groq:String(next.groq||''),pollinations:String(next.pollinations||''),youtubeClient:String(next.youtubeClient||''),pexelsLegacy:String(next.pexelsLegacy||''),updatedAt:new Date().toISOString()};
  localStorage.setItem(STABLE_KEY,JSON.stringify(clean));return clean;
}

export function migrateCredentials(){
  const old=readStable();
  const currentGroq=first(sessionStorage,['ridge.v25.groq']);
  const currentPollinations=first(localStorage,['ridge.v25.pollinationsKey']);
  const currentYoutube=first(localStorage,['ridge.v25.youtubeClient']);
  const migrated={
    groq:currentGroq||old.groq||first(sessionStorage,['ridge.v2.simple.groq','ridge.v2.plus.groq'])||first(localStorage,['ridge.v25.groqKey','ridge.v2.groqKey','ridge.groqKey']),
    pollinations:currentPollinations||old.pollinations||first(localStorage,['ridge.v2.pollinationsKey','ridge.pollinationsKey']),
    youtubeClient:currentYoutube||old.youtubeClient||first(localStorage,['ridge.v2.googleClientId','ridge.v2.youtubeClient','ridge.googleClientId']),
    pexelsLegacy:old.pexelsLegacy||first(sessionStorage,['ridge.v2.simple.pexels','ridge.v2.plus.pexels'])||first(localStorage,['ridge.v2.pexelsKey','ridge.pexelsKey'])
  };
  return writeStable(migrated);
}

export function saveCredentials(partial={}){return writeStable({...readStable(),...partial})}
export function applyCredentials(c=readStable()){
  const map={groq:'#groqKey',pollinations:'#pollinationsKey',youtubeClient:'#youtubeClient'};
  for(const [k,sel] of Object.entries(map)){const el=$(sel);if(el&&c[k])el.value=c[k]}
  return c;
}

function bytesToB64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
function b64ToBytes(s){const raw=atob(s),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function derive(pass,salt){const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:180000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function encryptedBackup(passphrase){
  if(!passphrase)throw new Error('Backup passphrase is required.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await derive(passphrase,salt);
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(readStable())));
  return JSON.stringify({format:'ridge-credentials-1',salt:bytesToB64(salt),iv:bytesToB64(iv),data:bytesToB64(new Uint8Array(data))},null,2);
}
export async function restoreEncrypted(text,passphrase){
  const box=JSON.parse(text);if(box.format!=='ridge-credentials-1')throw new Error('Not a Ridge credential backup.');
  const key=await derive(passphrase,b64ToBytes(box.salt)),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(box.iv)},key,b64ToBytes(box.data));
  return writeStable(JSON.parse(new TextDecoder().decode(plain)));
}

function flash(msg,kind='ok'){const e=$('#credentialState');if(e){e.textContent=msg;e.dataset.kind=kind}}
function downloadText(text,name){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}

async function init(){
  const c=migrateCredentials();applyCredentials(c);
  flash(`Saved on this device${c.groq?' · Groq':''}${c.pollinations?' · Pollinations':''}${c.youtubeClient?' · YouTube':''}${c.pexelsLegacy?' · legacy Pexels':''}.`);
  const bind=(id,key)=>$(id)?.addEventListener('input',e=>{saveCredentials({[key]:e.target.value.trim()});flash('Credentials saved locally for future V2 builds.')});
  bind('#groqKey','groq');bind('#pollinationsKey','pollinations');bind('#youtubeClient','youtubeClient');
  $('#backupCredentials')?.addEventListener('click',async()=>{try{const pass=prompt('Choose a passphrase for the encrypted settings backup:');if(!pass)return;downloadText(await encryptedBackup(pass),`ridge-v2-settings-${new Date().toISOString().slice(0,10)}.json`);flash('Encrypted settings backup downloaded.')}catch(e){flash(e.message,'err')}});
  $('#restoreCredentials')?.addEventListener('click',()=>$('#credentialFile')?.click());
  $('#credentialFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const pass=prompt('Enter the backup passphrase:');if(!pass)return;const restored=await restoreEncrypted(await file.text(),pass);applyCredentials(restored);flash('Settings restored and saved on this device.')}catch(err){flash('Restore failed: '+err.message,'err')}finally{e.target.value=''}});
  $('#forgetCredentials')?.addEventListener('click',()=>{if(!confirm('Forget saved provider credentials on this browser?'))return;localStorage.removeItem(STABLE_KEY);for(const id of['groqKey','pollinationsKey','youtubeClient'])if($(id))$(id).value='';flash('Saved credentials removed.','warn')});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,50),{once:true});else setTimeout(init,50);
export const CREDENTIAL_STORAGE_KEY=STABLE_KEY;
