'use strict';

const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,finite(v,a)));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const TOK=/[a-z0-9\u0900-\u097f]+/giu;
const words=s=>(clean(s).toLowerCase().match(TOK)||[]).filter(x=>x.length>1);
const hash=s=>{let h=2166136261;for(const c of String(s||''))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0};

function lineList(text=''){
  return String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
}
function lyricLines(text=''){
  let section='Song';const out=[];
  for(const raw of lineList(text)){
    const m=raw.match(/^\[([^\]]+)\]$/);if(m){section=clean(m[1])||section;continue}
    out.push({text:raw,section});
  }
  return out;
}
function overlap(a,b){const A=new Set(words(a)),B=new Set(words(b));if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(1,Math.min(A.size,B.size))}
function normalSegment(s={}){return {start:Math.max(0,finite(s.start,0)),end:Math.max(0,finite(s.end,s.start)),text:clean(s.text)}}

/** Align final lyric lines to Whisper segment time without asking another model.
 * Greedy monotonic matching keeps cue order stable even when transcription is imperfect. */
export function alignLyricsToSegments(text='',segments=[],duration=0){
  const lines=lyricLines(text),seg=(segments||[]).map(normalSegment).filter(x=>x.text&&x.end>x.start),dur=Math.max(1,finite(duration,seg.at(-1)?.end||120));
  if(!lines.length)return [];
  if(!seg.length){const start=Math.min(3,dur*.03),span=Math.max(1,dur-start-Math.min(3,dur*.02)),step=span/lines.length;return lines.map((x,i)=>({text:x.text,section:x.section,start:start+i*step,end:Math.min(dur,start+(i+1)*step),confidence:0,source:'even'}));}
  const cues=[];let from=0;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];let best=-1,bestScore=-1;const remaining=lines.length-i,windowEnd=Math.min(seg.length,from+Math.max(5,Math.ceil((seg.length-from)/Math.max(1,remaining))*3));
    for(let j=from;j<windowEnd;j++){const score=overlap(line.text,seg[j].text)-Math.max(0,j-from-3)*.015;if(score>bestScore){bestScore=score;best=j}}
    if(best<0)best=Math.min(from,seg.length-1);
    const s=seg[best],next=seg[Math.min(seg.length-1,best+1)];
    let end=Math.max(s.end,s.start+.55);if(bestScore<.14&&next&&overlap(line.text,`${s.text} ${next.text}`)>bestScore+.08)end=Math.max(end,next.end);
    cues.push({text:line.text,section:line.section,start:s.start,end:Math.min(dur,end),confidence:clamp(bestScore,0,1),source:'whisper'});from=Math.min(seg.length-1,best+1);
  }
  // Prevent overlaps and microscopic cue gaps while preserving chronological order.
  for(let i=0;i<cues.length;i++){
    if(i&&cues[i].start<cues[i-1].start+.12)cues[i].start=Math.min(dur-.2,cues[i-1].start+.12);
    const next=cues[i+1];if(next)cues[i].end=Math.min(Math.max(cues[i].end,cues[i].start+.55),Math.max(cues[i].start+.55,next.start-.04));
    else cues[i].end=Math.min(dur,Math.max(cues[i].end,cues[i].start+.8));
  }
  return cues;
}

