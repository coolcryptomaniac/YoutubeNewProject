'use strict';
const DB='ridge-media-bank-v1',STORE='assets';let dbp=null;
function db(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id'});s.createIndex('createdAt','createdAt');s.createIndex('type','type')}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return dbp}
function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function allItems(){const d=await db(),tx=d.transaction(STORE,'readonly');return req(tx.objectStore(STORE).getAll())}
async function put(item){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function delMany(ids){if(!ids.length)return;const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(STORE,'readwrite'),s=tx.objectStore(STORE);for(const id of ids)s.delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
const uid=()=>crypto.randomUUID?.()||`bank-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cleanTags=tags=>[...new Set((Array.isArray(tags)?tags:String(tags||'').split(',')).map(x=>String(x).trim().toLowerCase()).filter(Boolean))].slice(0,16);
async function trim({maxItems=48,maxBytes=320*1024*1024}={}){const all=await allItems();if(all.length<=maxItems&&all.reduce((a,x)=>a+(x.size||0),0)<=maxBytes)return;all.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));let bytes=all.reduce((a,x)=>a+(x.size||0),0),count=all.length;const remove=[];for(const x of all){if(count<=maxItems&&bytes<=maxBytes)break;remove.push(x.id);bytes-=x.size||0;count--}await delMany(remove)}
export async function addToBank(blob,{name='media',tags=[],source='import'}={}){if(!blob?.size||blob.size>80*1024*1024)return null;const item={id:uid(),name:String(name||'media'),type:blob.type||'application/octet-stream',size:blob.size,tags:cleanTags(tags),source,createdAt:new Date().toISOString(),blob};await put(item);await trim();return item}
export async function addFilesToBank(files,{tags=[],source='import'}={}){const out=[];for(const f of [...files||[]].slice(0,8))if(/^(image|video)\//.test(f.type||'')){const x=await addToBank(f,{name:f.name,tags,source});if(x)out.push(x)}return out}
export async function listBank({limit=40,type=''}={}){const all=await allItems();return all.filter(x=>!type||x.type.startsWith(type)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,limit).map(({blob,...meta})=>meta)}
export async function getBankAsset(id){const d=await db();return req(d.transaction(STORE,'readonly').objectStore(STORE).get(id))}
export async function removeBankAsset(id){await delMany([id])}
export async function clearBank(){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
export async function bankStats(){const all=await allItems();return{items:all.length,bytes:all.reduce((a,x)=>a+(x.size||0),0),videos:all.filter(x=>x.type.startsWith('video/')).length,images:all.filter(x=>x.type.startsWith('image/')).length}}
export async function matchingBank(tags=[],limit=8){const terms=cleanTags(tags),all=await allItems();return all.map(x=>({x,score:terms.reduce((s,t)=>s+((x.tags||[]).some(v=>v.includes(t)||t.includes(v))?1:0),0)})).sort((a,b)=>b.score-a.score||new Date(b.x.createdAt)-new Date(a.x.createdAt)).slice(0,limit).map(({x})=>x)}
export async function fileFromBank(id){const x=await getBankAsset(id);if(!x)return null;return new File([x.blob],x.name,{type:x.type,lastModified:Date.now()})}
export function formatBankBytes(n=0){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;if(n<1073741824)return `${(n/1048576).toFixed(1)} MB`;return `${(n/1073741824).toFixed(2)} GB`}
export const MEDIA_BANK_DB=DB;
