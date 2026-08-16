'use strict';

const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,finite(v,a)));
const words=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(/\s+/).filter(x=>x.length>2);
const uniq=a=>[...new Set(a.filter(Boolean))];

function lyricLines(text=''){
  const out=[];let section='verse';
  for(const raw of String(text||'').replace(/\r/g,'').split('\n')){
    const line=raw.trim();if(!line)continue;
    const tag=line.match(/^\[([^\]]+)\]$/);if(tag){section=tag[1].toLowerCase();continue}
    out.push({text:line,section});
  }
  return out;
}

export function normalizeScenePlan(plan=[]){
  if(!Array.isArray(plan))return [];
  return plan.slice(0,24).map((x,i)=>({
    id:String(x?.id||`beat-${i+1}`),
    section:String(x?.section||'story').slice(0,40),
    startPct:clamp(finite(x?.start_pct,x?.startPct??i/Math.max(1,plan.length))*0.01),
    endPct:clamp(finite(x?.end_pct,x?.endPct??(i+1)/Math.max(1,plan.length))*0.01),
    lyricAnchor:String(x?.lyric_anchor||x?.lyricAnchor||'').slice(0,240),
    meaning:String(x?.meaning||'').slice(0,420),
    visual:String(x?.visual_prompt||x?.visual||'').slice(0,700),
    query:String(x?.search_query||x?.query||'').slice(0,180),
    emotion:String(x?.emotion||'').slice(0,80),
    motion:String(x?.motion||'slow push').slice(0,80),
    edit:String(x?.edit||'cinematic').slice(0,80),
    intensity:clamp(x?.intensity??.45),
    continuityKey:String(x?.continuity_key||x?.continuityKey||'main').slice(0,80)
  })).filter(x=>x.endPct>x.startPct);
}

function fallbackPlan(project={},target=12){
  const lines=lyricLines(project.lyrics||'');
  const n=Math.max(4,Math.min(18,lines.length?Math.ceil(lines.length/2):target));
  const chunks=Array.from({length:n},(_,i)=>[]);
  lines.forEach((line,i)=>chunks[Math.min(n-1,Math.floor(i*n/Math.max(1,lines.length)))].push(line));
  const story=project.story||project.idea||project.title||'the song story';
  const hook=project.hookMeaning||'';
  return chunks.map((chunk,i)=>{
    const text=chunk.map(x=>x.text).join(' ').trim();
    const section=chunk[0]?.section||'story';
    const t=i/Math.max(1,n-1),arc=t<.28?'establishing':t<.62?'developing':t<.84?'climax':'resolution';
    return {id:`local-${i+1}`,section,startPct:i/n,endPct:(i+1)/n,lyricAnchor:text.slice(0,220),meaning:`${arc}: ${text||story}`.slice(0,420),visual:[story,hook,text].filter(Boolean).join('. ').slice(0,700),query:uniq(words(text||story)).slice(0,6).join(' '),emotion:arc,motion:t>.6?'handheld push':'slow cinematic move',edit:t>.6?'strong beat cuts':'lyric phrase cuts',intensity:clamp(.28+t*.58),continuityKey:'main'};
  });
}

export function buildMeaningTimeline(project={},duration=120){
  const dur=Math.max(1,finite(duration,120));
  let plan=normalizeScenePlan(project.scenePlan||project.scene_plan||[]);
  if(plan.length<3)plan=fallbackPlan(project);
  plan=plan.sort((a,b)=>a.startPct-b.startPct);
  return plan.map((x,i)=>{
    const start=i===0?0:clamp(x.startPct)*dur;
    const next=plan[i+1];
    const end=i===plan.length-1?dur:Math.max(start+.35,Math.min(dur,(next?.startPct??x.endPct)*dur));
    return {...x,index:i,start,end,duration:Math.max(.35,end-start)};
  });
}

export function beatAt(time,timeline=[]){
  const t=Math.max(0,finite(time,0));
  let out=timeline[0]||null;
  for(const b of timeline){if(t>=b.start)out=b;if(t>=b.start&&t<b.end)return b}
  return out;
}

