'use strict';

import {themeById,buildLyricCues,drawProcedural,drawVisualizer,drawLyrics,drawIntroOutro} from './studio-v3-themes.js';
import {sceneAtTime} from './studio-v3-story.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const unit=v=>Math.max(0,Math.min(1,finite(v,0)));
const MB=1024*1024;
const AC=()=>{const C=window.AudioContext||window.webkitAudioContext;if(!C)throw new Error('Web Audio is not supported in this browser.');return new C()};
const isMobile=()=>/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')||innerWidth<700;

function memorySnapshot(){
  const mem=performance?.memory;
  const used=finite(mem?.usedJSHeapSize,0),limit=finite(mem?.jsHeapSizeLimit,0);
  return {used,limit,ratio:limit?used/limit:0,deviceGB:finite(navigator.deviceMemory,4),cores:finite(navigator.hardwareConcurrency,4)};
}
function underMemoryPressure(){const m=memorySnapshot();return (m.limit&&m.ratio>=.64)||m.deviceGB<=3||m.cores<=2}
function bands(freq){if(!freq?.length)return {low:.12,mid:.1,high:.08,energy:.1};const avg=(a,b)=>{const s=Math.max(0,Math.floor(a)),e=Math.min(freq.length,Math.max(s+1,Math.ceil(b)));let n=0,sum=0;for(let i=s;i<e;i++){sum+=finite(freq[i],0)/255;n++}return unit(n?sum/n:0)};const low=avg(1,freq.length*.08),mid=avg(freq.length*.08,freq.length*.34),high=avg(freq.length*.34,freq.length*.82);return {low,mid,high,energy:unit(low*.48+mid*.34+high*.18)}}

async function cleanupRidgeStorage(){
  try{
    if('caches' in self){for(const name of await caches.keys())if(/^ridge-(?:render|temp|preview)-/i.test(name))await caches.delete(name)}
  }catch{}
  try{
    if(!navigator.storage?.getDirectory)return;
    const root=await navigator.storage.getDirectory(),items=[];
    for await(const [name,handle] of root.entries())if(handle.kind==='file'&&/^ridge-.*\.(?:webm|mp4)$/i.test(name))items.push({name,handle});
    if(items.length<=2)return;
    const dated=[];for(const x of items){let t=0;try{t=(await x.handle.getFile()).lastModified||0}catch{}dated.push({...x,t})}
    dated.sort((a,b)=>b.t-a.t);for(const x of dated.slice(2))try{await root.removeEntry(x.name)}catch{}
  }catch{}
}

class BeatGate{constructor(){this.avg=.12;this.last=-99;this.count=0;this.fx=null;this.fxUntil=0}update(b,time,theme){const t=finite(time,0),low=unit(b.low);this.avg=this.avg*.94+low*.06;const threshold=Math.max(.34,this.avg*1.32+.06),cooldown=Math.max(.30,theme.cutMin*.42),hit=low>threshold&&t-this.last>cooldown;if(hit){this.last=t;this.count++;const modes=theme.id.includes('naru')?['line','flash','glitch']:theme.id==='phonk-noir'?['glitch','flash','zoom']:['zoom','line','flash'];this.fx=modes[this.count%modes.length];this.fxUntil=t+.14}return {hit,accent:hit&&low>.62,fx:t<this.fxUntil?this.fx:null}}reset(){this.avg=.12;this.last=-99;this.count=0;this.fx=null;this.fxUntil=0}}
function cover(ctx,src,W,H,zoom=1,dx=0,dy=0){const iw=finite(src?.videoWidth||src?.width||src?.naturalWidth,0),ih=finite(src?.videoHeight||src?.height||src?.naturalHeight,0);if(!iw||!ih)return;const r=Math.max(W/iw,H/ih)*Math.max(.2,finite(zoom,1)),dw=iw*r,dh=ih*r;try{ctx.drawImage(src,(W-dw)/2+finite(dx,0)*W,(H-dh)/2+finite(dy,0)*H,dw,dh)}catch{}}

