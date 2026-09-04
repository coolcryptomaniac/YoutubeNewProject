'use strict';

const ISSUER='https://token.actions.githubusercontent.com';
const JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const REPOSITORY='coolcryptomaniac/YoutubeNewProject';
const REPOSITORY_ID='1321897216';
const enc=new TextEncoder(),dec=new TextDecoder();
let cache={expires:0,keys:[]};

const b64bytes=s=>{
  const p=String(s||'').replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(p+'='.repeat((4-p.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
};
const b64json=s=>JSON.parse(dec.decode(b64bytes(s)));
const bearer=request=>(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();

async function jwks(force=false){
  if(!force&&cache.keys.length&&cache.expires>Date.now())return cache.keys;
  const r=await fetch(JWKS_URL,{headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`GitHub OIDC JWKS ${r.status}`);
  const j=await r.json();cache={keys:Array.isArray(j.keys)?j.keys:[],expires:Date.now()+60*60*1000};return cache.keys;
}
async function signingKey(kid){
  let keys=await jwks(false),jwk=keys.find(x=>x.kid===kid);
  if(!jwk){keys=await jwks(true);jwk=keys.find(x=>x.kid===kid)}
  if(!jwk)throw new Error('GitHub OIDC signing key not found');
  return crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
}
const audMatches=(claim,want)=>Array.isArray(claim)?claim.includes(want):claim===want;

export async function verifyGitHubOidc(request,{audience,workflow,events=['schedule','workflow_dispatch']}={}){
  const token=bearer(request);if(!token)return null;
  try{
    const parts=token.split('.');if(parts.length!==3)return null;
    const [h,p,s]=parts,header=b64json(h),claims=b64json(p);
    if(header.alg!=='RS256'||!header.kid)return null;
    const now=Math.floor(Date.now()/1000),exp=Number(claims.exp||0),nbf=Number(claims.nbf||0),iat=Number(claims.iat||0);
    if(claims.iss!==ISSUER||!audMatches(claims.aud,audience))return null;
    if(!exp||exp<now-30||exp>now+15*60)return null;
    if(nbf&&nbf>now+30)return null;if(iat&&iat>now+30)return null;
    if(claims.repository!==REPOSITORY||String(claims.repository_id||'')!==REPOSITORY_ID)return null;
    if(claims.ref!=='refs/heads/main')return null;
    if(workflow&&claims.workflow_ref!==`${REPOSITORY}/.github/workflows/${workflow}@refs/heads/main`)return null;
    if(events?.length&&!events.includes(claims.event_name))return null;
    const key=await signingKey(header.kid),ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64bytes(s),enc.encode(`${h}.${p}`));
    return ok?claims:null;
  }catch{return null}
}

export function isAdmin(request,env){
  const token=bearer(request);return !!env.RIDGE_ADMIN_TOKEN&&token===String(env.RIDGE_ADMIN_TOKEN);
}

export async function authorizeAutomation(request,env,spec){
  if(isAdmin(request,env))return {type:'admin'};
  const claims=await verifyGitHubOidc(request,spec);return claims?{type:'github-oidc',claims}:null;
}

export const GITHUB_OIDC_INFO=Object.freeze({issuer:ISSUER,jwks:JWKS_URL,repository:REPOSITORY,repositoryId:REPOSITORY_ID});
