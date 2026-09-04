export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const isNavigationRace=e=>/execution context was destroyed|most likely because of a navigation|cannot find context|context.*destroyed|navigat/i.test(String(e?.message||e));

async function runSettled(page,onSettled,{attempts=6,baseDelay=350}={}){
  if(!onSettled)return;
  let last;
  for(let i=0;i<attempts;i++){
    try{return await onSettled(page)}
    catch(e){
      last=e;
      if(!isNavigationRace(e))throw e;
      await sleep(baseDelay*(i+1));
    }
  }
  throw last;
}

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
  await runSettled(page,onSettled);
}

export async function waitVusicNavigation(page,{timeout=12000,settleMs=800,onSettled=null}={}){
  await page.waitForNavigation({waitUntil:'domcontentloaded',timeout}).catch(()=>{});
  await sleep(settleMs);
  await runSettled(page,onSettled);
}
