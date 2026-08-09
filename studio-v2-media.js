'use strict';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

class Vault{
  constructor(name='ridge-v2-vault',version=2){this.name=name;this.version=version;this._db=null;}
  async db(){
    if(this._db)return this._db;
    this._db=await new Promise((resolve,reject)=>{
      const q=indexedDB.open(this.name,this.version);
      q.onupgradeneeded=()=>{
        const d=q.result;
        if(!d.objectStoreNames.contains('assets'))d.createObjectStore('assets');
        if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');
      };
      q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
    });
    return this._db;
  }
  async _tx(store,mode,fn){
    const d=await this.db();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction(store,mode),os=tx.objectStore(store),req=fn(os);
      tx.oncomplete=()=>resolve(req&&'result'in req?req.result:req);tx.onerror=()=>reject(tx.error);
    });
  }
  putAsset=(id,blob)=>this._tx('assets','readwrite',s=>s.put(blob,id));
  getAsset=id=>this._tx('assets','readonly',s=>s.get(id));
  delAsset=id=>this._tx('assets','readwrite',s=>s.delete(id));
  putMeta=(id,v)=>this._tx('meta','readwrite',s=>s.put(v,id));
  getMeta=id=>this._tx('meta','readonly',s=>s.get(id));
  delMeta=id=>this._tx('meta','readwrite',s=>s.delete(id));
  keys=()=>this._tx('assets','readonly',s=>s.getAllKeys());
}

export const vault=new Vault();

export async function storageInfo(){
  let estimate={usage:0,quota:0},persisted=false;
  try{estimate=await navigator.storage?.estimate?.()||estimate;}catch{}
  try{persisted=await navigator.storage?.persisted?.()||false;}catch{}
  return {usage:Number(estimate.usage||0),quota:Number(estimate.quota||0),persisted};
}
export async function requestPersistentStorage(){
  try{return await navigator.storage?.persist?.()||false;}catch{return false;}
}
export const bytes=n=>{
  n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';if(n<1073741824)return (n/1048576).toFixed(1)+' MB';return (n/1073741824).toFixed(2)+' GB';
};

function canvasToBlob(canvas,type='image/jpeg',quality=.84){return new Promise(resolve=>canvas.toBlob(resolve,type,quality));}
async function imageHeaderSize(blob){
  try{
    const b=new Uint8Array(await blob.slice(0,Math.min(blob.size,524288)).arrayBuffer());
    if(b.length>=24&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47){
      const v=new DataView(b.buffer,b.byteOffset,b.byteLength);return {w:v.getUint32(16),h:v.getUint32(20)};
    }
    if(b.length>4&&b[0]===0xff&&b[1]===0xd8){
      let i=2;while(i+9<b.length){if(b[i]!==0xff){i++;continue;}const marker=b[i+1];if(marker===0xd8||marker===0xd9){i+=2;continue;}if(i+4>b.length)break;const len=(b[i+2]<<8)|b[i+3];if(len<2)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&i+8<b.length)return {h:(b[i+5]<<8)|b[i+6],w:(b[i+7]<<8)|b[i+8]};i+=2+len;}
    }
    if(b.length>=30&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'&&String.fromCharCode(...b.slice(12,16))==='VP8X'){
      const w=1+b[24]+(b[25]<<8)+(b[26]<<16),h=1+b[27]+(b[28]<<8)+(b[29]<<16);return {w,h};
    }
  }catch{}
  return null;
}
async function bitmapFromBlob(blob,{maxW=0,maxH=0}={}){
  if('createImageBitmap'in window){
    const sz=(maxW&&maxH)?await imageHeaderSize(blob):null;
    if(sz?.w&&sz?.h){const fit=fitSize(sz.w,sz.h,maxW,maxH);return createImageBitmap(blob,{imageOrientation:'from-image',resizeWidth:fit.w,resizeHeight:fit.h,resizeQuality:'high'});}
    return createImageBitmap(blob,{imageOrientation:'from-image'});
  }
  const url=URL.createObjectURL(blob),img=new Image();
  await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
  URL.revokeObjectURL(url);return img;
}
function closeBitmap(x){try{x?.close?.();}catch{}}
function fitSize(w,h,maxW,maxH){const r=Math.min(1,maxW/w,maxH/h);return {w:Math.max(2,Math.round(w*r)),h:Math.max(2,Math.round(h*r))};}

