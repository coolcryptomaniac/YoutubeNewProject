'use strict';

export const finite=(v,d=0)=>{const n=Number(v);return Number.isFinite(n)?n:d;};
export const clamp=(v,a=0,b=1)=>{const n=finite(v,a);return Math.max(a,Math.min(b,n));};
export const unit=(v,d=0)=>clamp(finite(v,d),0,1);

export function audioBands(freq, fallback={low:.18,mid:.12,high:.08,energy:.12}){
  if(!freq?.length)return sanitizeBands(fallback);
  const len=freq.length;
  const avg=(a,b)=>{
    const start=Math.max(0,Math.floor(finite(a,0)));
    const end=Math.min(len,Math.max(start+1,Math.ceil(finite(b,start+1))));
    let sum=0,n=0;
    for(let i=start;i<end;i++){
      const x=finite(freq[i],0)/255;
      sum+=x;n++;
    }
    return n?unit(sum/n):0;
  };
  const low=avg(1,len*.08),mid=avg(len*.08,len*.35),high=avg(len*.35,len*.82);
  return sanitizeBands({low,mid,high,energy:low*.45+mid*.35+high*.20});
}

export function sanitizeBands(b={}){
  const low=unit(b.low,.18),mid=unit(b.mid,.12),high=unit(b.high,.08);
  return {low,mid,high,energy:unit(b.energy,low*.45+mid*.35+high*.20)};
}

export function sanitizeRenderState(s={}){
  return {
    ...s,
    time:Math.max(0,finite(s.time,0)),
    progress:unit(s.progress,0),
    ...sanitizeBands(s),
  };
}

export function rgbaFromHex(hex,alpha=1){
  const a=unit(alpha,1);
  const h=String(hex||'').replace('#','').trim();
  if(!/^[0-9a-fA-F]{6}$/.test(h))return `rgba(255,255,255,${a})`;
  const n=parseInt(h,16);
  return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;
}

function cleanLyricLines(text=''){
  return String(text||'')
    .replace(/\r/g,'')
    .split('\n')
    .map(x=>x.trim())
    .filter(Boolean)
    .map(line=>({raw:line,isSection:/^\[[^\]]+\]$/.test(line)}));
}

export function buildLyricsTimeline(text,duration,{intro=.04,outro=.03,minLine=1.6,maxLine=7}={}){
  const total=Math.max(0,finite(duration,0));
  const src=cleanLyricLines(text);
  const sung=src.filter(x=>!x.isSection);
  if(!total||!sung.length)return [];
  const usable=Math.max(total*.45,total*(1-unit(intro)-unit(outro)));
  const start=total*unit(intro),weights=sung.map(x=>Math.max(2,Math.min(18,x.raw.split(/\s+/).length)));
  const sum=weights.reduce((a,b)=>a+b,0)||1;
  const rawDur=weights.map(w=>clamp(usable*w/sum,minLine,maxLine));
  const scale=usable/(rawDur.reduce((a,b)=>a+b,0)||usable);
  let t=start,section='';
  const out=[];
  for(const item of src){
    if(item.isSection){section=item.raw.replace(/^\[|\]$/g,'');continue;}
    const idx=out.length,d=Math.max(.8,rawDur[idx]*scale);
    out.push({text:item.raw,section,start:t,end:Math.min(total,t+d)});t+=d;
  }
  if(out.length)out[out.length-1].end=Math.min(total,total*(1-unit(outro)));
  return out;
}

export function lyricAt(t,timeline=[]){
  const now=Math.max(0,finite(t,0));
  if(!timeline.length)return null;
  let lo=0,hi=timeline.length-1;
  while(lo<=hi){const m=(lo+hi)>>1,e=timeline[m];if(now<e.start)hi=m-1;else if(now>=e.end)lo=m+1;else return {...e,index:m,progress:unit((now-e.start)/Math.max(.001,e.end-e.start))};}
  const idx=Math.max(0,Math.min(timeline.length-1,lo));
  return null;
}

export function normalizeModel(m={}){
  const id=String(m.id||m.name||m.model||'').trim();
  const paidOnly=Boolean(m.paid_only??m.paidOnly??m.requires_payment??m.requiresPayment??false);
  const modalities=[...(m.output_modalities||m.outputModalities||m.output||[])].map(String);
  const type=String(m.type||m.category||m.kind||'').toLowerCase();
  return {raw:m,id,paidOnly,modalities,type,label:String(m.title||m.label||m.name||id)};
}

export function freeEligibleModels(models=[],kind=''){
  const k=String(kind||'').toLowerCase();
  return (Array.isArray(models)?models:models?.data||[]).map(normalizeModel).filter(m=>{
    if(!m.id||m.paidOnly)return false;
    if(!k)return true;
    if(m.type&&m.type.includes(k))return true;
    if(k==='video')return m.modalities.some(x=>/video/i.test(x));
    if(k==='image')return m.modalities.some(x=>/image/i.test(x))&&!m.modalities.some(x=>/video/i.test(x));
    if(k==='audio'||k==='music')return m.modalities.some(x=>/audio|music/i.test(x));
    if(k==='text')return m.modalities.some(x=>/text/i.test(x))||(!m.type&&!m.modalities.length);
    return true;
  });
}

export function makeChunkPlan(totalBytes,chunkBytes=8*1024*1024){
  const total=Math.max(0,Math.floor(finite(totalBytes,0)));
  const quantum=256*1024;
  const chunk=Math.max(quantum,Math.floor(finite(chunkBytes,8*1024*1024)/quantum)*quantum);
  const out=[];
  for(let start=0;start<total;start+=chunk){const end=Math.min(total,start+chunk)-1;out.push({start,end,size:end-start+1,total});}
  return out;
}
