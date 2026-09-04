import puppeteer from '@cloudflare/puppeteer';
import {gotoVusic,waitVusicNavigation,retryVusicAction} from './vusic-navigation.js';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const defaults={login:'https://vusicstudio.com/?login=true',profile:'https://vusicstudio.com/profile',single:'https://vusicstudio.com/single-song-release'};

async function bodyText(page){return safe(await retryVusicAction(()=>page.evaluate(()=>document.body?.innerText||'')),24000)}
async function stableGoto(page,url,timeout=30000){await gotoVusic(page,url,{timeout,settleMs:700})}
async function stableNavigation(page,timeout=12000){await waitVusicNavigation(page,{timeout,settleMs:650}).catch(()=>{})}
async function first(page,selector,label){const el=await retryVusicAction(()=>page.$(selector));if(!el)throw new Error(`Vusic ${label} field not found`);return el}
async function fill(page,selector,value,label){const el=await first(page,selector,label);await el.click({clickCount:3});await page.keyboard.press('Backspace').catch(()=>{});await el.type(String(value),{delay:6})}
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const visibleExpr=`(()=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0})()`;

async function humanGate(page){
  const text=await bodyText(page),otp=await retryVusicAction(()=>page.$('input[autocomplete="one-time-code"],input[name*="otp" i],input[name*="code" i]'));
  if(otp||/captcha|verify you are human|security code|two[- ]factor|one[- ]time password|\botp\b/i.test(text))throw new Error('VUSIC_HUMAN_VERIFICATION_REQUIRED');
}

async function snapshot(page){return retryVusicAction(()=>page.evaluate(()=>{
  const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const inputs=[...document.querySelectorAll('input,textarea,select')].filter(visible).slice(0,24).map((e,index)=>({index,tag:e.tagName.toLowerCase(),type:e.type||'',name:e.name||'',id:e.id||'',placeholder:e.placeholder||'',aria:e.getAttribute('aria-label')||'',accept:e.getAttribute('accept')||'',files:e.files?.length||0,disabled:!!e.disabled,context:norm(e.closest('label,fieldset,section,article,div')?.innerText||'').slice(0,140)}));
  const buttons=[...document.querySelectorAll('button,[role="button"],a')].filter(visible).map((e,index)=>({index,text:norm(e.innerText||e.textContent).slice(0,100),disabled:!!(e.disabled||e.getAttribute('aria-disabled')==='true'),tag:e.tagName.toLowerCase()})).filter(x=>x.text).slice(0,40);
  const text=norm(document.body?.innerText||'');
  const notices=[...document.querySelectorAll('[role="alert"],.alert,.error,.success,.toast,[class*="error" i],[class*="success" i],[class*="upload" i],[class*="progress" i]')].filter(visible).map(e=>norm(e.innerText||e.textContent).slice(0,160)).filter(Boolean).slice(0,20);
  return{url:location.href,inputs,buttons,notices,textFlags:{uploading:/uploading|please wait|processing|progress/i.test(text),uploaded:/uploaded|upload complete|successfully uploaded|upload successful|ready/i.test(text),goLive:/go live date|release date|live date|previously released|already released/i.test(text),songDetails:/song title|song name|track title|genre|language/i.test(text),agreement:/agreement|signatory|sign the agreement/i.test(text)}};
}))}

async function findNext(page){return retryVusicAction(()=>page.evaluateHandle(()=>{
  const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
  const els=[...document.querySelectorAll('button,[role="button"],a')].filter(visible);
  return els.find(e=>['next step','next','continue','save & continue'].includes(norm(e.innerText||e.textContent)))||els.find(e=>/next|continue/i.test(norm(e.innerText||e.textContent)))||null;
}))}

async function attachRemoteFile(page,url,name,mime,kind){
  let last=null;
  for(let attempt=0;attempt<10;attempt++){
    last=await retryVusicAction(()=>page.evaluate(async({url,name,mime,kind})=>{
      const norm=s=>String(s||'').toLowerCase(),inputs=[...document.querySelectorAll('input[type="file"]')];
      const ranked=inputs.map((el,index)=>{let context='',p=el;for(let n=0;n<5&&p;n++,p=p.parentElement)context+=' '+(p.innerText||'');const hay=norm([el.accept,el.name,el.id,el.getAttribute('aria-label'),context].filter(Boolean).join(' '));let score=0;if(kind==='audio'){if(/audio|\.wav|\.mp3|mpeg|song|track|music|sound/.test(hay))score+=20;if(/image|artwork|cover|photo|\.png|\.jpg|jpeg/.test(hay))score-=20}else{if(/image|artwork|cover|photo|\.png|\.jpg|jpeg/.test(hay))score+=20;if(/audio|\.wav|\.mp3|mpeg|song|track|music|sound/.test(hay))score-=20}return{el,index,score}}).sort((a,b)=>b.score-a.score);
      const input=ranked[0]?.score>0?ranked[0].el:null;if(!input)return{ok:false,retry:true,count:inputs.length};
      const r=await fetch(url);if(!r.ok)return{ok:false,error:`media fetch ${r.status}`};const blob=await r.blob(),file=new File([blob],name,{type:mime||blob.type||'application/octet-stream'}),dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return{ok:true,size:file.size,type:file.type,index:ranked[0].index,files:input.files.length};
    },{url,name,mime,kind}));
    if(last?.ok)return last;if(!last?.retry)break;await sleep(500+attempt*250);
  }
  throw new Error(`VUSIC_${kind.toUpperCase()}_INPUT_NOT_FOUND:${JSON.stringify(last)}`);
}