async function waitVideo(v,timeout=3500){await new Promise((res,rej)=>{let done=false;const finish=fn=>{if(done)return;done=true;v.onloadedmetadata=v.onloadeddata=v.onerror=null;fn()};v.onloadeddata=()=>finish(res);v.onloadedmetadata=()=>{if(v.readyState>=2)finish(res)};v.onerror=()=>finish(()=>rej(new Error('Video decode failed.')));try{v.load()}catch{}setTimeout(()=>finish(res),timeout)})}
async function snapshotVideo(v,maxW,maxH){
  const iw=finite(v.videoWidth,0),ih=finite(v.videoHeight,0);if(!iw||!ih)throw new Error('Video dimensions unavailable.');
  try{if(Number.isFinite(v.duration)&&v.duration>1){v.currentTime=Math.min(Math.max(.25,v.duration*.18),Math.max(.25,v.duration-.25));await new Promise(r=>{let done=false;const f=()=>{if(done)return;done=true;v.onseeked=null;r()};v.onseeked=f;setTimeout(f,600)})}}catch{}
  const scale=Math.min(1,maxW/iw,maxH/ih),w=Math.max(2,Math.round(iw*scale)),h=Math.max(2,Math.round(ih*scale));
  const c=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):Object.assign(document.createElement('canvas'),{width:w,height:h}),x=c.getContext('2d',{alpha:false});x.drawImage(v,0,0,w,h);
  if(c.transferToImageBitmap)return c.transferToImageBitmap();
  return createImageBitmap(c);
}

class SceneLease{
  constructor(library,{maxW=1280,maxH=720,onState=()=>{}}={}){this.library=library;this.maxW=maxW;this.maxH=maxH;this.onState=onState;this.current=null;this.desired=null;this.pump=null;this.closed=false;this.generation=0}
  request(item){this.desired=item||null;this.generation++;if(this.closed)return Promise.resolve(null);if(!this.pump)this.pump=this._pump().finally(()=>{this.pump=null;if(!this.closed&&this.desired?.id!==this.current?.id)this.request(this.desired)});return this.pump}
  async load(item){return this.request(item)}
  async _decode(item){
    if(!item)return null;
    if(item.kind==='image'){
      const file=await this.library.open(item);if(file.size>28*MB&&underMemoryPressure())throw new Error('Skipped an oversized image to protect browser memory.');
      let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image',resizeWidth:this.maxW,resizeHeight:this.maxH,resizeQuality:'medium'})}catch(e){throw new Error(`Safe resized image decode failed; Ridge skipped the image instead of decoding it full-size. ${e?.message||''}`.trim())}
      return {id:item.id,kind:'image',source:bitmap,release(){try{bitmap.close()}catch{}}};
    }
    let v=null,url='';
    try{
      v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='metadata';v.disablePictureInPicture=true;v.crossOrigin='anonymous';
      if(item.source==='remote')v.src=item.remoteUrl;else{const file=await this.library.open(item);url=URL.createObjectURL(file);v.src=url}
      await waitVideo(v);const pixels=finite(v.videoWidth,0)*finite(v.videoHeight,0);if(pixels>this.maxW*this.maxH*4&&underMemoryPressure())throw new Error('Skipped an oversized video to protect browser memory.');
      const bitmap=await snapshotVideo(v,this.maxW,this.maxH);
      try{v.pause();v.removeAttribute('src');v.load()}catch{}if(url)URL.revokeObjectURL(url);
      return {id:item.id,kind:'image',source:bitmap,release(){try{bitmap.close()}catch{}}};
    }catch(e){try{v?.pause();v?.removeAttribute('src');v?.load()}catch{}if(url)try{URL.revokeObjectURL(url)}catch{}throw new Error(`Video was replaced by procedural visuals for stability. ${e?.message||''}`.trim())}
  }
  async _pump(){while(!this.closed){const wanted=this.desired;if(!wanted){this.current?.release?.();this.current=null;return null}if(this.current?.id===wanted.id)return this.current;let next=null;try{next=await this._decode(wanted)}catch(e){if(this.desired?.id===wanted.id)this.desired=null;this.onState({type:'warn',message:e.message});return this.current}if(this.closed){next?.release?.();return null}if(this.desired?.id!==wanted.id){next?.release?.();await sleep(0);continue}this.current?.release?.();this.current=next;return next}return null}
  clear(){this.generation++;this.desired=null;this.current?.release?.();this.current=null}
  close(){this.closed=true;this.clear()}
}

