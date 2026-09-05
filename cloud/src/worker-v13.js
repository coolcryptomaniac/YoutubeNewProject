'use strict';

import base from './worker-v12.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const VUSIC_ONE_KEY='private/vusic/one-live-release.json';
const stepName=x=>typeof x==='string'?x:String(x?.step||'');

async function hardenOneRelease(request,env,ctx){
  const r=await base.fetch(request,env,ctx);let body=null;try{body=await r.clone().json()}catch{return r}
  if(body?.state?.status!=='retryable'||!env.RELEASE_MEDIA)return r;
  const steps=Array.isArray(body?.result?.detail?.steps)?body.result.detail.steps:Array.isArray(body?.result?.steps)?body.result.steps:[];
  const message=String(body?.result?.message||body?.result?.error||body?.state?.reason||'');
  const reviewBoundary=steps.some(x=>stepName(x)==='review');
  const finalBoundary=/final submit was clicked|confirmation text was not recognized/i.test(message);
  if(!reviewBoundary&&!finalBoundary)return r;
  const state={...body.state,status:'ambiguous',reason:message||'Vusic reached the review/final-submit boundary; automatic retries are locked to prevent a duplicate release.',result:body.result};
  await env.RELEASE_MEDIA.put(VUSIC_ONE_KEY,JSON.stringify(state),{httpMetadata:{contentType:'application/json'}});
  return json({...body,ok:false,locked:true,state},409);
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const u=new URL(request.url);
    if(u.pathname==='/api/vusic-one-release/execute'&&request.method==='POST')return hardenOneRelease(request,env,ctx);
    if(u.pathname==='/api/resilience/health'&&request.method==='GET'){
      const r=await base.fetch(request,env,ctx);let body={};try{body=await r.clone().json()}catch{}
      return json({...body,ok:true,worker:'v13',vusicExactlyOnce:{reviewBoundaryObjectAware:true,finalSubmitAmbiguityLock:true}});
    }
    return base.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(base.scheduled)return base.scheduled(event,env,ctx)}
};
