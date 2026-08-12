import puppeteer from '@cloudflare/puppeteer';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export class VusicProviderError extends Error{
  constructor(message,{status=502,code='VUSIC_PROVIDER_ERROR',detail=null}={}){super(message);this.name='VusicProviderError';this.status=status;this.code=code;this.detail=detail;}
}

const defaults={
  login:'https://vusicstudio.com/?login=true',
  dashboard:'https://vusicstudio.com/dashboard',
  release:'https://vusicstudio.com/song-release',
  single:'https://vusicstudio.com/single-song'
};

export function vusicCapabilities(env){
  return {
    configured:!!(env.BROWSER&&env.VUSIC_USERNAME&&env.VUSIC_PASSWORD),
    mode:'browser-automation',credentialsServerSide:true,browserBound:!!env.BROWSER,mediaStaging:!!env.RELEASE_MEDIA,
    workflow:['login','create-release','single','assets','go-live-date','song-details','artist','platforms','agreement','review'],
    note:'Anchored to VusicStudio single-release wizard. CAPTCHA/OTP is never bypassed; Ridge stops for human verification.'
  };
}

async function first(page,selector,label){const el=await page.$(selector);if(!el)throw new VusicProviderError(`Vusic ${label} field was not found`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{selector,label,url:page.url()}});return el;}
async function fill(page,selector,value,label){if(!value)return;const el=await first(page,selector,label);await el.click({clickCount:3});await page.keyboard.press('Backspace').catch(()=>{});await el.type(String(value),{delay:8});}
async function click(page,selector,label){const el=await first(page,selector,label);await el.click();}
async function bodyText(page){return safe(await page.evaluate(()=>document.body?.innerText||''),16000)}
async function humanGate(page){const otp=await page.$('input[autocomplete="one-time-code"],input[name*="otp" i],input[name*="code" i]');const text=await bodyText(page);if(otp||/captcha|verify you are human|security code|two[- ]factor|one[- ]time password|\botp\b/i.test(text))throw new VusicProviderError('Vusic requires CAPTCHA/OTP or another human verification step',{status:409,code:'VUSIC_HUMAN_VERIFICATION_REQUIRED',detail:{url:page.url()}});}
async function settle(page,ms=800){await sleep(ms);await humanGate(page);}

async function clickText(page,patterns,label,{optional=false}={}){
  const list=(Array.isArray(patterns)?patterns:[patterns]).map(x=>String(x).toLowerCase());
  const hit=await page.evaluate((needles)=>{
    const els=[...document.querySelectorAll('button,a,[role="button"],label,span,div')];
    const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&r.height>0};
    const score=e=>{const t=(e.innerText||e.textContent||'').trim().toLowerCase();if(!t)return -1;let n=needles.findIndex(x=>t===x);if(n>=0)return 100-n; n=needles.findIndex(x=>t.includes(x));return n>=0?50-n:-1};
    const ranked=els.filter(visible).map(e=>({e,s:score(e)})).filter(x=>x.s>=0).sort((a,b)=>b.s-a.s);
    const el=ranked[0]?.e;if(!el)return false;el.click();return true;
  },list);
  if(!hit&&!optional)throw new VusicProviderError(`Could not find Vusic ${label}`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{patterns,url:page.url()}});return hit;
}

async function inputByLabel(page,labelPatterns,value,{optional=false,type=null}={}){
  if(value==null||value==='')return false;
  const patterns=(Array.isArray(labelPatterns)?labelPatterns:[labelPatterns]).map(x=>String(x).toLowerCase());
  const found=await page.evaluate(({patterns,value,type})=>{
    const norm=s=>String(s||'').trim().toLowerCase();
    const inputs=[...document.querySelectorAll(type?`input[type="${type}"]`:'input,textarea')];
    let target=null;
    for(const label of document.querySelectorAll('label')){
      const t=norm(label.innerText||label.textContent);if(!patterns.some(p=>t.includes(p)))continue;
      target=label.htmlFor?document.getElementById(label.htmlFor):label.querySelector('input,textarea')||label.parentElement?.querySelector('input,textarea');if(target)break;
    }
    if(!target){target=inputs.find(i=>patterns.some(p=>norm(i.placeholder).includes(p)||norm(i.name).includes(p)||norm(i.id).includes(p)))||null;}
    if(!target)return false;const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target),'value')?.set;setter?setter.call(target,String(value)):target.value=String(value);target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));return true;
  },{patterns,value:String(value),type});
  if(!found&&!optional)throw new VusicProviderError(`Could not fill Vusic field: ${patterns[0]}`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{url:page.url()}});return found;
}