function chooseMime(){const supported=x=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported?.(x),ua=navigator.userAgent||'',safari=/Safari/i.test(ua)&&!/Chrome|Chromium|Android/i.test(ua);const stable=safari?['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm']:['video/webm;codecs=vp8,opus','video/webm','video/webm;codecs=vp9,opus','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4'];return stable.find(supported)||''}
async function opfsWriter(name){if(!navigator.storage?.getDirectory)return null;try{await navigator.storage.persist?.();const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name,{create:true}),w=await h.createWritable();return {root,h,w,name}}catch{return null}}
async function finishOpfs(x){if(!x)return null;await x.w.close();return x.h.getFile()}
function storyMotion(scene,b){if(!scene)return {zoom:1+unit(b.low)*.018,dx:0,dy:0};const p=unit(scene.progress),energy=unit(scene.energy),motion=scene.motion||'drift';let zoom=1.015+energy*.025,dx=0,dy=0;if(motion==='push')zoom+=p*(.06+energy*.035);else if(motion==='pull')zoom+=(1-p)*.06;else if(motion==='track')dx=(p-.5)*.06;else if(motion==='handheld'){dx=Math.sin(p*31)*.006*(.4+energy);dy=Math.cos(p*27)*.004*(.4+energy)}else if(motion==='drift')dx=(p-.5)*.025;return {zoom,dx,dy}}
function storyTransition(ctx,W,H,scene){if(!scene)return;const p=unit(scene.progress),edge=Math.min(p,1-p),type=scene.transition||'cut';let a=0;if(type==='fade'||type==='dissolve')a=edge<.10?(1-edge/.10)*.52:0;else if(type==='flash')a=p<.035?(1-p/.035)*.25:0;else if(type==='whip')a=p<.06?(1-p/.06)*.18:0;if(a>0){ctx.fillStyle=type==='flash'?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a})`;ctx.fillRect(0,0,W,H)}}

export class RenderEngine{
  constructor(canvas,library,{onState=()=>{}}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});this.library=library;this.onState=onState;this.sequence=[];this.sceneIndex=0;this.storyIndex=-1;this.storyScene=null;this.lastMediaId='';this.lastCut=-99;this.beat=new BeatGate();this.lease=new SceneLease(library,{onState});this.preview=null;this.previewRaf=0;this.previewLast=0;this.rendering=false;this.abortFlag=false;this.gestureCtx=null;this.renderAudio=null;this.renderAudioUrl='';this.forceEmergency=false}
  quality(aspect='landscape'){
    const m=memorySnapshot(),mobile=isMobile(),weak=m.deviceGB<=3||m.cores<=4,pressure=m.limit&&m.ratio>=.54,emergency=this.forceEmergency||mobile||weak||pressure;
    if(aspect==='vertical'){if(emergency)return {w:360,h:640,fps:20,bitrate:1_050_000,tier:'crashproof'};return {w:540,h:960,fps:24,bitrate:2_100_000,tier:'safe'}}
    if(emergency)return {w:640,h:360,fps:20,bitrate:1_050_000,tier:'crashproof'};return {w:960,h:540,fps:24,bitrate:2_400_000,tier:'safe'}
  }
  resetSequence(project){this.sequence=this.library.chooseSequence(12,project.title||project.idea||'ridge');this.sceneIndex=0;this.storyIndex=-1;this.storyScene=null;this.lastMediaId='';this.lastCut=-99;this.beat.reset();this.lease.clear();const first=project.scenePlan?.scenes?.[0],item=first?this.library.chooseForScene(first,{seed:project.title||'ridge'}):this.sequence[0];if(item){this.lastMediaId=item.id;this.lease.request(item).catch(()=>{})}}
  async prepareUserGesture(audioFile=null){this.stopPreview(true);try{if(!this.gestureCtx)this.gestureCtx=AC();await this.gestureCtx.resume()}catch{}if(audioFile){this._releaseRenderAudio();const a=new Audio(),url=URL.createObjectURL(audioFile);a.src=url;a.preload='metadata';a.playsInline=true;a.volume=0;try{await a.play();a.pause();a.currentTime=0}catch{}a.volume=1;this.renderAudio=a;this.renderAudioUrl=url}return true}
  _releaseRenderAudio(){if(this.renderAudio)try{this.renderAudio.pause();this.renderAudio.removeAttribute('src');this.renderAudio.load()}catch{}if(this.renderAudioUrl)try{URL.revokeObjectURL(this.renderAudioUrl)}catch{}this.renderAudio=null;this.renderAudioUrl=''}
  _syncStory(time,project){const scene=sceneAtTime(time,project.scenePlan);if(!scene)return null;if(scene.index!==this.storyIndex){this.storyIndex=scene.index;this.storyScene=scene;const item=this.library.chooseForScene(scene,{excludeId:this.lastMediaId,seed:project.title||'ridge'});if(item){this.lastMediaId=item.id;this.lease.request(item).catch(e=>this.onState({type:'warn',message:e.message}))}}else this.storyScene=scene;return this.storyScene}
  _maybeCut(time,b,beat,theme,project){if(project.scenePlan?.scenes?.length||!this.sequence.length)return;const min=Math.max(.75,theme.cutMin),strong=beat.accent||b.energy>.58;if((beat.hit||time-this.lastCut>min*2.6)&&time-this.lastCut>=min&&(strong||time-this.lastCut>min*1.8)){this.lastCut=time;this.sceneIndex=(this.sceneIndex+1)%this.sequence.length;const item=this.sequence[this.sceneIndex];if(item){this.lastMediaId=item.id;this.lease.request(item).catch(e=>this.onState({type:'warn',message:e.message}))}}}
  drawFrame(time,duration,b,project){const theme=themeById(project.theme),beat=this.beat.update(b,time,theme),story=this._syncStory(time,project);this._maybeCut(time,b,beat,theme,project);const ctx=this.ctx,W=this.canvas.width,H=this.canvas.height,src=this.lease.current?.source,m=storyMotion(story,b),zoom=m.zoom+(beat.fx==='zoom'?.025:0)+unit(b.low)*.006;ctx.save();ctx.fillStyle=theme.palette[2];ctx.fillRect(0,0,W,H);if(src){cover(ctx,src,W,H,zoom,m.dx,m.dy);ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(0,0,W,H)}else drawProcedural(ctx,W,H,time,b,theme);drawVisualizer(ctx,W,H,time,b,theme);if(beat.fx==='flash'){ctx.fillStyle=`rgba(255,255,255,${unit(.04+theme.effect*.08)})`;ctx.fillRect(0,0,W,H)}storyTransition(ctx,W,H,story);drawLyrics(ctx,W,H,time,project.lyricCues||[],theme);drawIntroOutro(ctx,W,H,time,duration,project,theme);ctx.restore()}
  async startPreview(audioEl,project){if(!audioEl?.src)throw new Error('Choose a song first.');this.stopPreview(true);this.resetSequence(project);if(!this.preview){const ac=AC(),an=ac.createAnalyser();an.fftSize=256;an.smoothingTimeConstant=.8;const src=ac.createMediaElementSource(audioEl);src.connect(an);an.connect(ac.destination);this.preview={ac,an,src,audioEl,freq:new Uint8Array(an.frequencyBinCount)}}else this.preview.audioEl=audioEl;await this.preview.ac.resume();await audioEl.play();const fps=isMobile()?18:24,interval=1000/fps;const loop=ts=>{if(audioEl.paused)return;if(ts-this.previewLast>=interval){this.previewLast=ts;this.preview.an.getByteFrequencyData(this.preview.freq);this.drawFrame(audioEl.currentTime,audioEl.duration||120,bands(this.preview.freq),project)}this.previewRaf=requestAnimationFrame(loop)};this.previewRaf=requestAnimationFrame(loop)}
  stopPreview(pauseAudio=false){cancelAnimationFrame(this.previewRaf);this.previewRaf=0;this.previewLast=0;if(pauseAudio&&this.preview?.audioEl){try{this.preview.audioEl.pause()}catch{}try{this.preview.ac?.suspend()}catch{}}}
  abort(){this.abortFlag=true}
  async render(audioFile,project,{onProgress=()=>{}}={}){
    if(this.rendering)throw new Error('A render is already running.');if(!audioFile)throw new Error('Choose a song first.');this.rendering=true;this.abortFlag=false;this.stopPreview(true);await cleanupRidgeStorage();try{await this.gestureCtx?.suspend()}catch{}
    const q=this.quality(project.aspect||'landscape');this.canvas.width=q.w;this.canvas.height=q.h;this.lease.maxW=q.w;this.lease.maxH=q.h;this.resetSequence(project);let ac=null,audio=null,url='',ownsUrl=false,stream=null,raf=0,writer=null,chunks=[],chunkBytes=0,pendingBytes=0,visibilityHandler=null,rec=null;
    try{
      const mime=chooseMime(),ext=mime.includes('mp4')?'mp4':'webm',name=`ridge-${String(project.title||'video').replace(/[^a-z0-9_-]+/gi,'-').slice(0,70)}-${Date.now()}.${ext}`;writer=await opfsWriter(name);if(this.renderAudio&&this.renderAudioUrl){audio=this.renderAudio;url=this.renderAudioUrl}else{audio=new Audio();url=URL.createObjectURL(audioFile);ownsUrl=true;audio.src=url;audio.preload='metadata';audio.playsInline=true}audio.volume=1;try{audio.currentTime=0}catch{}
      if(!Number.isFinite(audio.duration)||!audio.duration)await new Promise((res,rej)=>{let done=false;const finish=fn=>{if(done)return;done=true;audio.onloadedmetadata=null;audio.onerror=null;fn()};audio.onloadedmetadata=()=>finish(res);audio.onerror=()=>finish(()=>rej(new Error('The song could not be decoded by this browser.')));setTimeout(()=>finish(res),4500)});
      const duration=Number.isFinite(audio.duration)?audio.duration:0;if(!duration)throw new Error('Could not read song duration.');if(duration>210&&isMobile()){q.fps=18;q.bitrate=900_000;this.canvas.width=project.aspect==='vertical'?360:640;this.canvas.height=project.aspect==='vertical'?640:360}if(!project.lyricCues?.length)project.lyricCues=buildLyricCues(project.lyrics||'',duration);
      ac=AC();await ac.resume();const src=ac.createMediaElementSource(audio),an=ac.createAnalyser(),dest=ac.createMediaStreamDestination();an.fftSize=256;an.smoothingTimeConstant=.8;src.connect(an);an.connect(dest);const canvasStream=this.canvas.captureStream(q.fps);const vt=canvasStream.getVideoTracks()[0];if(vt)try{vt.contentHint='motion'}catch{}stream=new MediaStream([...canvasStream.getVideoTracks(),...dest.stream.getAudioTracks()]);
      try{rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:q.bitrate,audioBitsPerSecond:96000}:undefined)}catch{rec=new MediaRecorder(stream,{videoBitsPerSecond:Math.min(q.bitrate,1_000_000),audioBitsPerSecond:80000})}
      const freq=new Uint8Array(an.frequencyBinCount);let write=Promise.resolve(),writeError=null,ended=false,lastDraw=0,lastPressureCheck=0;const mobile=isMobile(),pendingLimit=(mobile?8:24)*MB,memoryLimit=mobile?96*MB:280*1024*1024;
      const stopped=new Promise((res,rej)=>{rec.onerror=e=>rej(e.error||new Error('MediaRecorder failed.'));rec.onstop=res;rec.ondataavailable=e=>{if(!e.data?.size)return;if(writer){pendingBytes+=e.data.size;if(pendingBytes>pendingLimit){this.abortFlag=true;writeError=new Error('Storage writes fell behind; Ridge stopped before Android could kill the tab.')}const blob=e.data;write=write.then(async()=>{await writer.w.write(blob);pendingBytes=Math.max(0,pendingBytes-blob.size)}).catch(err=>writeError=err)}else{chunks.push(e.data);chunkBytes+=e.data.size;if(chunkBytes>memoryLimit){this.abortFlag=true;writeError=new Error('This browser cannot stream the export to disk and reached Ridge’s crash-prevention limit.')}}}});
      audio.onended=()=>ended=true;visibilityHandler=()=>{if(document.hidden&&rec.state==='recording'){try{rec.pause();audio.pause()}catch{}}else if(!document.hidden&&rec.state==='paused'){try{rec.resume();audio.play().catch(()=>{})}catch{}}};document.addEventListener('visibilitychange',visibilityHandler);
      an.getByteFrequencyData(freq);this.drawFrame(0,duration,bands(freq),project);rec.start(mobile?4000:2500);try{await audio.play()}catch{throw new Error('Browser blocked render playback. Tap CREATE VIDEO once more; Ridge will reuse the granted media gesture.')}
      const interval=1000/q.fps;const loop=ts=>{if(ended||this.abortFlag)return;if(ts-lastPressureCheck>1200){lastPressureCheck=ts;const m=memorySnapshot();if((m.limit&&m.ratio>.74)||pendingBytes>pendingLimit*.8){this.lease.clear();if(m.limit&&m.ratio>.82){this.abortFlag=true;this.onState({type:'warn',message:'Ridge stopped before browser memory reached Android kill pressure.'});return}}}if(ts-lastDraw>=interval){lastDraw=ts;an.getByteFrequencyData(freq);this.drawFrame(audio.currentTime,duration,bands(freq),project);onProgress(unit(audio.currentTime/duration))}raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop);
      while(!ended&&!this.abortFlag)await sleep(160);cancelAnimationFrame(raf);if(!audio.paused)audio.pause();if(rec.state!=='inactive')rec.stop();await stopped;await write;if(writeError)throw writeError;if(this.abortFlag){this.forceEmergency=true;throw new Error('Render stopped safely before a browser crash. Ridge is now locked to the crashproof tier; press CREATE once more.')}const file=writer?await finishOpfs(writer):new File(chunks,name,{type:mime||'video/webm'});onProgress(1);return {file,mime:file.type||mime||'video/webm',quality:q,duration,sceneCount:project.scenePlan?.scenes?.length||0}
    }catch(e){if(writer)try{await writer.w.abort()}catch{}throw e}
    finally{if(visibilityHandler)document.removeEventListener('visibilitychange',visibilityHandler);cancelAnimationFrame(raf);try{if(rec&&rec.state!=='inactive')rec.stop()}catch{}stream?.getTracks().forEach(t=>t.stop());try{audio?.pause()}catch{}try{await ac?.close()}catch{}if(ownsUrl&&url)try{URL.revokeObjectURL(url)}catch{}this._releaseRenderAudio();this.lease.clear();chunks.length=0;this.rendering=false}
  }
  close(){this.stopPreview(true);this.lease.close();this._releaseRenderAudio();try{this.preview?.ac?.close()}catch{}this.preview=null;try{this.gestureCtx?.close()}catch{}this.gestureCtx=null}
}
export {bands,memorySnapshot,underMemoryPressure,cleanupRidgeStorage};
