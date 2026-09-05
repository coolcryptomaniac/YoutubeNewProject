from pathlib import Path

p = Path('cloud/src/providers/vusic.js')
s = p.read_text()
anchor = "function candidates(primary,fallback){return [...new Set([primary,...arr(fallback)].filter(Boolean))]}"
helper = r'''async function requireDateStage(page,{timeout=30000,maxReclicks=2}={}){
  const deadline=Date.now()+timeout;let reclicks=0,last=null,nextAttemptAt=Date.now()+4500;
  while(Date.now()<deadline){
    await sleep(650);await humanGate(page);
    last=await retryVusicAction(()=>page.evaluate(()=>{const visible=e=>{const st=getComputedStyle(e),r=e.getBoundingClientRect();return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0},norm=s=>String(s||'').trim().toLowerCase();const text=norm(document.body?.innerText||'');const inputs=[...document.querySelectorAll('input')];const dateInput=inputs.find(i=>{let context='';let n=i;for(let d=0;d<4&&n;d++,n=n.parentElement)context+=' '+(n.innerText||'');const hay=norm([i.type,i.id,i.name,i.placeholder,i.getAttribute('aria-label'),i.getAttribute('title'),context].filter(Boolean).join(' '));return i.type==='date'||/date for live|go live date|release date|date of release|live date|dd.?mm|mm.?dd|yyyy/.test(hay)});const assetStage=/artwork/.test(text)&&(/remove file/.test(text)||/pro tips/.test(text));const buttons=[...document.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible);const next=buttons.find(e=>['next step','next','continue','save & continue'].includes(norm(e.innerText||e.textContent||e.value))&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');return{ready:!!dateInput||/go live date|release date|date for live|date of release/.test(text),assetStage,nextReady:!!next,headings:[...document.querySelectorAll('h1,h2,h3,legend,[role="heading"]')].filter(visible).slice(0,12).map(x=>(x.innerText||x.textContent||'').trim().replace(/\s+/g,' ').slice(0,120))}}));
    if(last?.ready)return true;
    if(last?.assetStage&&last?.nextReady&&reclicks<maxReclicks&&Date.now()>=nextAttemptAt){
      const clicked=await retryVusicAction(()=>page.evaluate(()=>{const visible=e=>{const st=getComputedStyle(e),r=e.getBoundingClientRect();return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0},norm=s=>String(s||'').trim().toLowerCase();const e=[...document.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible).find(x=>['next step','next','continue','save & continue'].includes(norm(x.innerText||x.textContent||x.value))&&!x.disabled&&x.getAttribute('aria-disabled')!=='true');if(!e)return false;e.click();return true}));
      if(clicked){reclicks++;nextAttemptAt=Date.now()+5000;await stableNavigation(page,5000).catch(()=>{})}
    }
  }
  const snapshot=await formSnapshot(page).catch(()=>null);
  throw new VusicProviderError('Vusic stayed on the asset upload stage after Next Step',{status:503,code:'VUSIC_STAGE_BLOCKED',detail:{stage:'assets-to-go-live-date',reclicks,last,snapshot}});
}
'''

if 'async function requireDateStage' not in s:
    if anchor not in s:
        raise SystemExit('anchor missing')
    s = s.replace(anchor, helper + '\n' + anchor, 1)

old = "mark('assets');await next(page);\n    const releaseDate="
new = "mark('assets');await next(page);await requireDateStage(page);\n    const releaseDate="
if old in s:
    s = s.replace(old, new, 1)
elif "mark('assets');await next(page);await requireDateStage(page);" not in s:
    raise SystemExit('asset transition call site missing')

p.write_text(s)
print('Vusic asset-stage guard patched')