async function waitUploadReady(page,{timeout=45000}={}){
  const start=Date.now();let last=null;
  while(Date.now()-start<timeout){
    await humanGate(page);last=await snapshot(page);
    const fileInputs=last.inputs.filter(x=>x.type==='file'),filesAttached=fileInputs.reduce((n,x)=>n+x.files,0);
    const next=last.buttons.find(x=>/^(next step|next|continue|save & continue)$/i.test(x.text))||last.buttons.find(x=>/next|continue/i.test(x.text));
    const uploadBusy=last.textFlags.uploading&&!last.textFlags.uploaded;
    if(filesAttached>=2&&next&&!next.disabled&&!uploadBusy)return{ready:true,filesAttached,next,last,waitMs:Date.now()-start};
    await sleep(750);
  }
  return{ready:false,last,waitMs:Date.now()-start};
}

async function clickNextAndVerify(page,before,{timeout=15000}={}){
  const handle=await findNext(page);const el=handle?.asElement?.();if(!el)throw new Error('VUSIC_NEXT_NOT_FOUND');
  const disabled=await el.evaluate(e=>!!(e.disabled||e.getAttribute('aria-disabled')==='true'));if(disabled)throw new Error('VUSIC_NEXT_DISABLED');
  await el.click();await stableNavigation(page,7000);await sleep(700);
  const start=Date.now();let after=null;
  while(Date.now()-start<timeout){
    await humanGate(page);after=await snapshot(page);
    const normalInputs=after.inputs.filter(x=>!['file','hidden','submit','button'].includes(String(x.type).toLowerCase()));
    const leftUploadStep=after.url!==before.url||after.textFlags.goLive||after.textFlags.songDetails||normalInputs.length>0||after.inputs.filter(x=>x.type==='file').length<before.inputs.filter(x=>x.type==='file').length;
    if(leftUploadStep)return{advanced:true,after,waitMs:Date.now()-start};
    await sleep(650);
  }
  return{advanced:false,after:after||await snapshot(page),waitMs:Date.now()-start};
}

export async function vusicWizardSmoke(env,input={}){
  if(!env.BROWSER||!env.VUSIC_USERNAME||!env.VUSIC_PASSWORD)return{ok:false,code:'VUSIC_NOT_CONFIGURED'};
  const audioUrl=safe(input.audioUrl,2200),artworkUrl=safe(input.artworkUrl,2200),expectedArtist=safe(input.expectedArtist,180);
  if(!audioUrl||!artworkUrl)return{ok:false,code:'VUSIC_MEDIA_REQUIRED'};
  let browser;
  try{
    browser=await puppeteer.launch(env.BROWSER);const page=await browser.newPage();
    await stableGoto(page,safe(env.VUSIC_LOGIN_URL||defaults.login,500));await fill(page,safe(env.VUSIC_LOGIN_USER_SELECTOR||'input[type="email"],input[name*="email" i],input[name*="user" i]',500),env.VUSIC_USERNAME,'email');await fill(page,safe(env.VUSIC_LOGIN_PASSWORD_SELECTOR||'input[type="password"]',500),env.VUSIC_PASSWORD,'password');const submit=await first(page,safe(env.VUSIC_LOGIN_SUBMIT_SELECTOR||'button[type="submit"],input[type="submit"]',500),'sign in');await submit.click();await stableNavigation(page);await sleep(900);await humanGate(page);
    if(expectedArtist){await stableGoto(page,safe(env.VUSIC_PROFILE_URL||defaults.profile,500));const text=await bodyText(page);if(!text.toLowerCase().includes(expectedArtist.toLowerCase()))return{ok:false,code:'VUSIC_ACCOUNT_MISMATCH'};}
    await stableGoto(page,safe(env.VUSIC_SINGLE_RELEASE_URL||defaults.single,500));await sleep(1200);await humanGate(page);
    const initial=await snapshot(page);
    const art=await attachRemoteFile(page,artworkUrl,safe(input.artworkName||'ridge-canary.png',180),safe(input.artworkType||'image/png',120),'image');await sleep(500);
    const audio=await attachRemoteFile(page,audioUrl,safe(input.audioName||'ridge-canary.wav',180),safe(input.audioType||'audio/wav',120),'audio');
    const readiness=await waitUploadReady(page,{timeout:45000});
    if(!readiness.ready)return{ok:false,code:'VUSIC_UPLOAD_NOT_READY',initial,art:{ok:art.ok,size:art.size},audio:{ok:audio.ok,size:audio.size},readiness};
    const transition=await clickNextAndVerify(page,readiness.last,{timeout:15000});
    if(!transition.advanced)return{ok:false,code:'VUSIC_WIZARD_STAGE_BLOCKED',initial,readiness:{ready:true,filesAttached:readiness.filesAttached,waitMs:readiness.waitMs},transition};
    return{ok:true,stage:'after-assets',initial,readiness:{ready:true,filesAttached:readiness.filesAttached,waitMs:readiness.waitMs},transition:{advanced:true,waitMs:transition.waitMs,after:transition.after},pageUrl:page.url()};
  }catch(e){return{ok:false,code:'VUSIC_WIZARD_SMOKE_FAILED',error:safe(e?.message||e,500)}
  }finally{if(browser)await browser.close().catch(()=>{})}
}