function baseBeats(project={}){
  const given=Array.isArray(project.storyBeats)?project.storyBeats.filter(Boolean):[];
  if(given.length)return given.slice(0,18).map((b,i)=>({
    section:clean(b.section||`Beat ${i+1}`),lyric:clean(b.lyric||b.lyric_hint),meaning:clean(b.meaning),visual:clean(b.visual),query:clean(b.query),energy:clamp(b.energy,.1,1),camera:clean(b.camera),motion:clean(b.motion),transition:clean(b.transition)
  }));
  const lines=lyricLines(project.lyrics||'');const anchors=(project.visualAnchors||[]).map(clean).filter(Boolean);const n=Math.max(4,Math.min(12,Math.ceil(lines.length/3)||6));const out=[];
  for(let i=0;i<n;i++){
    const a=Math.floor(i*lines.length/n),b=Math.max(a+1,Math.floor((i+1)*lines.length/n)),chunk=lines.slice(a,b),lyric=chunk.map(x=>x.text).join(' '),section=chunk[0]?.section||`Beat ${i+1}`,anchor=anchors[i%Math.max(1,anchors.length)]||project.story||project.idea||project.title||'cinematic human moment';
    out.push({section,lyric,meaning:clean(project.story||project.hookMeaning||lyric),visual:anchor,query:anchor,energy:clamp(.28+i/(n*2),.18,.82)});
  }
  return out;
}
function cameraFor(i,energy){const slow=['wide','medium','close','detail'],fast=['wide','close','detail','medium'];return (energy>.62?fast:slow)[i%4]}
function motionFor(i,energy){const slow=['drift','push','still','pull'],fast=['push','track','handheld','drift'];return (energy>.62?fast:slow)[i%4]}
function transitionFor(i,energy){if(i===0)return 'fade';if(energy>.72)return ['cut','whip','flash','cut'][i%4];if(energy<.34)return ['dissolve','fade','dissolve','cut'][i%4];return ['cut','dissolve','cut','push'][i%4]}

/** Expand semantic beats into 3.5–7 second shots. This creates enough visual change for
 * a music video while keeping each shot inside one lyric/story meaning. */
export function buildStoryPlan(project={},duration=120,{minShots=16,maxShots=48}={}){
  const dur=Math.max(8,finite(duration,120)),beats=baseBeats(project);let target=Math.round(dur/5.2);target=Math.max(minShots,Math.min(maxShots,target));target=Math.max(beats.length,target);
  const weights=beats.map(b=>.7+clamp(b.energy,.3,.95)),weightTotal=weights.reduce((a,b)=>a+b,0)||1;let remaining=target,shotsPer=[];
  for(let i=0;i<beats.length;i++){const left=beats.length-i-1,n=i===beats.length-1?remaining:Math.max(1,Math.min(4,Math.round(target*weights[i]/weightTotal)));shotsPer.push(n);remaining-=n;if(remaining<left)remaining=left}
  // Correct rounding so total stays near target.
  while(shotsPer.reduce((a,b)=>a+b,0)>target){const i=shotsPer.findIndex(x=>x>1);if(i<0)break;shotsPer[i]--}
  while(shotsPer.reduce((a,b)=>a+b,0)<target){let i=shotsPer.indexOf(Math.min(...shotsPer));shotsPer[i]++}
  const scenes=[];let cursor=0,totalWeight=beats.reduce((a,b)=>a+(.75+clamp(b.energy,.2,.95)),0)||1;
  for(let bi=0;bi<beats.length;bi++){
    const beat=beats[bi],beatDur=dur*(.75+clamp(beat.energy,.2,.95))/totalWeight,n=shotsPer[bi],shotDur=beatDur/n;
    for(let si=0;si<n;si++){
      const idx=scenes.length,energy=clamp((beat.energy||.45)+(si===n-1?.04:0),.08,1),visual=clean(beat.visual||beat.query||project.story||project.title),query=clean(beat.query||visual),variant=['establishing view','human action','symbolic detail','emotional reaction'][si%4];
      const start=cursor,end=bi===beats.length-1&&si===n-1?dur:Math.min(dur,cursor+shotDur);
      scenes.push({id:`scene-${idx+1}`,start,end,section:beat.section||'',lyric:beat.lyric||'',meaning:beat.meaning||project.story||'',visual:`${visual}${visual?`, ${variant}`:variant}`,query,keywords:[...new Set(words(`${beat.section} ${beat.lyric} ${beat.meaning} ${visual} ${query}`))].slice(0,14),energy,camera:beat.camera||cameraFor(idx,energy),motion:beat.motion||motionFor(idx,energy),transition:beat.transition||transitionFor(idx,energy)});cursor=end;
    }
  }
  if(scenes.length)scenes[scenes.length-1].end=dur;
  return {version:1,source:Array.isArray(project.storyBeats)&&project.storyBeats.length?'semantic-lock':'local',duration:dur,story:clean(project.story),hookMeaning:clean(project.hookMeaning),scenes};
}

