import base from './worker-v2.js';
import {createDirectorPlan,directorCapabilities,DirectorError} from './providers/director.js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type,Authorization,Range','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...cors,...extra}});

function directorError(e){
  if(e instanceof DirectorError)return json({error:e.message,code:e.code,detail:e.detail||undefined},e.status||503);
  return json({error:String(e?.message||e).slice(0,400),code:'DIRECTOR_INTERNAL'},503);
}

export default {async fetch(request,env,ctx){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const u=new URL(request.url);
  if(u.pathname==='/api/director/capabilities'&&request.method==='GET')return json(directorCapabilities(env));
  if(u.pathname==='/api/director/plan'&&request.method==='POST'){
    try{return json(await createDirectorPlan(env,await request.json().catch(()=>({}))));}
    catch(e){return directorError(e);}
  }
  return base.fetch(request,env,ctx);
}};
