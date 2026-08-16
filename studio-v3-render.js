'use strict';

import {themeById,drawProcedural,drawVisualizer,drawLyrics,drawIntroOutro} from './studio-v3-themes.js';
import {buildMeaningTimeline,buildDirectedSequence,beatAt,timedLyricCues} from './studio-v3-director.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const unit=v=>Math.max(0,Math.min(1,finite(v,0)));

function bands(freq){if(!freq?.length)return {low:.12,mid:.1,high:.08,energy:.1};const avg=(a,b)=>{const s=Math.max(0,Math.floor(a)),e=Math.min(freq.length,Math.max(s+1,Math.ceil(b)));let n=0,sum=0;for(let i=s;i<e;i++){sum+=finite(freq[i],0)/255;n++}return unit(n?sum/n:0)};const low=avg(1,freq.length*.08),mid=avg(freq.length*.08,freq.length*.34),high=avg(freq.length*.34,freq.length*.82);return {low,mid,high,energy:unit(low*.48+mid*.34+high*.18)}}
class BeatGate{constructor(){this.avg=.12;this.last=-99;this.count=0;this.fx=null;this.fxUntil=0}update(b,time,theme){const t=finite(time,0),low=unit(b.low);this.avg=this.avg*.94+low*.06;const threshold=Math.max(.34,this.avg*1.32+.06),cooldown=Math.max(.30,theme.cutMin*.42),hit=low>threshold&&t-this.last>cooldown;if(hit){this.last=t;this.count++;const modes=theme.id.includes('naru')?['line','flash','glitch']:theme.id==='phonk-noir'?['glitch','flash','zoom']:['zoom','line','flash'];this.fx=modes[this.count%modes.length];this.fxUntil=t+.14}return {hit,accent:hit&&low>.62,fx:t<this.fxUntil?this.fx:null}}reset(){this.avg=.12;this.last=-99;this.count=0;this.fx=null;this.fxUntil=0}}
function cover(ctx,src,W,H,zoom=1){const iw=finite(src?.videoWidth||src?.width||src?.naturalWidth,0),ih=finite(src?.videoHeight||src?.height||src?.naturalHeight,0);if(!iw||!ih)return;const r=Math.max(W/iw,H/ih)*Math.max(.2,finite(zoom,1)),dw=iw*r,dh=ih*r;try{ctx.drawImage(src,(W-dw)/2,(H-dh)/2,dw,dh)}catch{}}

/*
 * A single decode lane is deliberate. Older V3 could start decoding scene B,
 * receive another beat cut, then start C/D before B finished. Mobile Chrome
 * can kill the renderer when several 4K images/videos enter the decoder at once.
 * SceneLease now keeps only one in-flight decode and always converges on the
 * newest requested scene before releasing the previous visible one.
 */
class SceneLease{
  constructor(library,{maxW=1280,maxH=720}={}){this.library=library;this.maxW=maxW;this.maxH=maxH;this.current=null;this.desired=null;this.pump=null;this.closed=false}
  request(item){this.desired=item||null;if(this.closed)return Promise.resolve(null);if(!this.pump)this.pump=this._pump().finally(()=>{this.pump=null;if(!this.closed&&this.desired?.id!==this.current?.id)this.request(this.desired)});return this.pump}
  async load(item){return this.request(item)}
  async _decode(item){
    if(!item)return null;
    if(item.kind==='video'&&item.source==='remote'){
      const v=document.createElement('video');v.crossOrigin='anonymous';v.src=item.remoteUrl;v.muted=true;v.loop=true;v.playsInline=true;v.preload='metadata';
      await new Promise((res,rej)=>{let done=false;const finish=fn=>{if(done)return;done=true;v.onloadeddata=null;v.onerror=null;fn()};v.onloadeddata=()=>finish(res);v.onerror=()=>finish(()=>rej(new Error('A cloud stock clip could not be streamed.')));setTimeout(()=>finish(res),4500)});try{await v.play()}catch{}
      return {id:item.id,kind:'video',source:v,release(){try{v.pause();v.removeAttribute('src');v.load()}catch{}}};
    }
    const file=await this.library.open(item);
    if(item.kind==='image'){
      let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image',resizeWidth:this.maxW,resizeHeight:this.maxH,resizeQuality:'medium'})}catch{bitmap=await createImageBitmap(file)}
      return {id:item.id,kind:'image',source:bitmap,release(){try{bitmap.close()}catch{}}};
    }
    const url=URL.createObjectURL(file),v=document.createElement('video');v.src=url;v.muted=true;v.loop=true;v.playsInline=true;v.preload='metadata';
    try{
      await new Promise((res,rej)=>{let done=false;const finish=fn=>{if(done)return;done=true;v.onloadeddata=null;v.onerror=null;fn()};v.onloadeddata=()=>finish(res);v.onerror=()=>finish(()=>rej(new Error('A selected video could not be decoded.')));setTimeout(()=>finish(res),3500)});try{await v.play()}catch{}
      return {id:item.id,kind:'video',source:v,release(){try{v.pause();v.removeAttribute('src');v.load();URL.revokeObjectURL(url)}catch{}}};
    }catch(e){try{URL.revokeObjectURL(url)}catch{}throw e}
  }
  async _pump(){
    while(!this.closed){
      const wanted=this.desired;if(!wanted){this.current?.release?.();this.current=null;return null}
      if(this.current?.id===wanted.id)return this.current;
      let next=null;try{next=await this._decode(wanted)}catch(e){if(this.desired?.id===wanted.id)this.desired=null;throw e}
      if(this.closed){next?.release?.();return null}
      if(this.desired?.id!==wanted.id){next?.release?.();await sleep(0);continue}
      this.current?.release?.();this.current=next;return next
    }
    return null
  }
  clear(){this.desired=null;this.current?.release?.();this.current=null}
  close(){this.closed=true;this.desired=null;this.current?.release?.();this.current=null}
}

