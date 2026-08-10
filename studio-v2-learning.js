'use strict';

const KEY='ridge.learning.v1';
const MAX_EVENTS=120;

function load(){
  try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return {version:1,events:Array.isArray(x.events)?x.events:[]}}catch{return {version:1,events:[]}}
}
function save(x){localStorage.setItem(KEY,JSON.stringify({version:1,events:(x.events||[]).slice(-MAX_EVENTS)}));return x}
const words=s=>String(s||'').trim().split(/\s+/).filter(Boolean);
const lyricLines=s=>String(s||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!/^\[[^\]]+\]$/.test(x));

export function captureSnapshot(extra={}){
  const q=id=>document.querySelector('#'+id)?.value||'';
  const lines=lyricLines(q('lyrics'));
  return {
    at:new Date().toISOString(),
    language:q('language'),theme:q('theme'),edit:q('editStyle'),visualizer:q('visualizer'),lyricStyle:q('lyricStyle'),thumbStyle:q('thumbStyle'),
    combo:q('comboPreset'),idea:q('idea').slice(0,500),title:q('title').slice(0,160),
    titleWords:words(q('title')).length,
    lyricLineWords:lines.length?lines.reduce((a,l)=>a+words(l).length,0)/lines.length:0,
    lyricLines:lines.length,
    ...extra
  };
}

export function recordLearning(kind,score=0,extra={}){
  const x=load();x.events.push({...captureSnapshot(extra),kind,score:Number(score)||0});save(x);return x.events.length;
}

function tally(events,field){
  const m=new Map();for(const e of events){const v=e[field];if(!v)continue;m.set(v,(m.get(v)||0)+(e.score||0))}return [...m].sort((a,b)=>b[1]-a[1]);
}
function avg(events,field){const xs=events.map(e=>Number(e[field])).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0}

export function learningSummary(language=''){
  const all=load().events,liked=all.filter(e=>e.score>0&&(!language||e.language===language)),bad=all.filter(e=>e.score<0&&(!language||e.language===language));
  if(!liked.length&&!bad.length)return 'No prior creator feedback yet. Follow the curated songwriting rules exactly.';
  const top=(field,arr=liked)=>tally(arr,field)[0]?.[0]||'';
  const parts=[];
  if(liked.length){
    const line=avg(liked,'lyricLineWords'),title=avg(liked,'titleWords');
    if(line)parts.push(`Liked songs average about ${line.toFixed(1)} words per lyric line`);
    if(title)parts.push(`liked titles average ${title.toFixed(1)} words`);
    for(const [label,field] of [['edit','edit'],['lyric animation','lyricStyle'],['visualizer','visualizer']]){const v=top(field);if(v)parts.push(`strong past preference: ${label}=${v}`)}
  }
  if(bad.length){const v=top('edit',bad);if(v)parts.push(`avoid overusing negatively-rated edit=${v}`)}
  return parts.join('; ')+'. Treat this as a soft preference, never as permission to repeat old lyrics or titles.';
}

export function preferredCombo(combos=[],language=''){
  const events=load().events.filter(e=>e.combo&&(!language||e.language===language));
  if(!events.length)return null;
  const scores=new Map();for(const e of events)scores.set(e.combo,(scores.get(e.combo)||0)+e.score);
  return [...combos].sort((a,b)=>(scores.get(b.id)||0)-(scores.get(a.id)||0))[0]||null;
}

export function learningStats(){
  const e=load().events;return {events:e.length,liked:e.filter(x=>x.score>0).length,disliked:e.filter(x=>x.score<0).length,renders:e.filter(x=>x.kind==='render').length,uploads:e.filter(x=>x.kind==='upload').length};
}
export function resetLearning(){localStorage.removeItem(KEY)}
export const LEARNING_KEY=KEY;