import puppeteer from '@cloudflare/puppeteer';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export class VusicProviderError extends Error{
  constructor(message,{status=502,code='VUSIC_PROVIDER_ERROR',detail=null}={}){super(message);this.name='VusicProviderError';this.status=status;this.code=code;this.detail=detail;}
}

export function vusicCapabilities(env){
  return {
    configured:!!(env.BROWSER&&env.VUSIC_USERNAME&&env.VUSIC_PASSWORD&&env.VUSIC_LOGIN_URL&&env.VUSIC_NEW_RELEASE_URL),
    mode:'browser-automation',
    credentialsServerSide:true,
    browserBound:!!env.BROWSER,
    mediaStaging:!!env.RELEASE_MEDIA,
    note:'Uses Cloudflare Browser Run. CAPTCHA/OTP is never bypassed; Ridge stops for human verification.'
  };
}

async function first(page,selector,label){
  const el=await page.$(selector); if(!el) throw new VusicProviderError(`Vusic ${label} field was not found`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{selector,label}}); return el;
}
async function fill(page,selector,value,label){
  if(!value) return; const el=await first(page,selector,label); await el.click({clickCount:3}); await el.type(String(value),{delay:12});
}
async function choose(page,selector,value,label){
  if(!value) return; const el=await first(page,selector,label); await el.select(String(value));
}
async function click(page,selector,label){ const el=await first(page,selector,label); await el.click(); }

async function humanGate(page){
  const otp=await page.$('input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i]');
  const text=(await page.evaluate(()=>document.body?.innerText||'')).slice(0,12000);
  if(otp||/captcha|verify you are human|security code|two[- ]factor|one[- ]time password|otp/i.test(text)){
    throw new VusicProviderError('Vusic requires CAPTCHA/OTP or another human verification step',{status:409,code:'VUSIC_HUMAN_VERIFICATION_REQUIRED'});
  }
}

async function attachRemoteFile(page,selector,url,name,mime){
  if(!url) throw new VusicProviderError(`${name} staging URL is required`,{status:400,code:'VUSIC_MEDIA_REQUIRED'});
  const found=await page.$(selector); if(!found) throw new VusicProviderError(`Vusic ${name} upload field was not found`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{selector}});
  const result=await page.evaluate(async({selector,url,name,mime})=>{
    const input=document.querySelector(selector); if(!input) return {ok:false,error:'input missing'};
    const r=await fetch(url); if(!r.ok) return {ok:false,error:`media fetch ${r.status}`};
    const blob=await r.blob(); const file=new File([blob],name,{type:mime||blob.type||'application/octet-stream'});
    const dt=new DataTransfer(); dt.items.add(file); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); return {ok:true,size:file.size,type:file.type};
  },{selector,url,name,mime});
  if(!result?.ok) throw new VusicProviderError(`Could not attach ${name}: ${result?.error||'unknown error'}`,{status:502,code:'VUSIC_FILE_ATTACH_FAILED'});
  return result;
}

export async function distributeVusic(env,release={}){
  const caps=vusicCapabilities(env); if(!caps.configured) throw new VusicProviderError('Vusic browser automation is not fully configured',{status:503,code:'VUSIC_NOT_CONFIGURED',detail:caps});
  const title=safe(release.title,180),artist=safe(release.artist,180); if(!title||!artist) throw new VusicProviderError('title and artist are required',{status:400,code:'BAD_REQUEST'});
  const selectors={
    loginUser:safe(env.VUSIC_LOGIN_USER_SELECTOR||'input[type="email"],input[name*="email" i],input[name*="user" i]',500),
    loginPassword:safe(env.VUSIC_LOGIN_PASSWORD_SELECTOR||'input[type="password"]',500),
    loginSubmit:safe(env.VUSIC_LOGIN_SUBMIT_SELECTOR||'button[type="submit"],input[type="submit"]',500),
    title:safe(env.VUSIC_TITLE_SELECTOR||'input[name*="title" i]',500),
    artist:safe(env.VUSIC_ARTIST_SELECTOR||'input[name*="artist" i]',500),
    genre:safe(env.VUSIC_GENRE_SELECTOR||'select[name*="genre" i]',500),
    audio:safe(env.VUSIC_AUDIO_SELECTOR||'input[type="file"][accept*="audio"],input[name*="audio" i]',500),
    artwork:safe(env.VUSIC_ARTWORK_SELECTOR||'input[type="file"][accept*="image"],input[name*="art" i],input[name*="cover" i]',500),
    submit:safe(env.VUSIC_RELEASE_SUBMIT_SELECTOR||'button[type="submit"],input[type="submit"]',500)
  };
  let browser;
  try{
    browser=await puppeteer.launch(env.BROWSER); const page=await browser.newPage();
    await page.goto(env.VUSIC_LOGIN_URL,{waitUntil:'networkidle2',timeout:45000});
    await fill(page,selectors.loginUser,env.VUSIC_USERNAME,'username'); await fill(page,selectors.loginPassword,env.VUSIC_PASSWORD,'password');
    await click(page,selectors.loginSubmit,'login submit'); await page.waitForNavigation({waitUntil:'networkidle2',timeout:30000}).catch(()=>{}); await humanGate(page);
    await page.goto(env.VUSIC_NEW_RELEASE_URL,{waitUntil:'networkidle2',timeout:45000}); await humanGate(page);
    await fill(page,selectors.title,title,'title'); await fill(page,selectors.artist,artist,'artist');
    if(release.genre) await choose(page,selectors.genre,safe(release.genre,120),'genre').catch(()=>{});
    await attachRemoteFile(page,selectors.audio,safe(release.audioUrl,2000),safe(release.audioName||`${title}.mp3`,180),safe(release.audioType||'audio/mpeg',120));
    await attachRemoteFile(page,selectors.artwork,safe(release.artworkUrl,2000),safe(release.artworkName||`${title}-cover.jpg`,180),safe(release.artworkType||'image/jpeg',120));
    await sleep(900); await humanGate(page);
    if(release.dryRun===true){ return {ok:true,provider:'vusic-browser',dryRun:true,ready:true,title,artist}; }
    await click(page,selectors.submit,'release submit'); await page.waitForNavigation({waitUntil:'networkidle2',timeout:30000}).catch(()=>{}); await humanGate(page);
    const pageUrl=page.url(),text=safe(await page.evaluate(()=>document.body?.innerText||''),4000);
    const success=/submitted|success|release created|under review|processing|pending review/i.test(text);
    return {ok:success,provider:'vusic-browser',submitted:success,pageUrl,message:success?'Release submitted to Vusic':'Vusic form submitted; confirmation text was not recognized'};
  }catch(e){ if(e instanceof VusicProviderError) throw e; throw new VusicProviderError(safe(e?.message||e,500),{status:503,code:'VUSIC_BROWSER_FAILED'}); }
  finally{ if(browser) await browser.close().catch(()=>{}); }
}