async function selectByLabel(page,labelPatterns,value,{optional=false}={}){
  if(!value)return false;const patterns=(Array.isArray(labelPatterns)?labelPatterns:[labelPatterns]).map(x=>String(x).toLowerCase());
  const found=await page.evaluate(({patterns,value})=>{
    const norm=s=>String(s||'').trim().toLowerCase();let target=null;
    for(const label of document.querySelectorAll('label')){const t=norm(label.innerText||label.textContent);if(!patterns.some(p=>t.includes(p)))continue;target=label.htmlFor?document.getElementById(label.htmlFor):label.parentElement?.querySelector('select');if(target)break;}
    if(!target)target=[...document.querySelectorAll('select')].find(s=>patterns.some(p=>norm(s.name).includes(p)||norm(s.id).includes(p)))||null;if(!target)return false;
    const opt=[...target.options].find(o=>norm(o.textContent)===norm(value)||norm(o.textContent).includes(norm(value)));if(!opt)return false;target.value=opt.value;target.dispatchEvent(new Event('change',{bubbles:true}));return true;
  },{patterns,value:String(value)});
  if(!found&&!optional)throw new VusicProviderError(`Could not select Vusic field: ${patterns[0]}`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{value,url:page.url()}});return found;
}

async function radioByText(page,text){return page.evaluate((want)=>{const norm=s=>String(s||'').trim().toLowerCase(),w=norm(want);for(const l of document.querySelectorAll('label')){if(norm(l.innerText||l.textContent)!==w&&!norm(l.innerText||l.textContent).includes(w))continue;const el=l.htmlFor?document.getElementById(l.htmlFor):l.querySelector('input[type="radio"],input[type="checkbox"]')||l.parentElement?.querySelector('input[type="radio"],input[type="checkbox"]');if(el){el.click();return true}l.click();return true}return false;},String(text));}

async function attachRemoteFile(page,selector,url,name,mime){
  if(!url)throw new VusicProviderError(`${name} staging URL is required`,{status:400,code:'VUSIC_MEDIA_REQUIRED'});const found=await page.$(selector);if(!found)throw new VusicProviderError(`Vusic ${name} upload field was not found`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{selector,url:page.url()}});
  const result=await page.evaluate(async({selector,url,name,mime})=>{const input=document.querySelector(selector);if(!input)return{ok:false,error:'input missing'};const r=await fetch(url);if(!r.ok)return{ok:false,error:`media fetch ${r.status}`};const blob=await r.blob(),file=new File([blob],name,{type:mime||blob.type||'application/octet-stream'}),dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return{ok:true,size:file.size,type:file.type};},{selector,url,name,mime});
  if(!result?.ok)throw new VusicProviderError(`Could not attach ${name}: ${result?.error||'unknown error'}`,{status:502,code:'VUSIC_FILE_ATTACH_FAILED'});return result;
}

async function next(page){await clickText(page,['next step','next'],'Next Step');await settle(page,900);}