export function normalizeStoryPlan(plan,project={},duration=120){
  if(!plan?.scenes?.length)return buildStoryPlan(project,duration);
  const dur=Math.max(8,finite(duration,plan.duration||120)),raw=plan.scenes.slice(0,64),out=[];
  for(let i=0;i<raw.length;i++){const x=raw[i]||{},prev=out.at(-1),start=Math.max(prev?.end||0,clamp(x.start,0,dur)),fallbackEnd=start+Math.max(2,dur/raw.length),end=Math.min(dur,Math.max(start+.7,finite(x.end,fallbackEnd)));out.push({id:clean(x.id)||`scene-${i+1}`,start,end,section:clean(x.section),lyric:clean(x.lyric),meaning:clean(x.meaning),visual:clean(x.visual),query:clean(x.query||x.visual),keywords:Array.isArray(x.keywords)?x.keywords.map(clean).filter(Boolean).slice(0,14):words(`${x.query||''} ${x.visual||''} ${x.meaning||''}`).slice(0,14),energy:clamp(x.energy,.08,1),camera:clean(x.camera)||cameraFor(i,x.energy),motion:clean(x.motion)||motionFor(i,x.energy),transition:clean(x.transition)||transitionFor(i,x.energy)});}
  if(out.length)out[out.length-1].end=dur;return {version:1,source:plan.source||'semantic',duration:dur,story:clean(plan.story||project.story),hookMeaning:clean(plan.hookMeaning||project.hookMeaning),scenes:out};
}
export function sceneAtTime(time,plan){const scenes=plan?.scenes||[];if(!scenes.length)return null;const t=Math.max(0,finite(time,0));let lo=0,hi=scenes.length-1;while(lo<=hi){const m=(lo+hi)>>1,s=scenes[m];if(t<s.start)hi=m-1;else if(t>=s.end)lo=m+1;else return {...s,index:m,progress:clamp((t-s.start)/Math.max(.001,s.end-s.start))};}const i=Math.max(0,Math.min(scenes.length-1,lo));const s=scenes[i];return {...s,index:i,progress:clamp((t-s.start)/Math.max(.001,s.end-s.start))};}
export function representativeQueries(plan,limit=4){const scenes=plan?.scenes||[];if(!scenes.length)return [];const out=[];for(let i=0;i<limit;i++){const at=Math.min(scenes.length-1,Math.round(i*Math.max(0,scenes.length-1)/Math.max(1,limit-1))),q=clean(scenes[at]?.query||scenes[at]?.visual);if(q&&!out.includes(q))out.push(q)}return out;}
export function storyPromptScenes(plan,limit=6){const scenes=plan?.scenes||[];if(!scenes.length)return [];const step=Math.max(1,Math.floor(scenes.length/limit));return scenes.filter((_,i)=>i%step===0).slice(0,limit);}
export function storyPlanSummary(plan){const s=plan?.scenes||[];if(!s.length)return 'No semantic storyboard yet.';const sections=[...new Set(s.map(x=>x.section).filter(Boolean))];return `${s.length} meaning-matched scenes${sections.length?` · ${sections.slice(0,5).join(' → ')}`:''}`;}

export function mediaMatchScore(item,scene){if(!item||!scene)return 0;const needle=new Set(scene.keywords?.length?scene.keywords:words(`${scene.query} ${scene.visual} ${scene.meaning}`)),hay=new Set(words(`${item.name||''} ${item.query||''} ${(item.path||[]).join(' ')} ${item.creator||''}`));let score=0;for(const w of needle)if(hay.has(w))score+=2;if(item.query&&overlap(scene.query||scene.visual,item.query)>.2)score+=5;if(scene.energy>.58&&item.kind==='video')score+=1.5;if(scene.energy<.3&&item.kind==='image')score+=.6;score+=(hash(`${item.id}|${scene.id}`)%1000)/100000;return score;}
