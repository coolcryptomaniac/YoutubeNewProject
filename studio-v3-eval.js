(()=>{
  'use strict';
  const KEY='ridge.model-eval.v1',MAX=40,MIN_RATED=8,NVIDIA_PROMOTE=.75;
  const $=s=>document.querySelector(s);
  const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x.slice(-MAX):[]}catch{return []}};
  const write=x=>{try{localStorage.setItem(KEY,JSON.stringify(x.slice(-MAX)))}catch{}};
  const lang=()=>$('#language')?.value||'Unknown';
  const candidateReady=()=>!!$('#applyNvidia')&&!$('#applyNvidia').disabled;
  function summary(language=lang()){
    const all=read(),rows=all.filter(x=>x.language===language&&['groq','nvidia','tie'].includes(x.winner));
    const n=rows.filter(x=>x.winner==='nvidia').length,g=rows.filter(x=>x.winner==='groq').length,t=rows.filter(x=>x.winner==='tie').length,decisive=n+g;
    const rate=decisive?n/decisive:0,recommendation=rows.length>=MIN_RATED&&n>=6&&rate>=NVIDIA_PROMOTE?'prefer':'shadow';
    return {language,ratings:rows.length,nvidia:n,groq:g,ties:t,rate,recommendation,remaining:Math.max(0,MIN_RATED-rows.length)};
  }
  function update(){
    const s=summary(),state=$('#modelEvalState'),rec=$('#useModelRecommendation'),ready=candidateReady();
    for(const id of['rateGroq','rateNvidia','rateTie'])if($('#'+id))$('#'+id).disabled=!ready;
    if(state){
      state.textContent=s.ratings?`${s.language}: NVIDIA ${s.nvidia} · Groq ${s.groq} · tie ${s.ties}${s.remaining?` · rate ${s.remaining} more song${s.remaining===1?'':'s'}`:s.recommendation==='prefer'?' · evidence says Prefer NVIDIA':' · keep Shadow'}`:`No rated ${s.language} comparisons yet. Shadow mode will collect evidence without replacing Groq.`;
      state.dataset.kind=s.recommendation==='prefer'?'ok':'';
    }
    if(rec){rec.disabled=s.recommendation!=='prefer';rec.textContent=s.recommendation==='prefer'?`Use NVIDIA for ${s.language}`:'Use recommendation';}
  }
  function rate(winner){
    if(!candidateReady())return;
    const rows=read(),entry={id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:new Date().toISOString(),language:lang(),winner,title:String($('#title')?.value||'').slice(0,120),mode:$('#nvidiaMode')?.value||'shadow',note:String($('#nvidiaState')?.textContent||'').slice(0,320)};
    rows.push(entry);write(rows);
    if(winner==='nvidia')$('#applyNvidia')?.click();
    update();
  }
  async function deepTest(){
    const out=$('#cloudDeepState'),btn=$('#deepCloudTest'),base=String($('#cloudUrl')?.value||'').trim().replace(/\/+$/,'');
    if(!/^https:\/\//.test(base)){if(out)out.textContent='Add the Ridge Cloud endpoint first.';return}
    if(btn)btn.disabled=true;if(out)out.textContent='Testing health, Pexels and NVIDIA… HF video generation will NOT be called.';
    try{
      const timeout=ms=>AbortSignal.timeout(ms),healthRes=await fetch(base+'/api/health',{cache:'no-store',signal:timeout(12000)});if(!healthRes.ok)throw new Error(`health ${healthRes.status}`);const h=await healthRes.json();
      const pRes=await fetch(base+'/api/pexels/search?q='+encodeURIComponent('cinematic rain night')+'&orientation=landscape&per_page=1',{signal:timeout(15000)});if(!pRes.ok)throw new Error(`Pexels ${pRes.status}`);const p=await pRes.json();
      let nvidia='off';if(h.nvidia){
        const body={language:'Hindi',current:{title:'बारिश की रात',description:'बारिश की रात में बिछड़े प्रेम की याद लौटती है।',hashtags:['#music'],tags:['music'],clean_lyrics:'बारिश गिरती है\nतेरी याद लौटती है\nरात फिर वही कहानी कहती है',intro:'एक बारिश भरी रात',outro:'यादें रह जाती हैं',story:'बारिश वाली रात में बिछड़े प्रेम की याद',hook_meaning:'हर बूंद पुराने प्रेम की याद जगाती है'}};
        const nRes=await fetch(base+'/api/nvidia/refine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:timeout(55000)});const n=await nRes.json().catch(()=>({}));if(!nRes.ok)throw new Error(n.error||`NVIDIA ${nRes.status}`);nvidia=`✓ ${n.model||'ready'}`;
      }
      const clips=Array.isArray(p.videos)?p.videos.length:0;if(!clips)throw new Error('Pexels returned no test clip');
      if(out){out.textContent=`Live check passed · Pexels ✓ · NVIDIA ${nvidia} · HF token ${h.freeVideo?'✓':'off'} · free-only ${h.freeOnly?'✓':'check settings'}. No HF generation was spent.`;out.dataset.kind='ok'}
    }catch(e){if(out){out.textContent=`Live check found a problem: ${e.message}`;out.dataset.kind='warn'}}finally{if(btn)btn.disabled=false}
  }
  function init(){
    $('#rateGroq')?.addEventListener('click',()=>rate('groq'));$('#rateNvidia')?.addEventListener('click',()=>rate('nvidia'));$('#rateTie')?.addEventListener('click',()=>rate('tie'));
    $('#useModelRecommendation')?.addEventListener('click',()=>{const s=summary();if(s.recommendation!=='prefer')return;const x=$('#nvidiaMode');if(x){x.value='prefer';x.dispatchEvent(new Event('change',{bubbles:true}))}update()});
    $('#deepCloudTest')?.addEventListener('click',deepTest);$('#language')?.addEventListener('change',update);
    const apply=$('#applyNvidia'),nstate=$('#nvidiaState');if(apply)new MutationObserver(update).observe(apply,{attributes:true,attributeFilter:['disabled']});if(nstate)new MutationObserver(update).observe(nstate,{childList:true,characterData:true,subtree:true});
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();