export async function optimizeImage(source,{maxW=1920,maxH=1080,quality=.84,thumbW=320,thumbH=180}={}){
  const bmp=await bitmapFromBlob(source,{maxW,maxH});
  try{
    const sw=bmp.width||bmp.naturalWidth,sh=bmp.height||bmp.naturalHeight,{w,h}=fitSize(sw,sh,maxW,maxH);
    const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{alpha:false});x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.fillStyle='#000';x.fillRect(0,0,w,h);x.drawImage(bmp,0,0,w,h);
    const blob=await canvasToBlob(c,'image/jpeg',quality);if(!blob)throw new Error('Image compression failed');
    const t=document.createElement('canvas');t.width=thumbW;t.height=thumbH;const tx=t.getContext('2d',{alpha:false}),r=Math.max(thumbW/w,thumbH/h),dw=w*r,dh=h*r;tx.fillStyle='#000';tx.fillRect(0,0,thumbW,thumbH);tx.drawImage(c,(thumbW-dw)/2,(thumbH-dh)/2,dw,dh);
    const thumb=await canvasToBlob(t,'image/jpeg',.72);
    c.width=c.height=t.width=t.height=1;
    return {blob,thumb,width:w,height:h,originalWidth:sw,originalHeight:sh};
  }finally{closeBitmap(bmp);}
}

