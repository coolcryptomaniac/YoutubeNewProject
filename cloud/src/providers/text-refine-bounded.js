'use strict';

import {adaptiveRefine as rawAdaptiveRefine,adaptiveTextCapabilities as rawCapabilities} from './text-refine.js';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const clampMs=(v,fallback)=>Math.max(5000,Math.min(90000,Number(v)||fallback));
const compactCurrent=x=>({
  title:safe(x?.title,120),
  description:safe(x?.description,4000),
  hashtags:Array.isArray(x?.hashtags)?x.hashtags.slice(0,8):[],
  tags:Array.isArray(x?.tags)?x.tags.slice(0,24):[],
  clean_lyrics:safe(x?.clean_lyrics||x?.lyrics,16000),
  intro:safe(x?.intro,120),
  outro:safe(x?.outro,160),
  story:safe(x?.story,1000),
  hook_meaning:safe(x?.hook_meaning||x?.hookMeaning,800)
});

function timeoutBypass(current,ms){
  return {status:200,body:{
    ok:true,
    provider:'bypass',
    model:null,
    confidence:1,
    verdict:'keep_current',
    adaptiveVerdict:'keep_current',
    changesSummary:`Free-first refinement exceeded Ridge's ${Math.round(ms/1000)}s latency budget; canonical release package kept unchanged.`,
    candidate:compactCurrent(current||{}),
    attempts:[{provider:'budget-guard',model:null,status:0,error:'overall adaptive text deadline reached'}],
    paidFallback:false,
    degraded:true,
    timedOut:true,
    totalBudgetMs:ms
  }};
}

export function adaptiveTextCapabilities(env){
  const totalBudgetMs=clampMs(env.TEXT_TOTAL_TIMEOUT_MS,35000);
  return {...rawCapabilities(env),boundedFallback:true,totalBudgetMs};
}

export async function adaptiveRefine(request,env){
  const totalBudgetMs=clampMs(env.TEXT_TOTAL_TIMEOUT_MS,35000);
  let body={};
  try{body=await request.clone().json()}catch{}
  let timer;
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>resolve(timeoutBypass(body.current,totalBudgetMs)),totalBudgetMs)});
  try{
    return await Promise.race([rawAdaptiveRefine(request,env),deadline]);
  }finally{
    if(timer)clearTimeout(timer);
  }
}
