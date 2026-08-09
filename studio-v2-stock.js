'use strict';

const API='https://api.pexels.com/v1/videos/search';
function chooseFile(files=[]){
  const candidates=[...files].filter(x=>x?.link&&x.file_type?.startsWith('video/')).sort((a,b)=>{
    const pa=Math.abs((a.width||1280)-1920)+Math.abs((a.height||720)-1080),pb=Math.abs((b.width||1280)-1920)+Math.abs((b.height||720)-1080);
    return pa-pb;
  });
  return candidates.find(x=>(x.width||0)>=1280&&(x.height||0)>=720)||candidates[0]||null;
}
export class PexelsClient{
  constructor(key=''){this.key=String(key||'').trim()}
  setKey(k){this.key=String(k||'').trim()}
  requireKey(){if(!this.key)throw new Error('Add a Pexels API key to fetch free stock video. The key is kept only for this browser tab.')}
  async search(query,{perPage=6,orientation='landscape'}={}){
    this.requireKey();
    const u=new URL(API);u.searchParams.set('query',query);u.searchParams.set('per_page',String(Math.max(1,Math.min(20,perPage))));u.searchParams.set('orientation',orientation);u.searchParams.set('size','medium');
    const r=await fetch(u,{headers:{Authorization:this.key}});if(!r.ok)throw new Error(`Pexels ${r.status}: ${(await r.text()).slice(0,180)}`);
    const j=await r.json();return (j.videos||[]).map(v=>{const f=chooseFile(v.video_files||[]);return {id:v.id,url:v.url,duration:v.duration||0,width:v.width||0,height:v.height||0,creator:v.user?.name||'Pexels creator',creatorUrl:v.user?.url||'',file:f?.link||'',fileType:f?.file_type||'video/mp4',fileWidth:f?.width||0,fileHeight:f?.height||0,query}}).filter(x=>x.file);
  }
  async download(item){const r=await fetch(item.file);if(!r.ok)throw new Error(`Pexels video download ${r.status}`);const b=await r.blob();if(!b.type.startsWith('video/'))throw new Error('Pexels returned non-video data.');return b}
}
export function pexelsCreditLine(items=[]){
  const uniq=[];for(const x of items){const key=x.creatorUrl||x.creator;if(!uniq.some(y=>(y.creatorUrl||y.creator)===key))uniq.push(x)}
  if(!uniq.length)return '';
  return ['Videos provided by Pexels:',...uniq.slice(0,10).map(x=>`• ${x.creator}${x.creatorUrl?` — ${x.creatorUrl}`:''}`)].join('\n');
}
export {chooseFile};