function id(prefix='asset'){return `${prefix}-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;}

export class SceneManager{
  constructor({maxDecoded=3,onChange=null}={}){
    this.maxDecoded=maxDecoded;this.onChange=onChange;this.scenes=[];this.imageCache=new Map();this.videoCache=new Map();this.thumbUrls=new Map();this.pending=new Map();this.activeVideoIds=new Set();
  }
  async restore(meta=[]){
    this.scenes=(Array.isArray(meta)?meta:[]).filter(x=>x&&x.id&&x.kind);
    this.onChange?.(this.scenes);return this.scenes;
  }
  serialize(){return this.scenes.map(({id,thumbId,kind,name,size,width,height,duration,source})=>({id,thumbId,kind,name,size,width,height,duration,source}));}
  async addFiles(files,{maxImageW=1920,maxImageH=1080,onProgress}={}){
    const list=[...files].filter(Boolean),info=await storageInfo(),free=Math.max(0,(info.quota||Infinity)-(info.usage||0));
    const total=list.reduce((s,f)=>s+(f.size||0),0);if(Number.isFinite(free)&&free&&total>free*.88)throw new Error(`Not enough browser storage. Need about ${bytes(total)}, free ${bytes(free)}.`);
    let done=0;
    for(const f of list){
      if(f.type.startsWith('image/'))await this.addImageBlob(f,{name:f.name,maxImageW,maxImageH,source:'upload'});
      else if(f.type.startsWith('video/'))await this.addVideoBlob(f,{name:f.name,source:'upload'});
      done++;onProgress?.(done/list.length,f.name);await sleep(0);
    }
    this.onChange?.(this.scenes);return this.scenes;
  }
  async addImageBlob(blob,{name='scene.jpg',maxImageW=1920,maxImageH=1080,source='generated'}={}){
    const optimized=await optimizeImage(blob,{maxW:maxImageW,maxH:maxImageH});
    const sceneId=id('img'),thumbId=sceneId+':thumb';await vault.putAsset(sceneId,optimized.blob);await vault.putAsset(thumbId,optimized.thumb);
    this.scenes.push({id:sceneId,thumbId,kind:'image',name,size:optimized.blob.size,width:optimized.width,height:optimized.height,source});
    this.onChange?.(this.scenes);return this.scenes.at(-1);
  }
  async addVideoBlob(blob,{name='scene.mp4',source='generated'}={}){
    const sceneId=id('vid');await vault.putAsset(sceneId,blob);
    let duration=0,width=0,height=0,thumb=null;
    try{const url=URL.createObjectURL(blob),v=document.createElement('video');v.muted=true;v.preload='metadata';v.src=url;await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=rej;});duration=Number(v.duration)||0;width=v.videoWidth||0;height=v.videoHeight||0;try{v.currentTime=Math.min(duration*.2,.5);await new Promise(res=>{v.onseeked=res;setTimeout(res,1200);});const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d',{alpha:false}),r=Math.max(320/(width||320),180/(height||180)),dw=(width||320)*r,dh=(height||180)*r;x.drawImage(v,(320-dw)/2,(180-dh)/2,dw,dh);thumb=await canvasToBlob(c,'image/jpeg',.72);c.width=c.height=1;}catch{}v.removeAttribute('src');v.load();URL.revokeObjectURL(url);}catch{}
    const thumbId=sceneId+':thumb';if(thumb)await vault.putAsset(thumbId,thumb);
    this.scenes.push({id:sceneId,thumbId:thumb?thumbId:null,kind:'video',name,size:blob.size,width,height,duration,source});this.onChange?.(this.scenes);return this.scenes.at(-1);
  }
  async remove(index){const s=this.scenes[index];if(!s)return;this.evict(s.id);await vault.delAsset(s.id).catch(()=>{});if(s.thumbId)await vault.delAsset(s.thumbId).catch(()=>{});this.scenes.splice(index,1);const u=this.thumbUrls.get(s.id);if(u)URL.revokeObjectURL(u);this.thumbUrls.delete(s.id);this.onChange?.(this.scenes);}
  async clear(){for(let i=this.scenes.length-1;i>=0;i--)await this.remove(i);}
  evict(id){const im=this.imageCache.get(id);closeBitmap(im?.bitmap);this.imageCache.delete(id);const ve=this.videoCache.get(id);if(ve){try{ve.el.pause();ve.el.removeAttribute('src');ve.el.load();URL.revokeObjectURL(ve.url);}catch{}this.videoCache.delete(id);}}
  _trimImages(keep=[]){const allowed=new Set(keep);for(const [id,v]of [...this.imageCache])if(!allowed.has(id)&&this.imageCache.size>this.maxDecoded){closeBitmap(v.bitmap);this.imageCache.delete(id);}}
  async image(scene){
    if(!scene||scene.kind!=='image')return null;const cached=this.imageCache.get(scene.id);if(cached){cached.at=performance.now();return cached.bitmap;}if(this.pending.has(scene.id))return this.pending.get(scene.id);
    const job=(async()=>{const blob=await vault.getAsset(scene.id);if(!blob)return null;const bitmap=await bitmapFromBlob(blob);this.imageCache.set(scene.id,{bitmap,at:performance.now()});const ordered=[...this.imageCache.entries()].sort((a,b)=>b[1].at-a[1].at);for(const [rid,v]of ordered.slice(this.maxDecoded)){closeBitmap(v.bitmap);this.imageCache.delete(rid);}return bitmap;})().finally(()=>this.pending.delete(scene.id));this.pending.set(scene.id,job);return job;
  }
  async video(scene){
    if(!scene||scene.kind!=='video')return null;const cached=this.videoCache.get(scene.id);if(cached)return cached.el;if(this.pending.has(scene.id))return this.pending.get(scene.id);
    const job=(async()=>{const blob=await vault.getAsset(scene.id);if(!blob)return null;const url=URL.createObjectURL(blob),el=document.createElement('video');el.src=url;el.muted=true;el.loop=true;el.playsInline=true;el.preload='auto';await new Promise((res,rej)=>{let settled=false;const done=fn=>{if(settled)return;settled=true;fn();};el.onloadeddata=()=>done(res);el.onerror=()=>done(()=>rej(new Error('Video scene could not be decoded')));setTimeout(()=>done(res),5000);});this.videoCache.set(scene.id,{el,url,at:performance.now()});while(this.videoCache.size>2){const victim=[...this.videoCache.keys()].find(id=>id!==scene.id);if(!victim)break;this.evict(victim);}return el;})().finally(()=>this.pending.delete(scene.id));this.pending.set(scene.id,job);return job;
  }
  async thumbUrl(scene){
    if(!scene)return '';if(this.thumbUrls.has(scene.id))return this.thumbUrls.get(scene.id);let blob=scene.thumbId?await vault.getAsset(scene.thumbId):null;if(!blob&&scene.kind==='image')blob=await vault.getAsset(scene.id);if(!blob)return '';const url=URL.createObjectURL(blob);this.thumbUrls.set(scene.id,url);return url;
  }
  sceneAt(progress){if(!this.scenes.length)return {scene:null,next:null,index:-1,local:0};const n=this.scenes.length,p=clamp(progress,0,.999999),seg=1/n,index=Math.min(n-1,Math.floor(p/seg)),local=(p-index*seg)/seg;return {scene:this.scenes[index],next:this.scenes[Math.min(n-1,index+1)],index,local};}
  async prefetch(progress,{playVideo=false}={}){
    const {scene,next}=this.sceneAt(progress),jobs=[];if(scene?.kind==='image')jobs.push(this.image(scene));if(next?.kind==='image')jobs.push(this.image(next));if(scene?.kind==='video')jobs.push(this.video(scene).then(v=>{if(playVideo&&v?.paused)v.play().catch(()=>{});}));if(next?.kind==='video')jobs.push(this.video(next));await Promise.allSettled(jobs);
  }
  frame(progress){const x=this.sceneAt(progress);return {...x,currentImage:x.scene?.kind==='image'?this.imageCache.get(x.scene.id)?.bitmap:null,nextImage:x.next?.kind==='image'?this.imageCache.get(x.next.id)?.bitmap:null,currentVideo:x.scene?.kind==='video'?this.videoCache.get(x.scene.id)?.el:null,nextVideo:x.next?.kind==='video'?this.videoCache.get(x.next.id)?.el:null};}
  pauseVideos(){for(const {el}of this.videoCache.values())try{el.pause();}catch{}}
  close(){for(const id of [...this.imageCache.keys(),...this.videoCache.keys()])this.evict(id);for(const u of this.thumbUrls.values())URL.revokeObjectURL(u);this.thumbUrls.clear();}
}

export async function createOpfsWriter(filename){
  if(!navigator.storage?.getDirectory)return null;
  try{const root=await navigator.storage.getDirectory(),handle=await root.getFileHandle(filename,{create:true}),writable=await handle.createWritable();return {root,handle,writable,filename};}catch{return null;}
}
export async function finishOpfsWriter(target){if(!target)return null;await target.writable.close();return target.handle.getFile();}
export async function removeOpfsFile(filename){if(!filename||!navigator.storage?.getDirectory)return;try{const root=await navigator.storage.getDirectory();await root.removeEntry(filename);}catch{}}

export {sleep,clamp};
