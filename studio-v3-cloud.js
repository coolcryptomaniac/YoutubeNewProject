'use strict';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cleanBase=s=>String(s||'').trim().replace(/\/+$/,'');

export class CloudMediaClient{
  constructor(base=''){this.base=cleanBase(base)}
  get enabled(){return /^https:\/\//.test(this.base)}
  url(path){if(!this.enabled)throw new Error('Ridge Cloud is not configured.');return this.base+path}
  async health(){if(!this.enabled)return {ok:false,configured:false};const r=await fetch(this.url('/api/health'),{cache:'no-store'});if(!r.ok)throw new Error(`Ridge Cloud ${r.status}`);return r.json()}
  async searchTemplate(template,{aspect='landscape',perQuery=4,signal}={}){
    if(!this.enabled)return [];
    const orientation=aspect==='vertical'?'portrait':'landscape',out=[],seen=new Set();
    for(const q of (template?.queries||[]).slice(0,4)){
      const u=this.url(`/api/pexels/search?q=${encodeURIComponent(q)}&orientation=${orientation}&per_page=${Math.max(1,Math.min(8,perQuery))}`);
      const r=await fetch(u,{signal});if(!r.ok){if(r.status===503)break;continue}const j=await r.json();
      for(const v of j.videos||[]){if(!v?.mediaUrl||seen.has(v.id))continue;seen.add(v.id);out.push({id:`cloud:${v.id}`,name:v.title||`Pexels ${v.id}`,kind:'video',type:v.type||'video/mp4',size:0,lastModified:0,source:'remote',remoteUrl:v.mediaUrl,thumbUrl:v.thumbnail||'',pageUrl:v.pageUrl||'',creator:v.creator||'Pexels',duration:Number(v.duration)||0,width:Number(v.width)||0,height:Number(v.height)||0,query:q})}
    }
    return out.slice(0,16);
  }
  async generateFreeClips(prompts,{aspect='landscape',windowMinutes=3,maxClips=3,onState=()=>{}}={}){
    if(!this.enabled)return [];
    const deadline=Date.now()+Math.max(1,Math.min(10,Number(windowMinutes)||3))*60_000,out=[];
    for(const prompt of (prompts||[]).filter(Boolean)){
      if(Date.now()>deadline||out.length>=Math.max(1,Math.min(6,maxClips)))break;
      try{
        onState(`Trying a verified-free video model for clip ${out.length+1}…`);
        const r=await fetch(this.url('/api/video/generate'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,aspect}),signal:AbortSignal.timeout(Math.max(15_000,deadline-Date.now()))});
        if(r.status===402||r.status===404||r.status===503){onState('No verified-free video model is available right now; continuing with stock/local/procedural media.');break}
        if(!r.ok)throw new Error(`video provider ${r.status}`);
        const blob=await r.blob();if(!blob.size||blob.size>40*1024*1024)throw new Error('generated clip exceeded the safe size limit');
        out.push(new File([blob],`ridge-ai-clip-${out.length+1}.${blob.type.includes('mp4')?'mp4':'webm'}`,{type:blob.type||'video/mp4',lastModified:Date.now()}));
      }catch(e){onState(`Free-video attempt skipped: ${e.message}`);await sleep(500)}
    }
    return out;
  }
}

export function visualPrompts(project,template){
  const story=project?.story||project?.idea||project?.title||'cinematic music story';
  return (template?.queries||[]).slice(0,4).map((q,i)=>`${story}. ${q}. Shot ${i+1}: cinematic music-video footage, coherent subject, natural motion, no text, no logo, ${project?.aspect==='vertical'?'vertical 9:16':'landscape 16:9'}`);
}
