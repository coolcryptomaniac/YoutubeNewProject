'use strict';

const GENRES=[
 ['lofi','Lofi','lofi-rain',['rain window','night cafe','vinyl record','city lights']],
 ['phonk','Phonk','phonk-noir',['night drive','sports car','neon street','smoke']],
 ['romantic','Romantic Pop','romance',['couple silhouette','sunset city','flowers','train window']],
 ['indie','Indie','clean',['rooftop city','coffee shop','walking street','film grain']],
 ['devotional','Devotional','naru-sage',['temple sunrise','mountain prayer','incense','river dawn']],
 ['epic','Epic Cinematic','naru-clash',['storm mountains','warrior silhouette','clouds dramatic','ancient ruins']],
 ['anime','Ninja Anime','naru-shadow',['rain rooftop','forest mist','moon village','energy light']],
 ['rain','Rain Ballad','naru-rain',['monsoon street','rain glass','umbrella night','wet road']],
 ['dance','Dance','phonk-noir',['club lights','festival crowd','laser stage','city nightlife']],
 ['acoustic','Acoustic','clean',['guitar hands','sunlit room','country road','campfire']],
 ['dream','Dream Pop','romance',['clouds pastel','ocean dusk','fairy lights','slow motion flowers']],
 ['folk','Folk','naru-sage',['mountain village','forest path','local market','sunrise hills']]
];
const MOODS=[
 ['calm','Calm',['soft light','slow motion'],2.6],
 ['sad','Heartbreak',['lonely','rainy'],2.1],
 ['love','Love',['warm','intimate'],2.0],
 ['dark','Dark',['moody','night'],1.15],
 ['power','Power',['dramatic','fast'],.9],
 ['hope','Hopeful',['sunrise','uplifting'],1.7]
];
const TOPICS=['love story','night drive','rain memory','mountain journey','battle resolve','city loneliness','friendship','spiritual awakening','freedom','homecoming','dream chase','festival energy'];
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export const VIDEO_TEMPLATES=[];
for(let gi=0;gi<GENRES.length;gi++)for(let mi=0;mi<MOODS.length;mi++){
  const [gid,gname,theme,base]=GENRES[gi],[mid,mname,mods,cut]=MOODS[mi],topic=TOPICS[(gi*3+mi)%TOPICS.length];
  VIDEO_TEMPLATES.push({
    id:`${gid}-${mid}`,name:`${gname} · ${mname}`,genre:gid,mood:mid,topic,theme,cut,
    queries:[`${mods[0]} ${base[0]}`,`${mods[1]} ${base[1]}`,`${topic} ${base[2]}`,`${mods[0]} ${base[3]}`],
    lyricPreset:gid==='anime'?'slash':gid==='phonk'||gid==='dance'?'punch':mid==='love'||mid==='calm'?'soft':'cinema',
    pacing:cut<1.1?'fast':cut<2?'medium':'slow'
  });
}

const tokens=s=>String(s||'').toLowerCase().split(/[^a-z0-9\u0900-\u097f]+/).filter(Boolean);
export function templateById(id){return VIDEO_TEMPLATES.find(x=>x.id===id)||VIDEO_TEMPLATES[0]}
export function pickTemplate({text='',preferred='' }={}){
  if(preferred&&preferred!=='auto'&&VIDEO_TEMPLATES.some(x=>x.id===preferred))return templateById(preferred);
  const t=tokens(text),joined=t.join(' ');let best=VIDEO_TEMPLATES[0],score=-1;
  for(const x of VIDEO_TEMPLATES){let s=0;for(const w of [x.genre,x.mood,...tokens(x.topic),...x.queries.flatMap(tokens)])if(joined.includes(w))s++;if(/love|pyaar|प्यार|ishq|इश्क/.test(joined)&&x.mood==='love')s+=5;if(/rain|barish|बारिश/.test(joined)&&x.genre==='rain')s+=5;if(/phonk|drift|bass/.test(joined)&&x.genre==='phonk')s+=6;if(/battle|fight|warrior|युद्ध/.test(joined)&&x.genre==='anime')s+=5;if(s>score){score=s;best=x}}
  return best;
}
export function templateGroups(){return GENRES.map(([id,name])=>({id,name,templates:VIDEO_TEMPLATES.filter(x=>x.genre===id)}))}
export const TEMPLATE_COUNT=VIDEO_TEMPLATES.length;
