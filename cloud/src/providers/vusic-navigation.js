export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export async function gotoVusic(page,url,{timeout=30000,settleMs=900,onSettled=null}={}){
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout});
  }catch(e){
    if(!/timeout/i.test(String(e?.message||e)))throw e;
    // Vusic keeps long-lived background requests open. A navigation timeout is
    // recoverable when a real document has loaded; the caller validates UI next.
    const ready=await page.evaluate(()=>!!document?.documentElement).catch(()=>false);
    if(!ready)throw e;
  }
  await sleep(settleMs);
  if(onSettled)await onSettled(page);
}

export async function waitVusicNavigation(page,{timeout=12000,settleMs=800,onSettled=null}={}){
  await page.waitForNavigation({waitUntil:'domcontentloaded',timeout}).catch(()=>{});
  await sleep(settleMs);
  if(onSettled)await onSettled(page);
}
