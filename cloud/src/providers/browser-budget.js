import puppeteer from '@cloudflare/puppeteer';

const safeError=e=>String(e?.message||e||'unknown').slice(0,300);

export async function browserBudget(env){
  if(!env.BROWSER)return{ok:false,bound:false,error:'Browser Run binding unavailable'};
  const out={ok:true,bound:true};
  try{out.limits=await puppeteer.limits(env.BROWSER)}catch(e){out.limitsError=safeError(e)}
  try{out.sessions=await puppeteer.sessions(env.BROWSER)}catch(e){out.sessionsError=safeError(e)}
  try{out.history=(await puppeteer.history(env.BROWSER)).slice(-20)}catch(e){out.historyError=safeError(e)}
  const limits=out.limits||{};
  out.canLaunch=Number(limits.allowedBrowserAcquisitions||0)>0;
  out.timeUntilNextAllowedBrowserAcquisitionMs=Number(limits.timeUntilNextAllowedBrowserAcquisition||0);
  out.activeSessionCount=Array.isArray(limits.activeSessions)?limits.activeSessions.length:Array.isArray(out.sessions)?out.sessions.length:0;
  out.reusableSessions=(out.sessions||[]).filter(s=>!s.connectionId).map(s=>s.sessionId);
  return out;
}
