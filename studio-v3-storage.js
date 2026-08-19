'use strict';

import {mediaMatchScore} from './studio-v3-story.js';

const DB_NAME='ridge-v3-local';
const DB_VERSION=1;
const STORE='kv';
export const CREDENTIAL_KEY='ridge.credentials.v1';
export const PROJECT_KEY='ridge.project.v3';
export const DEFAULT_RIDGE_CLOUD_URL='https://ridge-cloud-media.founder-f53.workers.dev';
export const PUBLIC_DEFAULTS={youtubeClient:''};
let dbPromise=null;

function db(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
async function get(key){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function put(key,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error)})}
async function del(key){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}

export function readCredentials(){try{return {...PUBLIC_DEFAULTS,...(JSON.parse(localStorage.getItem(CREDENTIAL_KEY)||'{}')||{})}}catch{return {...PUBLIC_DEFAULTS}}}
export function saveCredentials(partial={}){const old=readCredentials(),next={...old,...partial,version:1,updatedAt:new Date().toISOString()};localStorage.setItem(CREDENTIAL_KEY,JSON.stringify(next));return next}
export function loadProject(fallback={}){try{const saved=JSON.parse(localStorage.getItem(PROJECT_KEY)||'{}');return {...fallback,cloudUrl:DEFAULT_RIDGE_CLOUD_URL,...saved,cloudUrl:saved?.cloudUrl||fallback?.cloudUrl||DEFAULT_RIDGE_CLOUD_URL}}catch{return {...fallback,cloudUrl:fallback?.cloudUrl||DEFAULT_RIDGE_CLOUD_URL}}}
export function saveProject(project){try{localStorage.setItem(PROJECT_KEY,JSON.stringify({...project,updatedAt:new Date().toISOString()}))}catch{}return project}

