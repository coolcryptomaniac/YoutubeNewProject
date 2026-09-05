'use strict';

import base from './worker-v13.js';
import {authorizeAutomation} from './providers/github-oidc.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});
const VUSIC_ONE_KEY='private/vusic/one-live-release.json';

async function diagnosticAuth(request,env){
  if((request.headers.get('Authorization')||'')===`Bearer ${env.RIDGE_ADMIN_TOKEN}`&&env.RIDGE_ADMIN_TOKEN)return true;
  return authorizeAutomation(request,env,{audience:'ridge-deploy-smoke',workflow:'deploy-ridge-cloud.yml',events:['push','workflow_dispatch']});
}
const cleanText=(v,n=220)=>String(v||'').replace(/\s+/g,' ').trim().slice(0,n);
function sanitizeSnapshot(s){
  if(!s||typeof s!=='object')return null;
  return {
    url:cleanText(s.url,500),title:cleanText(s.title,180),
    headings:Array.isArray(s.headings)?s.headings.map(x=>cleanText(x,140)).slice(0,20):[],
    inputs:Array.isArray(s.inputs)?s.inputs.map(x=>({type:cleanText(x.type,40),tag:cleanText(x.tag,20),name:cleanText(x.name,100),id:cleanText(x.id,100),placeholder:cleanText(x.placeholder,140),aria:cleanText(x.aria,140),value:/password|token|secret/i.test(String(x.name||x.id||x.type||''))?'[redacted]':cleanText(x.value,80),disabled:!!x.disabled,context:cleanText(x.context,180)})).slice(0,36):[],
    labels:Array.isArray(s.labels)?s.labels.map(x=>cleanText(x,120)).slice(0,36):[],
    buttons:Array.isArray(s.buttons)?s.buttons.map(x=>({text:cleanText(x.text,120),tag:cleanText(x.tag,20),type:cleanText(x.type,40),disabled:!!x.disabled})).slice(0,50):[],
    alerts:Array.isArray(s.alerts)?s.alerts.map(x=>cleanText(x,180)).slice(0,16):[]
  };
}
async function diagnostic(request,env){
  if(!(await diagnosticAuth(request,env)))return json({error:'Diagnostic authorization required'},401);
  if(!env.RELEASE_MEDIA)return json({error:'R2 unavailable'},503);
  const o=await env.RELEASE_MEDIA.get(VUSIC_ONE_KEY),state=o?await o.json().catch(()=>null):null;
  const detail=state?.result?.detail||null;
  return json({ok:true,status:state?.status||'ready',reason:cleanText(state?.reason,500),steps:Array.isArray(detail?.steps)?detail.steps.map(x=>({step:cleanText(x?.step||x,80),url:cleanText(x?.url,500)})).slice(0,20):[],control:detail?.control||null,alerts:Array.isArray(detail?.alerts)?detail.alerts.map(x=>cleanText(x,180)).slice(0,16):[],before:sanitizeSnapshot(detail?.before||detail?.snapshot),after:sanitizeSnapshot(detail?.after),pageText:cleanText(detail?.pageText,1200)});
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const u=new URL(request.url);
    if(u.pathname==='/api/vusic-one-release/diagnostic'&&request.method==='GET')return diagnostic(request,env);
    if(u.pathname==='/api/resilience/health'&&request.method==='GET'){
      const r=await base.fetch(request,env,ctx);let body={};try{body=await r.clone().json()}catch{}
      return json({...body,ok:true,worker:'v14',vusicDiagnostic:{protected:true,sanitized:true}});
    }
    return base.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(base.scheduled)return base.scheduled(event,env,ctx)}
};
