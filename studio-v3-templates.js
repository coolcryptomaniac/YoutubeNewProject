'use strict';

const GENRES=[
 ['lofi','Lofi Rain Cinema','lofi-rain',['rain window portrait','late-night cafe','vinyl closeup','soft city bokeh'],'soft-film','drift'],
 ['phonk','Midnight Phonk Drive','phonk-noir',['neon tunnel car','night highway reflections','smoke street portrait','underground parking'],'neon-noir','handheld'],
 ['romantic','Bollywood Romance Glow','romance',['cinematic couple silhouette','golden-hour train window','flowers in warm wind','city rooftop sunset'],'warm-bloom','push'],
 ['indie','Indie Film Diary','clean',['35mm rooftop portrait','coffee shop candid','walking street documentary','sunlit bedroom'],'film-diary','drift'],
 ['devotional','Sacred Dawn','naru-sage',['temple sunrise atmosphere','mountain prayer silhouette','incense macro','river dawn bells'],'sacred-gold','pull'],
 ['epic','Epic Ascension','naru-clash',['storm mountain wide shot','hero silhouette backlight','dramatic cloud timelapse','ancient ruins sunrise'],'epic-contrast','push'],
 ['anime','Shadow Anime Pulse','naru-shadow',['anime-inspired rain rooftop','mist forest warrior silhouette','moonlit mountain village','energy light abstract'],'ink-neon','track'],
 ['rain','Monsoon Memory','naru-rain',['monsoon street reflection','rain glass portrait','umbrella night cinematic','wet road headlights'],'rain-cyan','drift'],
 ['dance','Festival Hypercut','phonk-noir',['concert light crowd','festival stage energy','laser silhouette dance','city nightlife movement'],'electric-pop','handheld'],
 ['acoustic','Acoustic Golden Hour','clean',['guitar hands sunset','sunlit room musician','country road golden hour','campfire friends'],'natural-warm','drift'],
 ['dream','Dream Pop Ether','romance',['pastel clouds slow motion','ocean dusk silhouette','fairy lights portrait','flowers macro dream'],'pastel-haze','pull'],
 ['folk','Mountain Folk Story','naru-sage',['himalayan village morning','forest trail traveller','local market documentary','sunrise ridge people'],'earthy-film','track']
];
const MOODS=[
 ['calm','Calm Flow',['soft light','slow graceful motion'],2.7,.28,'dissolve'],
 ['sad','Heartbreak Story',['lonely cinematic','rainy reflective mood'],2.2,.36,'fade'],
 ['love','Love Story',['warm intimate light','romantic natural motion'],2.0,.46,'dissolve'],
 ['dark','Dark Pulse',['moody low-key light','night contrast'],1.25,.62,'whip'],
 ['power','Power Cut',['dramatic fast camera','high-impact motion'],.92,.82,'flash'],
 ['hope','Hopeful Rise',['sunrise uplifting light','forward movement'],1.75,.58,'dissolve']
];
const TOPICS=['love story','night drive','rain memory','mountain journey','battle resolve','city loneliness','friendship','spiritual awakening','freedom','homecoming','dream chase','festival energy'];
const tokens=s=>String(s||'').toLowerCase().split(/[^a-z0-9\u0900-\u097f]+/).filter(Boolean);

export const VIDEO_TEMPLATES=[];
for(let gi=0;gi<GENRES.length;gi++)for(let mi=0;mi<MOODS.length;mi++){
  const [gid,gname,theme,base,grade,motion]=GENRES[gi],[mid,mname,mods,cut,energy,transition]=MOODS[mi],topic=TOPICS[(gi*3+mi)%TOPICS.length];
  VIDEO_TEMPLATES.push({
    id:`${gid}-${mid}`,name:`${gname} · ${mname}`,genre:gid,mood:mid,topic,theme,cut,grade,motion,energy,transition,
    queries:[`${mods[0]} ${base[0]}`,`${mods[1]} ${base[1]}`,`${topic} ${base[2]}`,`${mods[0]} ${base[3]}`],
    lyricPreset:gid==='anime'?'slash':gid==='phonk'||gid==='dance'?'punch':mid==='love'||mid==='calm'?'soft':'cinema',
    pacing:cut<1.1?'hyper':cut<1.8?'dynamic':cut<2.4?'cinematic':'slow',
    signature:`${grade} · ${motion} · ${transition}`
  });
}

