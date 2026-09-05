from pathlib import Path

p = Path('cloud/src/providers/vusic.js')
s = p.read_text()
anchor = "function candidates(primary,fallback){return [...new Set([primary,...arr(fallback)].filter(Boolean))]}"
helper = r'''async function requireDateStage(page,{timeout=30000,maxReclicks=2}={}){
  const deadline=Date.now()+timeout;let reclicks=0,last=null,nextAttemptAt=Date.now()+4500;
  while(Date.now()<deadline){
    await sleep(650);await humanGate(page);
    last=await retryVusicAction(()=>page.evaluate(()=>{const visible=e=>{const st=getComputedStyle(e),r=e.getBoundingClientRect();return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0},norm=s=>String(s||'').trim().toLowerCase();const text=norm(document.body?.innerText||'');const inputs=[...document.querySelectorAll('input')];const dateInput=inputs.find(i=>{let context='';let n=i;for(let d=0;d<4&&n;d++,n=n.parentElement)context+=' '+(n.innerText||'');const hay=norm([i.type,i.id,i.name,i.placeholder,i.getAttribute('aria-label'),i.getAttribute('title'),context].filter(Boolean).join(' '));return i.type==='date'||/date for live|go live date|release date|date of release|live date|dd.?mm|mm.?dd|yyyy/.test(hay)});const assetStage=/artwork/.test(text)&&(/remove file/.test(text)||/pro tips/.test(text));const buttons=[...document.querySelectorAll('button,input[type="submit"],[role="button"]')].filter(visible);const next=buttons.find(e=>['next step','next','continue','save & continue'].includes(norm(e.innerText||e.textContent||e.value))&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');return{ready:!!dateInput,assetStage,nextReady:!!next,headings:[...document.querySelectorAll('h1,h2,h3,legend,[role="heading"]')].filter(visible).slice(0,12).map(x=>(x.innerText||x.textContent||'').trim().replace(/\s+/g,' ').slice(0,120))}}));
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

radio_helper = r'''async function chooseRadioNearQuestion(page,questionPatterns,values,label,{optional=false}={}){
  const questions=arr(questionPatterns).map(x=>String(x).toLowerCase()),choices=arr(values).map(x=>String(x).toLowerCase());
  const hit=await retryVusicAction(()=>page.evaluate(({questions,choices})=>{const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' '),visible=e=>{const st=getComputedStyle(e),r=e.getBoundingClientRect();return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0};const nodes=[...document.querySelectorAll('label,legend,p,span,div')].filter(visible);const q=nodes.find(n=>questions.some(x=>norm(n.innerText||n.textContent).includes(norm(x))));if(!q)return false;let box=q;for(let i=0;i<4&&box;i++,box=box.parentElement){const radios=[...box.querySelectorAll('input[type="radio"]')];const labels=[...box.querySelectorAll('label')].filter(visible);for(const choice of choices){const lab=labels.find(l=>norm(l.innerText||l.textContent)===norm(choice));if(lab){lab.click();return true}const radio=radios.find(r=>norm(r.value)===norm(choice)||norm(r.id).includes(norm(choice)));if(radio){radio.click();radio.dispatchEvent(new Event('change',{bubbles:true}));return true}}}return false},{questions,choices}));
  if(!hit&&!optional)throw new VusicProviderError(`Could not choose Vusic ${label}`,{status:503,code:'VUSIC_SELECTOR_MISMATCH',detail:{questionPatterns,values,url:page.url()}});
  return hit;
}
'''

if 'async function requireDateStage' not in s:
    if anchor not in s:
        raise SystemExit('anchor missing')
    s = s.replace(anchor, helper + '\n' + anchor, 1)
else:
    old_ready = "return{ready:!!dateInput||/go live date|release date|date for live|date of release/.test(text),assetStage"
    if old_ready in s:
        s = s.replace(old_ready, "return{ready:!!dateInput,assetStage", 1)

if 'async function chooseRadioNearQuestion' not in s:
    if anchor not in s:
        raise SystemExit('radio helper anchor missing')
    s = s.replace(anchor, radio_helper + '\n' + anchor, 1)

old = "mark('assets');await next(page);\n    const releaseDate="
new = "mark('assets');await next(page);await requireDateStage(page);\n    const releaseDate="
if old in s:
    s = s.replace(old, new, 1)
elif "mark('assets');await next(page);await requireDateStage(page);" not in s:
    raise SystemExit('asset transition call site missing')

needle = "await chooseField(page,['language','song language'],languageValues,'language',{optional:true});await chooseField(page,['explicit','explicit content'],release.explicitContent?['Yes','Explicit']:fb.explicitContent,'explicit content',{optional:true});"
replacement = "await chooseField(page,['language','song language'],languageValues,'language',{optional:true});await chooseField(page,['sub-genre','sub genre','subcategory'],candidates(safe(release.subGenre||genreKey,80),genreValues),'sub-genre',{optional:false});await chooseField(page,['mood'],candidates(safe(release.mood||'Calm',80),['Calm','Passion','Inspirational']),'mood',{optional:false});await chooseField(page,['registered label','label'],candidates(safe(release.label||'Vusic Records',180),['Vusic Records']),'registered label',{optional:false});await chooseRadioNearQuestion(page,['I Want To Use My Own ISRC Code','own isrc'],['No'],'own ISRC',{optional:false});await chooseRadioNearQuestion(page,['Is your track Adult 18+','Adult 18+'],release.explicitContent?['Yes']:['No'],'Adult 18+',{optional:false});await chooseField(page,['explicit','explicit content'],release.explicitContent?['Yes','Explicit']:fb.explicitContent,'explicit content',{optional:true});"
if needle in s:
    s = s.replace(needle, replacement, 1)
elif "'sub-genre'" not in s:
    raise SystemExit('song details insertion point missing')

p.write_text(s)
print('Vusic required song-detail fields patched')
