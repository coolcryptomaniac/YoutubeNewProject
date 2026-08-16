import assert from 'node:assert/strict';
import {buildMeaningTimeline,normalizeScenePlan,timedLyricCues,chooseItemForBeat,sceneQueries} from '../studio-v3-director.js';

const plan=normalizeScenePlan([
  {id:'a',start_pct:0,end_pct:35,meaning:'leaving home',search_query:'mountain road suitcase',intensity:.25},
  {id:'b',start_pct:35,end_pct:72,meaning:'lonely city',search_query:'night city window',intensity:.55},
  {id:'c',start_pct:72,end_pct:100,meaning:'return and acceptance',search_query:'mountain sunrise home',intensity:.8}
]);
assert.equal(plan.length,3);
const timeline=buildMeaningTimeline({scenePlan:plan,lyrics:'one\ntwo\nthree'},200);
assert.equal(timeline.length,3);
assert.equal(timeline[0].start,0);
assert.equal(timeline.at(-1).end,200);
assert.ok(timeline.every((x,i)=>i===0||x.start>=timeline[i-1].start));

const local=buildMeaningTimeline({story:'missing home',lyrics:'[Verse]\nI left the hill\nThe bus went down\n[Chorus]\nTake me home\nTake me home'},180);
assert.ok(local.length>=4&&local.length<=18);
assert.ok(local.every(x=>x.end>x.start));

const cues=timedLyricCues('first line\nsecond line\nthird line',120,[{start:8,end:18,text:'first'},{start:20,end:46,text:'second'},{start:48,end:70,text:'third'}]);
assert.equal(cues.length,3);
assert.equal(cues[0].start,8);
assert.equal(cues.at(-1).end,70);
assert.ok(cues[1].start>=cues[0].end);

const items=[
  {id:'1',name:'city traffic.mp4',kind:'video',source:'session'},
  {id:'2',name:'mountain road sunrise.mp4',kind:'video',source:'session'},
  {id:'3',name:'portrait.jpg',kind:'image',source:'session'}
];
assert.equal(chooseItemForBeat(items,{id:'x',query:'mountain road',visual:'return home'}).id,'2');
assert.ok(sceneQueries({scenePlan:[{start_pct:0,end_pct:100,search_query:'night train window'}]},{}).some(x=>x.includes('night train')));
console.log('V3 semantic director self-test OK');