function chooseMime(){return ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported?.(x))||''}
async function opfsWriter(name){if(!navigator.storage?.getDirectory)return null;try{const root=await navigator.storage.getDirectory(),h=await root.getFileHandle(name,{create:true}),w=await h.createWritable();return {root,h,w,name}}catch{return null}}
async function finishOpfs(x){if(!x)return null;await x.w.close();return x.h.getFile()}

export class RenderEngine{
  constructor(canvas,library,{onState=()=>{}}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.library=library;this.onState=onState;this.sequence=[];this.timeline=[];this.directedScenes=[];this.sceneIndex=-1;this.lastCut=-99;this.beat=new BeatGate();this.lease=new SceneLease(library);this.preview=null;this.previewRaf=0;this.rendering=false;this.abortFlag=false;this.gestureCtx=null;this.renderAudio=null;this.renderAudioUrl=''}
  quality(aspect='landscape'){const mem=Number(navigator.deviceMemory)||4,cores=Number(navigator.hardwareConcurrency)||4,low=mem<=4||cores<=4||innerWidth<700;if(aspect==='vertical')return low?{w:540,h:960,fps:24,bitrate:2_500_000}:{w:720,h:1280,fps:30,bitrate:4_000_000};return low?{w:960,h:540,fps:24,bitrate:2_500_000}:{w:1280,h:720,fps:30,bitrate:4_800_000}}
  resetSequence(project,duration=120){this.timeline=buildMeaningTimeline(project,duration);this.directedScenes=buildDirectedSequence(this.library,project,duration);this.sequence=this.directedScenes.map(x=>x.item).filter(Boolean);if(!this.sequence.length)this.sequence=this.library.chooseSequence(12,project.title||project.idea||'ridge');this.sceneIndex=-1;this.lastCut=-99;this.beat.reset();this.lease.clear();const first=this.directedScenes[0]?.item||this.sequence[0]||null;if(first)this.lease.request(first).catch(e=>this.onState({type:'warn',message:e.message}))}
  async prepareUserGesture(audioFile=null){this.stopPreview(true);try{if(!this.gestureCtx)this.gestureCtx=new AudioContext();await this.gestureCtx.resume()}catch{}if(audioFile){this._releaseRenderAudio();const a=new Audio(),url=URL.createObjectURL(audioFile);a.src=url;a.preload='metadata';a.playsInline=true;a.volume=0;try{await a.play();a.pause();a.currentTime=0}catch{}a.volume=1;this.renderAudio=a;this.renderAudioUrl=url}return true}
  _releaseRenderAudio(){if(this.renderAudio)try{this.renderAudio.pause();this.renderAudio.removeAttribute('src');this.renderAudio.load()}catch{}if(this.renderAudioUrl)try{URL.revokeObjectURL(this.renderAudioUrl)}catch{}this.renderAudio=null;this.renderAudioUrl=''}
  _directedScene(time){if(!this.directedScenes.length)return null;let out=this.directedScenes[0];for(const s of this.directedScenes){if(time>=s.start)out=s;if(time>=s.start&&time<s.end)return s}return out}
  _maybeCut(time,b,beat,theme){
    const directed=this._directedScene(time);
    if(directed&&directed.index!==this.sceneIndex){this.sceneIndex=directed.index;this.lastCut=time;this.lease.request(directed.item||null).catch(e=>this.onState({type:'warn',message:e.message}));return}
    if(this.directedScenes.length)return; // semantic plan owns scene changes; beats own effects inside scenes
    if(!this.sequence.length)return;const min=Math.max(.7,theme.cutMin),strong=beat.accent||b.energy>.62;if((beat.hit||time-this.lastCut>min*2.5)&&time-this.lastCut>=min&&(strong||time-this.lastCut>min*1.7)){this.lastCut=time;this.sceneIndex=(this.sceneIndex+1)%this.sequence.length;this.lease.request(this.sequence[this.sceneIndex]).catch(e=>this.onState({type:'warn',message:e.message}))}
  }
  drawFrame(time,duration,b,project){const q={w:this.canvas.width,h:this.canvas.height},theme=themeById(project.theme),beat=this.beat.update(b,time,theme);this._maybeCut(time,b,beat,theme);const semantic=beatAt(time,this.timeline),ctx=this.ctx,W=q.w,H=q.h,src=this.lease.current?.source,semanticIntensity=unit(semantic?.intensity??.45),zoom=1+(beat.fx==='zoom'?.035:0)+unit(b.low)*(.012+semanticIntensity*.012);ctx.save();ctx.fillStyle=theme.palette[2];ctx.fillRect(0,0,W,H);if(src){cover(ctx,src,W,H,zoom);ctx.fillStyle=`rgba(0,0,0,${.13+Math.max(0,.35-semanticIntensity)*.20})`;ctx.fillRect(0,0,W,H)}else drawProcedural(ctx,W,H,time,b,theme);drawVisualizer(ctx,W,H,time,b,theme);if(beat.fx==='flash'&&semanticIntensity>.45){ctx.fillStyle=`rgba(255,255,255,${unit(.04+theme.effect*.11)})`;ctx.fillRect(0,0,W,H)}if(beat.fx==='line'){ctx.strokeStyle=theme.palette[0];ctx.globalAlpha=.14;ctx.lineWidth=Math.max(2,W*.003);for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(0,H*(.14+i*.12));ctx.lineTo(W,H*(.04+i*.12));ctx.stroke()}ctx.globalAlpha=1}if(beat.fx==='glitch'&&semanticIntensity>.58){ctx.globalCompositeOperation='screen';ctx.fillStyle=theme.palette[1];ctx.globalAlpha=.045;for(let i=0;i<4;i++)ctx.fillRect((i%2?1:-1)*W*.01,H*((i*23)%80)/100,W,H*.007);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1}if(semantic&&time-semantic.start<.16){ctx.fillStyle=`rgba(0,0,0,${unit((.16-(time-semantic.start))/.16)*.16})`;ctx.fillRect(0,0,W,H)}drawLyrics(ctx,W,H,time,project.lyricCues||[],theme);drawIntroOutro(ctx,W,H,time,duration,project,theme);ctx.restore()}
  async startPreview(audioEl,project){if(!audioEl?.src)throw new Error('Choose a song first.');this.stopPreview(true);const duration=Number.isFinite(audioEl.duration)&&audioEl.duration>0?audioEl.duration:120;this.resetSequence(project,duration);if(!this.preview){const ac=new AudioContext(),an=ac.createAnalyser();an.fftSize=1024;an.smoothingTimeConstant=.78;const src=ac.createMediaElementSource(audioEl);src.connect(an);an.connect(ac.destination);this.preview={ac,an,src,audioEl,freq:new Uint8Array(an.frequencyBinCount)}}else this.preview.audioEl=audioEl;await this.preview.ac.resume();await audioEl.play();const loop=()=>{if(audioEl.paused)return;this.preview.an.getByteFrequencyData(this.preview.freq);project.lyricCues=timedLyricCues(project.lyrics||'',audioEl.duration||120,project.lyricSegments||[]);this.drawFrame(audioEl.currentTime,audioEl.duration||120,bands(this.preview.freq),project);this.previewRaf=requestAnimationFrame(loop)};loop()}
  stopPreview(pauseAudio=false){cancelAnimationFrame(this.previewRaf);this.previewRaf=0;if(pauseAudio&&this.preview?.audioEl){try{this.preview.audioEl.pause()}catch{}try{this.preview.ac?.suspend()}catch{}}}
  abort(){this.abortFlag=true}
  async render(audioFile,project,{onProgress=()=>{}}={}){
    if(this.rendering)throw new Error('A render is already running.');if(!audioFile)throw new Error('Choose a song first.');this.rendering=true;this.abortFlag=false;this.stopPreview(true);const q=this.quality(project.aspect||'landscape');this.canvas.width=q.w;this.canvas.height=q.h;this.lease.maxW=q.w;this.lease.maxH=q.h;let ac=null,audio=null,url='',ownsUrl=false,stream=null,raf=0,writer=null,chunks=[],chunkBytes=0,visibilityHandler=null;
    try{const mime=chooseMime(),ext=mime.includes('mp4')?'mp4':'webm',name=`ridge-${String(project.title||'video').replace(/[^a-z0-9_-]+/gi,'-').slice(0,70)}-${Date.now()}.${ext}`;writer=await opfsWriter(name);if(this.renderAudio&&this.renderAudioUrl){audio=this.renderAudio;url=this.renderAudioUrl}else{audio=new Audio();url=URL.createObjectURL(audioFile);ownsUrl=true;audio.src=url;audio.preload='metadata';audio.playsInline=true}audio.volume=1;try{audio.currentTime=0}catch{}if(!Number.isFinite(audio.duration)||!audio.duration)await new Promise((res,rej)=>{let done=false;const finish=fn=>{if(done)return;done=true;audio.onloadedmetadata=null;audio.onerror=null;fn()};audio.onloadedmetadata=()=>finish(res);audio.onerror=()=>finish(()=>rej(new Error('The song could not be decoded by this browser.')));setTimeout(()=>finish(res),5000)});const duration=Number.isFinite(audio.duration)?audio.duration:0;if(!duration)throw new Error('Could not read song duration.');project.lyricCues=timedLyricCues(project.lyrics||'',duration,project.lyricSegments||[]);this.resetSequence(project,duration);ac=new AudioContext();await ac.resume();const src=ac.createMediaElementSource(audio),an=ac.createAnalyser(),dest=ac.createMediaStreamDestination();an.fftSize=1024;an.smoothingTimeConstant=.76;src.connect(an);an.connect(dest);const canvasStream=this.canvas.captureStream(q.fps);stream=new MediaStream([...canvasStream.getVideoTracks(),...dest.stream.getAudioTracks()]);const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:q.bitrate,audioBitsPerSecond:160000}:undefined),freq=new Uint8Array(an.frequencyBinCount);let write=Promise.resolve(),writeError=null,ended=false;const stopped=new Promise((res,rej)=>{rec.onerror=e=>rej(e.error||new Error('MediaRecorder failed.'));rec.onstop=res;rec.ondataavailable=e=>{if(!e.data?.size)return;if(writer){write=write.then(()=>writer.w.write(e.data)).catch(err=>writeError=err)}else{chunks.push(e.data);chunkBytes+=e.data.size;if(chunkBytes>280*1024*1024){this.abortFlag=true;writeError=new Error('This browser cannot stream the export to disk and the in-memory safety limit was reached.')}}}});audio.onended=()=>ended=true;visibilityHandler=()=>{if(document.hidden&&rec.state==='recording'){try{rec.pause();audio.pause()}catch{}}else if(!document.hidden&&rec.state==='paused'){try{rec.resume();audio.play().catch(()=>{})}catch{}}};document.addEventListener('visibilitychange',visibilityHandler);rec.start(1000);try{await audio.play()}catch{throw new Error('Browser blocked render playback. Tap CREATE VIDEO once more; Ridge will reuse the granted media gesture.')}const loop=()=>{if(ended||this.abortFlag)return;an.getByteFrequencyData(freq);this.drawFrame(audio.currentTime,duration,bands(freq),project);onProgress(unit(audio.currentTime/duration));raf=requestAnimationFrame(loop)};loop();while(!ended&&!this.abortFlag)await sleep(120);cancelAnimationFrame(raf);if(!audio.paused)audio.pause();if(rec.state!=='inactive')rec.stop();await stopped;await write;if(writeError)throw writeError;if(this.abortFlag)throw new Error('Render stopped safely.');const file=writer?await finishOpfs(writer):new File(chunks,name,{type:mime||'video/webm'});onProgress(1);return {file,mime:file.type||mime||'video/webm',quality:q,duration,sceneCount:this.timeline.length}}
    catch(e){if(writer)try{await writer.w.abort()}catch{}throw e}
    finally{if(visibilityHandler)document.removeEventListener('visibilitychange',visibilityHandler);cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());try{audio?.pause()}catch{}try{await ac?.close()}catch{}if(ownsUrl&&url)try{URL.revokeObjectURL(url)}catch{}this._releaseRenderAudio();this.lease.clear();chunks=[];this.rendering=false}
  }
  close(){this.stopPreview(true);this.lease.close();this._releaseRenderAudio();try{this.preview?.ac?.close()}catch{}this.preview=null;try{this.gestureCtx?.close()}catch{}this.gestureCtx=null}
}
export {bands};
