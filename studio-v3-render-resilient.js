'use strict';

import {RenderEngine as BaseRenderEngine,bands,memorySnapshot,underMemoryPressure,cleanupRidgeStorage} from './studio-v3-render.js?base=3.8.2';

const mobile=()=>/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent||'')||innerWidth<760||(Number(navigator.deviceMemory)||8)<=4;
const recovery=()=>Math.max(0,Number(window.__RIDGE_RESILIENCE__?.recovery)||0);

export class RenderEngine extends BaseRenderEngine{
  quality(aspect='landscape'){
    const base=super.quality(aspect),level=recovery();
    if(!mobile()&&level===0)return base;
    if(aspect==='vertical'){
      if(level>=2)return {w:144,h:256,fps:10,bitrate:300_000,tier:`recovery-${level}`};
      return {w:180,h:320,fps:12,bitrate:420_000,tier:'android-safe'};
    }
    if(level>=2)return {w:256,h:144,fps:10,bitrate:300_000,tier:`recovery-${level}`};
    return {w:320,h:180,fps:12,bitrate:420_000,tier:'android-safe'};
  }
  async render(audioFile,project,opts={}){
    if(mobile()||recovery()>0){this.forceEmergency=true;this.proceduralExport=true;this.lease?.clear?.();await cleanupRidgeStorage();}
    return super.render(audioFile,{...project,cloudStock:false,freeVideoMinutes:0},opts);
  }
  async startPreview(audioEl,project){
    if(mobile()||recovery()>0){this.forceEmergency=true;this.proceduralExport=true;this.lease?.clear?.();}
    return super.startPreview(audioEl,{...project,cloudStock:false,freeVideoMinutes:0});
  }
}

export {bands,memorySnapshot,underMemoryPressure,cleanupRidgeStorage};