export function sceneQueries(project={},template={}){
  const plan=normalizeScenePlan(project.scenePlan||[]);
  const fromPlan=plan.map(x=>x.query||x.visual).filter(Boolean);
  const anchors=Array.isArray(project.visualAnchors)?project.visualAnchors:[];
  return uniq([...fromPlan,...anchors,...(template?.queries||[])]).slice(0,8);
}

export function visualPromptsFromPlan(project={},template={}){
  const bible=project.visualBible||{};
  const continuity=[bible.subject,bible.setting,bible.palette,bible.camera_language,...(Array.isArray(bible.continuity_rules)?bible.continuity_rules:[])].filter(Boolean).join('. ');
  const plan=normalizeScenePlan(project.scenePlan||[]);
  const beats=plan.length?plan.slice(0,6):sceneQueries(project,template).slice(0,4).map((q,i)=>({visual:q,meaning:project.story||'',motion:'natural cinematic motion',id:`q-${i}`}));
  return beats.map((b,i)=>`${continuity?continuity+'. ':''}${b.meaning?b.meaning+'. ':''}${b.visual||b.query}. ${b.motion||''}. Scene ${i+1}, coherent music-video frame, same recurring subject where applicable, no text, no logo, ${project.aspect==='vertical'?'vertical 9:16':'landscape 16:9'}`.slice(0,1500));
}

function itemText(item={}){return [item.name,item.query,item.creator,item.path?.join?.(' ')].filter(Boolean).join(' ').toLowerCase()}
export function chooseItemForBeat(items=[],beat={},used=new Set()){
  if(!items.length)return null;
  const keys=uniq(words([beat.query,beat.visual,beat.meaning,beat.lyricAnchor].filter(Boolean).join(' '))).slice(0,16);
  let best=null,bestScore=-1e9;
  for(const item of items){
    const text=itemText(item);let score=0;
    for(const k of keys)if(text.includes(k))score+=3;
    if(item.source==='remote'&&item.query&&keys.some(k=>String(item.query).toLowerCase().includes(k)))score+=5;
    if(item.kind==='video')score+=beat.motion&&/move|handheld|walk|run|motion|dance|push/i.test(beat.motion)?2:.4;
    if(used.has(item.id))score-=5;
    score+=(Math.abs(hash(`${beat.id}|${item.id}`)%1000)/1000)*.2;
    if(score>bestScore){bestScore=score;best=item}
  }
  return best;
}
function hash(s=''){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0}

export function buildDirectedSequence(library,project={},duration=120){
  const timeline=buildMeaningTimeline(project,duration),items=[...(library?.items||[])],used=new Set();
  const scenes=timeline.map(beat=>{const item=chooseItemForBeat(items,beat,used);if(item)used.add(item.id);return {...beat,item}});
  return scenes;
}

export function timedLyricCues(text='',duration=120,segments=[]){
  const lines=lyricLines(text).map(x=>x.text);if(!lines.length)return [];
  const good=(Array.isArray(segments)?segments:[]).map(s=>({start:finite(s?.start,-1),end:finite(s?.end,-1),text:String(s?.text||'').trim()})).filter(s=>s.start>=0&&s.end>s.start);
  if(!good.length){const start=Math.min(3,duration*.025),end=Math.max(start+1,duration-Math.min(3,duration*.02)),span=end-start,total=lines.reduce((a,x)=>a+Math.max(4,x.length),0);let at=start;return lines.map(line=>{const d=span*Math.max(4,line.length)/Math.max(1,total),cue={text:line,start:at,end:Math.min(end,at+d)};at+=d;return cue})}
  const spokenStart=good[0].start,spokenEnd=good.at(-1).end,weights=lines.map(x=>Math.max(4,words(x).length*5+x.length*.35)),sum=weights.reduce((a,b)=>a+b,0);let cursor=spokenStart;
  return lines.map((line,i)=>{const rawEnd=i===lines.length-1?spokenEnd:cursor+(spokenEnd-spokenStart)*weights[i]/Math.max(1,sum);const cue={text:line,start:cursor,end:Math.max(cursor+.18,rawEnd)};cursor=cue.end;return cue});
}
