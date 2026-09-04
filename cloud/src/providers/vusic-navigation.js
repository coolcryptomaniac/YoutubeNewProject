export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export const isNavigationRace=e=>/execution context was destroyed|most likely because of a navigation|cannot find context|context.*destroyed|navigat/i.test(String(e?.message||e));

export async function retryVusicAction(fn,{attempts=6,baseDelay=350}={}){
  let last;
  for(let i=0;i<attempts;i++){
    try{return await fn()}
    catch(e){
      last=e;
      if(!isNavigationRace(e))throw e;
      await sleep(baseDelay*(i+1));
    }
  }
  throw last;
}

async function runSettled(page,onSettled,{attempts=6,baseDelay=350}={}){
  if(!onSettled)return;
  return retryVusicAction(()=>onSettled(page),{attempts,baseDelay});
}

export async function gotoVusic(page,url,{timeout=30000,settleMs=900,onSettled=null}={}){
  await retryVusicAction(async()=>{
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout});
    }catch(e){
      if(!/timeout/i.test(String(e?.message||e)))throw e;
      // Vusic keeps long-lived background requests open. A navigation timeout is
      // recoverable when a real document has loaded; the caller validates UI next.
      const ready=await retryVusicAction(()=>page.evaluate(()=>!!document?.documentElement),{attempts:3,baseDelay:250}).catch(()=>false);
      if(!ready)throw e;
    }
  },{attempts:3,baseDelay:400});
  await sleep(settleMs);
  await runSettled(page,onSettled);
}

export async function waitVusicNavigation(page,{timeout=12000,settleMs=800,onSettled=null}={}){
  await page.waitForNavigation({waitUntil:'domcontentloaded',timeout}).catch(()=>{});
  await sleep(settleMs);
  await runSettled(page,onSettled);
}
