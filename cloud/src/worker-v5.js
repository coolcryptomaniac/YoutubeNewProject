'use strict';

import base from './worker-v4.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range,X-Ridge-Session','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors}});

async function sessionValid(request,env,ctx){
  const token=request.headers.get('X-Ridge-Session')||request.headers.get('Authorization')||'';
  if(!token)return false;
  const u=new URL(request.url);u.pathname='/api/pipeline/render-status/__session_probe__';u.search='';
  const probe=new Request(u.toString(),{method:'GET',headers:{'X-Ridge-Session':token.replace(/^Bearer\s+/i,'')}});
  const r=await base.fetch(probe,env,ctx);
  return r.status!==401;
}

export default{async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const u=new URL(request.url);
  if(u.pathname.startsWith('/api/pipeline/render-download/')&&request.method==='GET'&&u.searchParams.get('session')){
    const h=new Headers(request.headers);h.set('X-Ridge-Session',u.searchParams.get('session'));u.searchParams.delete('session');
    return base.fetch(new Request(u.toString(),{method:'GET',headers:h}),env,ctx);
  }
  if((u.pathname==='/api/pipeline/groq/transcribe'||u.pathname==='/api/pipeline/groq/analyze')&&!(await sessionValid(request,env,ctx)))return json({error:'Ridge/Vusic login session required'},401);
  return base.fetch(request,env,ctx);
}};