export function templateById(id){return VIDEO_TEMPLATES.find(x=>x.id===id)||VIDEO_TEMPLATES[0]}
export function pickTemplate({text='',preferred='' }={}){
  if(preferred&&preferred!=='auto'&&VIDEO_TEMPLATES.some(x=>x.id===preferred))return templateById(preferred);
  const joined=tokens(text).join(' ');let best=VIDEO_TEMPLATES[0],score=-1;
  for(const x of VIDEO_TEMPLATES){
    let s=0;for(const w of [x.genre,x.mood,...tokens(x.topic),...x.queries.flatMap(tokens)])if(w&&joined.includes(w))s++;
    if(/love|romance|pyaar|प्यार|ishq|इश्क|mohabbat|मोहब्बत/.test(joined)&&x.genre==='romantic')s+=7;
    if(/sad|alone|lonely|breakup|dard|दर्द|जुदाई|heartbreak/.test(joined)&&x.mood==='sad')s+=6;
    if(/rain|barish|baarish|बारिश|monsoon/.test(joined)&&x.genre==='rain')s+=7;
    if(/phonk|drift|bass|night drive|car/.test(joined)&&x.genre==='phonk')s+=8;
    if(/dance|club|party|festival|dj|नाच/.test(joined)&&x.genre==='dance')s+=7;
    if(/battle|fight|warrior|anime|ninja|युद्ध|योद्धा/.test(joined)&&x.genre==='anime')s+=7;
    if(/temple|prayer|bhajan|devotional|भगवान|भक्ति|मंदिर|शिव|राम|कृष्ण/.test(joined)&&x.genre==='devotional')s+=8;
    if(/mountain|village|folk|pahad|पहाड़|कumaoni|कुमाऊ/.test(joined)&&x.genre==='folk')s+=7;
    if(/guitar|acoustic|unplugged|singer songwriter/.test(joined)&&x.genre==='acoustic')s+=7;
    if(/dream|ethereal|ambient|cloud|आसमान/.test(joined)&&x.genre==='dream')s+=6;
    if(/epic|cinematic|trailer|victory|rise|जीत/.test(joined)&&x.genre==='epic')s+=6;
    if(/calm|peace|soft|शांत|sukoon|सुकून/.test(joined)&&x.mood==='calm')s+=5;
    if(/hope|return|home|घर|उम्मीद|sunrise/.test(joined)&&x.mood==='hope')s+=5;
    if(/dark|rage|aggressive|intense|गुस्सा/.test(joined)&&x.mood==='dark')s+=5;
    if(s>score){score=s;best=x}
  }
  return best;
}

export function adaptTemplate(template,{scenePlan=null,duration=0,aspect='landscape'}={}){
  const t={...template};const scenes=scenePlan?.scenes||[];const avg=scenes.length?scenes.reduce((n,x)=>n+(Number(x.energy)||0),0)/scenes.length:t.energy;
  const intensity=Math.max(.15,Math.min(1,Number(avg)||t.energy||.5));
  const longSong=Number(duration||scenePlan?.duration||0)>240;
  return {...t,intensity,cut:Math.max(.72,t.cut*(intensity>.72?.82:intensity<.34?1.18:1)*(longSong?1.08:1)),motion:intensity>.78&&t.motion==='drift'?'track':t.motion,transition:intensity>.82?'flash':t.transition,aspect,signature:`${t.grade} · ${Math.round(intensity*100)}% energy · ${t.motion}`};
}
export function templateGroups(){return GENRES.map(([id,name])=>({id,name,templates:VIDEO_TEMPLATES.filter(x=>x.genre===id)}))}
export const TEMPLATE_COUNT=VIDEO_TEMPLATES.length;
