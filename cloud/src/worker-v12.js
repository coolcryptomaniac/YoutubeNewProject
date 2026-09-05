'use strict';

import base from './worker-v11.js';
import {authorizeAutomation} from './providers/github-oidc.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});

async function vusicProofAuth(request,env){
  return authorizeAutomation(request,env,{audience:'ridge-vusic-live-proof',workflow:'vusic-live-proof.yml',events:['push','schedule','workflow_dispatch']});
}
function proofBridgePath(u,method){
  return (u.pathname==='/api/release/stage'&&(method==='POST'||method==='DELETE'))||
    (u.pathname==='/api/release/capabilities'&&method==='GET')||
    (u.pathname==='/api/release/vusic-login-smoke'&&method==='POST')||
    (u.pathname==='/api/release/vusic-account-smoke'&&method==='POST')||
    (u.pathname==='/api/release/vusic-wizard-smoke'&&method==='POST')||
    (u.pathname==='/api/release/vusic'&&method==='POST');
}
function asAdminRequest(request,env){
  const h=new Headers(request.headers);
  h.set('Authorization',`Bearer ${env.RIDGE_ADMIN_TOKEN}`);
  return new Request(request,{headers:h});
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const u=new URL(request.url);
    if(proofBridgePath(u,request.method)){
      if(!env.RIDGE_ADMIN_TOKEN)return json({error:'RIDGE_ADMIN_TOKEN is not configured for the internal proof bridge'},503);
      const auth=await vusicProofAuth(request,env);
      if(auth)return base.fetch(asAdminRequest(request,env),env,ctx);
    }
    if(u.pathname==='/api/resilience/health'&&request.method==='GET'){
      const r=await base.fetch(request,env,ctx);let body={};try{body=await r.clone().json()}catch{}
      return json({...body,ok:true,worker:'v12',vusicProofAuth:{audience:'ridge-vusic-live-proof',events:['push','schedule','workflow_dispatch'],stageBridge:true}});
    }
    return base.fetch(request,env,ctx);
  },
  async scheduled(event,env,ctx){if(base.scheduled)return base.scheduled(event,env,ctx)}
};
