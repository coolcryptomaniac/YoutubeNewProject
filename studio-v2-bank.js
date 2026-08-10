'use strict';

const DB='ridge-media-bank-v1',STORE='assets',META='ridge.media.bank.meta.v1';
let dbp=null;
function db(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id'});s.createIndex('createdAt','createdAt');s.createIndex('type','type')}};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return dbp}
function tx(mode='readonly'){return db().then(d=>d.transaction(STORE,mode).objectStore(STORE))}
function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const uid=()=>crypto.randomUUID?.()||`bank-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cleanTags=tags=>[...new Set((Array.isArray(tags)?tags:String(tags||'').split(',')).map(x=>String(x).trim().toLowerCase()).filter(Boolean))].slice(0,20);

async function trim(maxItems=120){
  const s=await tx('readwrite'),all=await req(s.getAll());if(all.length<=maxItems)return;
  all.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));for(const x of all.slice(0,all.length-maxItems))s.delete(x.id)
}
export async function addToBank(blob,{name='media',tags=[],source='import'}={}){
  if(!blob?.size)return null;const item={id:uid(),name:String(name||'media'),type:blob.type||'application/octet-stream',size:blob.size,tags:cleanTags(tags),source,createdAt:new Date().toISOString(),blob};const s=await tx('readwrite');await req(s.put(item));await trim();return item
}
export async function addFilesToBank(files,{tags=[],source='import'}={}){const out=[];for(const f of [...files||[]])if(/^(image|video)\//.test(f.type||''))out.push(await addToBank(f,{name:f.name,tags,source}));return out}
export async function listBank({limit=60,type=''}={}){const s=await tx(),all=await req(s.getAll());return all.filter(x=>!type||x.type.startsWith(type)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,limit).map(({blob,...meta})=>meta)}
export async function getBankAsset(id){const x=await req((await tx()).get(id));return x||null}
export async function removeBankAsset(id){await req((await tx('readwrite')).delete(id))}
export async function clearBank(){await req((await tx('readwrite')).clear())}
export async function bankStats(){const all=await req((await tx()).getAll());return {items:all.length,bytes:all.reduce((a,x)=>a+(x.size||0),0),videos:all.filter(x=>x.type.startsWith('video/')).length,images:all.filter(x=>x.type.startsWith('image/')).length}}
export async function matchingBank(tags=[],limit=12){const terms=cleanTags(tags),all=await req((await tx()).getAll());return all.map(x=>({x,score:terms.reduce((s,t)=>s+(x.tags||[]).some(v=>v.includes(t)||t.includes(v))?1:0)})).sort((a,b)=>b.score-a.score||new Date(b.x.createdAt)-new Date(a.x.createdAt)).slice(0,limit).map(({x})=>x)}
export async function fileFromBank(id){const x=await getBankAsset(id);if(!x)return null;return new File([x.blob],x.name,{type:x.type,lastModified:Date.now()})}
export function formatBankBytes(n=0){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;if(n<1073741824)return `${(n/1048576).toFixed(1)} MB`;return `${(n/1073741824).toFixed(2)} GB`}
export const MEDIA_BANK_DB=DB;