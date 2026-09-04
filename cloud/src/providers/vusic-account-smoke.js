import puppeteer from '@cloudflare/puppeteer';
import {gotoVusic,waitVusicNavigation,retryVusicAction} from './vusic-navigation.js';

const safe=(v,n=4000)=>String(v??'').trim().slice(0,n);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const urls={
  login:'https://vusicstudio.com/?login=true',
  profile:'https://vusicstudio.com/profile',
  dashboard:'https://vusicstudio.com/dashboard',
  single:'https://vusicstudio.com/single-song-release'
};

async function bodyText(page){return safe(await retryVusicAction(()=>page.evaluate(()=>document.body?.innerText||'')),24000)}
async function stableGoto(page,url,timeout=30000){await gotoVusic(page,url,{timeout,settleMs:700})}
async function stableNavigation(page,timeout=12000){await waitVusicNavigation(page,{timeout,settleMs:700})}
async function first(page,selector,label){const el=await retryVusicAction(()=>page.$(selector));if(!el)throw new Error(`Vusic ${label} field not found`);return el}
async function fill(page,selector,value,label){const el=await first(page,selector,label);await el.click({clickCount:3});await page.keyboard.press('Backspace').catch(()=>{});await el.type(String(value),{delay:6})}
async function poll(page,test,{timeout=12000,interval=500}={}){const start=Date.now();let text='';while(Date.now()-start<timeout){text=await bodyText(page);if(test(text))return text;await sleep(interval)}return text}
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function planSummary(text){
  const flat=clean(text),plans=['Annual Unlimited Artist','Unlimited Artist','Artist Unlimited','Pay Per Release','Annual Unlimited Label','Unlimited Label'];
  const plan=plans.find(p=>flat.toLowerCase().includes(p.toLowerCase()))||null;
  const active=/\bACTIVE\b|Current Active/i.test(flat);
  const expired=/\bEXPIRED\b|Plan Expired/i.test(flat);
  const valid=(flat.match(/Valid\s*(?:Upto|Until|Through)\s*[:\-]?\s*([0-9A-Za-z /.-]{6,24})/i)||[])[1]||null;
  return{plan,active,expired,validThrough:valid?clean(valid).slice(0,24):null};
}

export async function vusicAccountSmoke(env,input={}){
  if(!env.BROWSER||!env.VUSIC_USERNAME||!env.VUSIC_PASSWORD)return{ok:false,code:'VUSIC_NOT_CONFIGURED',configured:false};
  const expectedArtist=safe(input.expectedArtist,180);
  let browser;
  try{
    browser=await puppeteer.launch(env.BROWSER);const page=await browser.newPage();
    await stableGoto(page,safe(env.VUSIC_LOGIN_URL||urls.login,500));
    await fill(page,safe(env.VUSIC_LOGIN_USER_SELECTOR||'input[type="email"],input[name*="email" i],input[name*="user" i]',500),env.VUSIC_USERNAME,'email');
    await fill(page,safe(env.VUSIC_LOGIN_PASSWORD_SELECTOR||'input[type="password"]',500),env.VUSIC_PASSWORD,'password');
    const submit=await first(page,safe(env.VUSIC_LOGIN_SUBMIT_SELECTOR||'button[type="submit"],input[type="submit"]',500),'sign in');await submit.click();
    await stableNavigation(page).catch(()=>{});await sleep(900);

    await stableGoto(page,safe(env.VUSIC_PROFILE_URL||urls.profile,500));
    const profileText=await poll(page,t=>/Profile Information|Authorized Signatory|Personal Information/i.test(t),{timeout:14000});
    const profileReady=/Profile Information|Authorized Signatory|Personal Information/i.test(profileText);
    const expectedArtistMatch=expectedArtist?profileText.toLowerCase().includes(expectedArtist.toLowerCase()):null;
    const profilePlan=planSummary(profileText);
    if(!profileReady)return{ok:false,code:'VUSIC_PROFILE_NOT_READY',profileReady:false,pageUrl:page.url(),profilePlan};
    if(expectedArtist&&expectedArtistMatch===false)return{ok:false,code:'VUSIC_ACCOUNT_MISMATCH',profileReady:true,expectedArtistMatch:false,pageUrl:page.url(),profilePlan};

    await stableGoto(page,safe(env.VUSIC_DASHBOARD_URL||urls.dashboard,500));
    const dashboardText=await poll(page,t=>/Create New Release|My Music Business|My Earnings|Current Active|View all plans/i.test(t),{timeout:10000});
    const dashboardPlan=planSummary(dashboardText);

    await stableGoto(page,safe(env.VUSIC_SINGLE_RELEASE_URL||urls.single,500));
    const releaseText=await poll(page,async()=>false,{timeout:2200,interval:550});
    const releaseState=await retryVusicAction(()=>page.evaluate(()=>({
      fileInputs:document.querySelectorAll('input[type="file"]').length,
      visibleInputs:[...document.querySelectorAll('input,textarea,select')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}).length,
      hasCreate:/Create New Release/i.test(document.body?.innerText||''),
      hasCheckPlan:/Check Plan|View all plans/i.test(document.body?.innerText||''),
      hasCurrentPlan:/Current Plan|Current Active/i.test(document.body?.innerText||'')
    })));

    return{ok:true,configured:true,profileReady:true,expectedArtistMatch,profilePlan,dashboardPlan,releaseState,pageUrl:page.url(),releasePlan:planSummary(releaseText)};
  }catch(e){return{ok:false,code:'VUSIC_ACCOUNT_SMOKE_FAILED',error:safe(e?.message||e,500)}
  }finally{if(browser)await browser.close().catch(()=>{})}
}
