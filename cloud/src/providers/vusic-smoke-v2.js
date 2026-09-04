import puppeteer from '@cloudflare/puppeteer';
import {gotoVusic,waitVusicNavigation} from './vusic-navigation.js';

const safe=(v,n=500)=>String(v??'').trim().slice(0,n);

export function vusicBindingStatus(env){
  const browser=env.BROWSER||env.MY_BINDING||null;
  return {
    browserBound:!!browser,
    browserBinding:env.BROWSER?'BROWSER':env.MY_BINDING?'MY_BINDING':null,
    usernamePresent:!!env.VUSIC_USERNAME,
    passwordPresent:!!env.VUSIC_PASSWORD,
    configured:!!(browser&&env.VUSIC_USERNAME&&env.VUSIC_PASSWORD)
  };
}

export async function smokeVusicLogin(env){
  const status=vusicBindingStatus(env);
  if(!status.configured)throw new Error('Vusic login smoke is not configured');
  const browserBinding=env.BROWSER||env.MY_BINDING;
  let browser;
  try{
    browser=await puppeteer.launch(browserBinding);
    const page=await browser.newPage();
    await gotoVusic(page,env.VUSIC_LOGIN_URL||'https://vusicstudio.com/?login=true',{timeout:30000,settleMs:900});
    const userSel=env.VUSIC_LOGIN_USER_SELECTOR||'input[type="email"],input[name*="email" i],input[name*="user" i]';
    const passSel=env.VUSIC_LOGIN_PASSWORD_SELECTOR||'input[type="password"]';
    const submitSel=env.VUSIC_LOGIN_SUBMIT_SELECTOR||'button[type="submit"],input[type="submit"]';
    const user=await page.$(userSel),pass=await page.$(passSel),submit=await page.$(submitSel);
    if(!user||!pass||!submit)throw new Error('Vusic login fields could not be detected');
    await user.click({clickCount:3});await user.type(String(env.VUSIC_USERNAME),{delay:5});
    await pass.click({clickCount:3});await pass.type(String(env.VUSIC_PASSWORD),{delay:5});
    await submit.click();
    await waitVusicNavigation(page,{timeout:12000,settleMs:900});
    const text=safe(await page.evaluate(()=>document.body?.innerText||''),12000),url=page.url();
    if(/captcha|verify you are human|one[- ]time password|security code|\botp\b/i.test(text))return {ok:false,humanVerification:true,url};
    const stillLogin=/login=true/i.test(url)||(/sign in|login/i.test(text)&&!!(await page.$(passSel)));
    if(stillLogin)return {ok:false,authenticated:false,url,message:'Vusic remained on the login page'};
    await gotoVusic(page,env.VUSIC_NEW_RELEASE_URL||'https://vusicstudio.com/song-release',{timeout:30000,settleMs:900});
    const releaseUrl=page.url(),releaseText=safe(await page.evaluate(()=>document.body?.innerText||''),8000);
    const releaseAccessible=!/login=true/i.test(releaseUrl)&&/release|upload single|single/i.test(releaseText);
    return {ok:releaseAccessible,authenticated:true,releaseAccessible,url:releaseUrl,browserBinding:status.browserBinding,navigationMode:'domcontentloaded-bounded'};
  }finally{if(browser)await browser.close().catch(()=>{});}
}