async function permission(handle,request=false){if(!handle)return 'denied';if(!handle.queryPermission)return 'granted';try{let state=await handle.queryPermission({mode:'read'});if(state==='prompt'&&request&&handle.requestPermission)state=await handle.requestPermission({mode:'read'});return state}catch{return 'prompt'}}
const mediaType=file=>file.type.startsWith('video/')?'video':file.type.startsWith('image/')?'image':'';
const safeExt=name=>/\.(jpe?g|png|webp|gif|avif|mp4|mov|m4v|webm|mkv)$/i.test(name||'');
const stableTie=(a,b,seed='ridge')=>{let h=2166136261;for(const c of `${seed}|${a.id}|${b.id}`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return (h&1)?1:-1};

export class MediaLibrary{
  constructor(){this.root=null;this.items=[];this.sessionFiles=new Map();this.permission='unknown';this.lastScan=0}
  get supportsPersistentFolder(){return typeof window!=='undefined'&&'showDirectoryPicker'in window}
  async restore(){try{this.root=await get('media-root')||null}catch{this.root=null}try{this.items=(await get('media-index')||[]).filter(x=>x.source==='folder')}catch{this.items=[]}this.permission=this.root?await permission(this.root,false):'none';return this.summary()}
  async chooseFolder(){if(!this.supportsPersistentFolder)throw new Error('Persistent folder access is not supported in this browser. Use “Choose files/folder” instead.');const root=await window.showDirectoryPicker({id:'ridge-media',mode:'read',startIn:'pictures'});const state=await permission(root,true);if(state!=='granted')throw new Error('Read permission was not granted for the selected folder.');this.root=root;this.permission=state;try{await put('media-root',root)}catch{}await this.scan();return this.summary()}
  async requestPermission(){if(!this.root)throw new Error('Choose a media folder first.');this.permission=await permission(this.root,true);if(this.permission!=='granted')throw new Error('Folder read permission is still not granted.');return this.permission}
  async scan({maxFiles=500,maxDepth=5}={}){
    if(!this.root)throw new Error('Choose a media folder first.');const state=await permission(this.root,true);if(state!=='granted')throw new Error('Folder permission is required to scan media.');const out=[];
    const walk=async(dir,parts=[],depth=0)=>{if(depth>maxDepth||out.length>=maxFiles)return;for await(const [name,handle] of dir.entries()){if(out.length>=maxFiles)break;if(handle.kind==='directory'){if(!name.startsWith('.'))await walk(handle,[...parts,name],depth+1);continue}if(!safeExt(name))continue;try{const f=await handle.getFile(),kind=mediaType(f);if(!kind)continue;out.push({id:'disk:'+([...parts,name].join('/')),path:[...parts,name],name:f.name,size:f.size,type:f.type,kind,lastModified:f.lastModified,source:'folder'})}catch{}}};
    await walk(this.root,[],0);const transient=this.items.filter(x=>x.source!=='folder');this.items=[...out,...transient];this.lastScan=Date.now();try{await put('media-index',out);await put('media-last-scan',this.lastScan)}catch{}return out
  }
  importFiles(files=[]){for(const f of [...files]){const kind=mediaType(f);if(!kind)continue;const id='session:'+crypto.randomUUID();this.sessionFiles.set(id,f);this.items.push({id,path:null,name:f.name,size:f.size,type:f.type,kind,lastModified:f.lastModified,source:'session'})}return this.summary()}
  addRemote(items=[]){const old=new Set(this.items.map(x=>x.id));for(const x of items){if(!x?.id||!x?.remoteUrl||old.has(x.id))continue;this.items.push({...x,source:'remote'});old.add(x.id)}return this.summary()}
  clearRemote(){this.items=this.items.filter(x=>x.source!=='remote');return this.summary()}
  async open(item){if(!item)throw new Error('Media item is missing.');if(item.source==='session'){const f=this.sessionFiles.get(item.id);if(!f)throw new Error('This temporary file must be selected again.');return f}if(item.source==='remote'){if(item.kind==='video')throw new Error('Remote videos are streamed directly.');const r=await fetch(item.remoteUrl);if(!r.ok)throw new Error(`Remote media ${r.status}`);const b=await r.blob();return new File([b],item.name||'cloud-image',{type:b.type||item.type||'image/jpeg'})}if(!this.root||!item.path?.length)throw new Error('Reconnect the selected media folder.');const state=await permission(this.root,false);if(state!=='granted')throw new Error('Folder permission expired. Tap “Reconnect folder”.');let dir=this.root;for(const part of item.path.slice(0,-1))dir=await dir.getDirectoryHandle(part);const h=await dir.getFileHandle(item.path.at(-1));return h.getFile()}
  chooseSequence(count=12,seed='ridge'){if(!this.items.length)return [];let x=2166136261;for(const c of String(seed))x=Math.imul(x^c.charCodeAt(0),16777619)>>>0;const arr=[...this.items];for(let i=arr.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)>>>0;const j=x%(i+1);[arr[i],arr[j]]=[arr[j],arr[i]]}return arr.slice(0,Math.min(count,arr.length))}
  chooseForScene(scene,{excludeId='',seed='ridge'}={}){if(!this.items.length)return null;const ranked=this.items.map(item=>({item,score:mediaMatchScore(item,scene)+(item.id===excludeId?-3:0)})).sort((a,b)=>b.score-a.score||stableTie(a.item,b.item,`${seed}|${scene?.id||''}`));return ranked[0]?.item||null}
  summary(){const videos=this.items.filter(x=>x.kind==='video').length,images=this.items.length-videos,remote=this.items.filter(x=>x.source==='remote').length;return {items:this.items.length,videos,images,remote,persistent:!!this.root,permission:this.permission,supportsPersistentFolder:this.supportsPersistentFolder}}
  async forgetFolder(){this.root=null;this.permission='none';this.items=this.items.filter(x=>x.source!=='folder');try{await del('media-root');await del('media-index')}catch{}return this.summary()}
}

export async function storageSummary(){let estimate={usage:0,quota:0},persisted=false;try{estimate=await navigator.storage?.estimate?.()||estimate}catch{}try{persisted=await navigator.storage?.persisted?.()||false}catch{}return {usage:Number(estimate.usage||0),quota:Number(estimate.quota||0),persisted}}
export async function requestPersistentStorage(){try{return await navigator.storage?.persist?.()||false}catch{return false}}
export function bytes(n=0){n=Number(n)||0;if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;if(n<1073741824)return `${(n/1048576).toFixed(1)} MB`;return `${(n/1073741824).toFixed(2)} GB`}