export async function distributeVusic(env,release={}){
  const caps=vusicCapabilities(env);if(!caps.configured)throw new VusicProviderError('Vusic browser automation is not fully configured',{status:503,code:'VUSIC_NOT_CONFIGURED',detail:caps});
  const title=safe(release.title,180),artist=safe(release.artist||release.primaryArtist,180);if(!title||!artist)throw new VusicProviderError('title and primary artist are required',{status:400,code:'BAD_REQUEST'});
  const urls={login:safe(env.VUSIC_LOGIN_URL||defaults.login,500),release:safe(env.VUSIC_NEW_RELEASE_URL||defaults.release,500),single:safe(env.VUSIC_SINGLE_RELEASE_URL||defaults.single,500)};
  const selectors={loginUser:safe(env.VUSIC_LOGIN_USER_SELECTOR||'input[type="email"],input[name*="email" i],input[name*="user" i]',500),loginPassword:safe(env.VUSIC_LOGIN_PASSWORD_SELECTOR||'input[type="password"]',500),loginSubmit:safe(env.VUSIC_LOGIN_SUBMIT_SELECTOR||'button[type="submit"],input[type="submit"]',500),audio:safe(env.VUSIC_AUDIO_SELECTOR||'input[type="file"][accept*="audio"],input[name*="audio" i]',500),artwork:safe(env.VUSIC_ARTWORK_SELECTOR||'input[type="file"][accept*="image"],input[name*="art" i],input[name*="cover" i]',500)};
  let browser;const steps=[];const mark=(step)=>steps.push({step,url:pageRef?.url?.()||''});let pageRef=null;
  try{
    browser=await puppeteer.launch(env.BROWSER);const page=pageRef=await browser.newPage();
    await page.goto(urls.login,{waitUntil:'networkidle2',timeout:45000});await fill(page,selectors.loginUser,env.VUSIC_USERNAME,'email');await fill(page,selectors.loginPassword,env.VUSIC_PASSWORD,'password');await click(page,selectors.loginSubmit,'Sign In');await page.waitForNavigation({waitUntil:'networkidle2',timeout:30000}).catch(()=>{});await settle(page);mark('login');
    await page.goto(urls.release,{waitUntil:'networkidle2',timeout:45000});await settle(page);await clickText(page,['upload single','single'],'Upload Single');await page.waitForNavigation({waitUntil:'networkidle2',timeout:20000}).catch(()=>{});await settle(page);if(!/single-song/i.test(page.url()))await page.goto(urls.single,{waitUntil:'networkidle2',timeout:45000});mark('single');

    await attachRemoteFile(page,selectors.artwork,safe(release.artworkUrl,2000),safe(release.artworkName||`${title}-cover.jpg`,180),safe(release.artworkType||'image/jpeg',120));await attachRemoteFile(page,selectors.audio,safe(release.audioUrl,2000),safe(release.audioName||`${title}.wav`,180),safe(release.audioType||'audio/wav',120));await settle(page,1200);mark('assets');await next(page);

    const releaseDate=safe(release.releaseDate||release.goLiveDate,30);if(releaseDate)await inputByLabel(page,['go live date','release date'],releaseDate,{type:'date'}).catch(()=>inputByLabel(page,['go live date','release date'],releaseDate));
    if(release.releasedPreviously===true)await radioByText(page,'Yes');else await radioByText(page,'No');mark('go-live-date');await next(page);

    await inputByLabel(page,['song title','title'],title);if(release.genre){const done=await selectByLabel(page,['genre'],safe(release.genre,120),{optional:true});if(!done){await clickText(page,['genre'],'Genre',{optional:true});await clickText(page,[release.genre],`genre ${release.genre}`,{optional:true});}}
    await inputByLabel(page,['lyrics','song lyrics'],safe(release.lyrics,12000),{optional:true});await inputByLabel(page,['composer'],safe(release.composer||artist,180),{optional:true});await inputByLabel(page,['lyricist','lyrics writer','writer'],safe(release.lyricist||artist,180),{optional:true});mark('song-details');await next(page);

    const primary=safe(release.primaryArtist||artist,180);const nativeArtist=await selectByLabel(page,['primary artist','artist'],primary,{optional:true});if(!nativeArtist){await clickText(page,['primary artist','select artist','artist'],'Primary Artist',{optional:true});await clickText(page,[primary],`artist ${primary}`,{optional:true});}
    await inputByLabel(page,['composer'],safe(release.composer||artist,180),{optional:true});await inputByLabel(page,['lyricist','lyrics writer'],safe(release.lyricist||artist,180),{optional:true});mark('artist');await next(page);

    if(Array.isArray(release.platforms)&&release.platforms.length){for(const p of release.platforms)await clickText(page,[p],`platform ${p}`,{optional:true});}else await clickText(page,['select all','all platforms'],'Select all platforms',{optional:true});mark('platforms');await next(page);

    const signed=await radioByText(page,'I agree')||await radioByText(page,'Sign the agreement')||await clickText(page,['sign the agreement','i agree','agree'],'agreement',{optional:true});if(!signed)throw new VusicProviderError('Could not sign Vusic agreement',{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{url:page.url()}});mark('agreement');await next(page);

    mark('review');if(release.dryRun===true||release.confirmSubmit!==true)return{ok:true,provider:'vusic-browser',dryRun:true,readyToSubmit:true,title,artist,steps,pageUrl:page.url(),message:'Vusic wizard completed through Review; final submission not sent'};
    const submitted=await clickText(page,['submit release','submit','release now','confirm','enter'],'final submit',{optional:true});if(!submitted)throw new VusicProviderError('Vusic final submit control was not found',{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{url:page.url()}});await page.waitForNavigation({waitUntil:'networkidle2',timeout:30000}).catch(()=>{});await settle(page,1200);
    const text=await bodyText(page),success=/submitted|success|release created|under review|processing|pending review|thank you/i.test(text);return{ok:success,provider:'vusic-browser',submitted:success,pageUrl:page.url(),steps,message:success?'Release submitted to Vusic':'Final submit was clicked; confirmation text was not recognized'};
  }catch(e){if(e instanceof VusicProviderError)throw e;throw new VusicProviderError(safe(e?.message||e,500),{status:503,code:'VUSIC_BROWSER_FAILED',detail:{steps}});}finally{if(browser)await browser.close().catch(()=>{});}
}
