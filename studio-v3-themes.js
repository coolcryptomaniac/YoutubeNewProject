'use strict';

const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const unit=v=>Math.max(0,Math.min(1,finite(v,0)));
const rgba=(hex,a=1)=>{const h=String(hex||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(h))return `rgba(255,255,255,${unit(a)})`;const n=parseInt(h,16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${unit(a)})`};
const TAU=Math.PI*2;

export const THEMES=[
  {id:'clean',name:'Clean Cinema',palette:['#ecf4ff','#73c8ff','#07111f'],cutMin:2.4,effect:.12,visual:'wave',lyrics:'cinema'},
  {id:'lofi-rain',name:'Lofi Rain',palette:['#8be0c5','#8f7dff','#101827'],cutMin:2.1,effect:.16,visual:'rain',lyrics:'soft'},
  {id:'romance',name:'Romantic Dream',palette:['#ff8fb8','#ffc878','#1b1022'],cutMin:1.8,effect:.18,visual:'bloom',lyrics:'soft'},
  {id:'phonk-noir',name:'Phonk Noir',palette:['#ff496f','#8f7dff','#07070d'],cutMin:.78,effect:.42,visual:'bars',lyrics:'punch'},
  {id:'naru-shadow',name:'Naru Shadow Sprint',palette:['#63dfff','#8a6dff','#050916'],cutMin:.88,effect:.38,visual:'chakra',lyrics:'slash'},
  {id:'naru-chakra',name:'Naru Chakra Storm',palette:['#57e6ff','#f5c76b','#071221'],cutMin:1.02,effect:.34,visual:'chakra',lyrics:'chakra'},
  {id:'naru-rain',name:'Naru Rain Resolve',palette:['#78bfff','#a88cff','#07111e'],cutMin:1.2,effect:.26,visual:'rain',lyrics:'anime'},
  {id:'naru-sage',name:'Naru Sage Forest',palette:['#8ce59e','#f3d779','#07150d'],cutMin:1.45,effect:.22,visual:'lotus',lyrics:'anime'},
  {id:'naru-clash',name:'Naru Rival Clash',palette:['#5ee8ff','#ff5677','#080712'],cutMin:.72,effect:.46,visual:'chakra',lyrics:'slash'}
];
export const themeById=id=>THEMES.find(x=>x.id===id)||THEMES[0];

export function buildLyricCues(text='',duration=120){
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(x=>x&&!/^\[[^\]]+\]$/.test(x));
  if(!lines.length||!duration)return [];
  const start=Math.min(4,duration*.04),end=Math.max(start+1,duration-Math.min(4,duration*.03)),span=Math.max(1,end-start),step=span/lines.length;
  return lines.map((text,i)=>({text,start:start+i*step,end:Math.min(duration,start+(i+1)*step),section:'Song',source:'even'}));
}
export function lyricAt(time,cues=[]){const t=finite(time,0);for(let i=0;i<cues.length;i++)if(t>=cues[i].start&&t<cues[i].end)return {...cues[i],index:i,progress:unit((t-cues[i].start)/Math.max(.001,cues[i].end-cues[i].start))};return null}

export function drawProcedural(ctx,W,H,time,bands,theme){
  const t=finite(time,0),low=unit(bands?.low),mid=unit(bands?.mid),high=unit(bands?.high),[A,B,C]=theme.palette;
  ctx.fillStyle=C;ctx.fillRect(0,0,W,H);
  const g=ctx.createRadialGradient(W*.5,H*.42,0,W*.5,H*.5,Math.max(W,H)*.72);g.addColorStop(0,rgba(A,.18+mid*.16));g.addColorStop(.55,rgba(B,.08+high*.12));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(theme.id.includes('naru'))drawNaruWorld(ctx,W,H,t,{low,mid,high,A,B,C},theme.id);
  else if(theme.id==='lofi-rain')drawRain(ctx,W,H,t,{high,A,B});
  else if(theme.id==='phonk-noir')drawNoir(ctx,W,H,t,{low,high,A,B});
  else if(theme.id==='romance')drawBloom(ctx,W,H,t,{low,mid,A,B});
}
function drawNaruWorld(ctx,W,H,t,s,id){
  ctx.save();
  const horizon=H*.64;ctx.fillStyle=rgba(s.A,.055);for(let i=0;i<7;i++){const x=(i/6)*W,peak=horizon-H*(.09+((i*37)%5)*.018);ctx.beginPath();ctx.moveTo(x-W*.18,horizon);ctx.lineTo(x,peak);ctx.lineTo(x+W*.22,horizon);ctx.closePath();ctx.fill()}
  if(id==='naru-sage'){for(let i=0;i<18;i++){const x=(i*83)%W,y=(i*47+t*8)%H;ctx.fillStyle=rgba(i%2?s.A:s.B,.10+s.mid*.12);ctx.beginPath();ctx.arc(x,y,2+(i%4),0,TAU);ctx.fill()}}
  if(id==='naru-rain')drawRain(ctx,W,H,t,{high:s.high,A:s.A,B:s.B});
  const cx=W*.5,cy=H*.48,r=Math.min(W,H)*(.14+s.low*.045);ctx.strokeStyle=rgba(s.A,.28+s.mid*.25);ctx.lineWidth=Math.max(2,W*.0025);for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx,cy,r*(1+i*.28),t*(.12+i*.04)+i,Math.PI*1.65+t*(.12+i*.04)+i);ctx.stroke()}
  ctx.fillStyle=rgba('#000000',.35);ctx.beginPath();ctx.ellipse(cx,cy+H*.12,W*.055,H*.16,0,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(cx,cy-H*.02,W*.035,0,TAU);ctx.fill();
  if(id==='naru-clash'){ctx.fillStyle=rgba(s.B,.25+s.low*.2);ctx.beginPath();ctx.ellipse(W*.28,H*.55,W*.04,H*.15,-.22,0,TAU);ctx.fill();ctx.beginPath();ctx.ellipse(W*.72,H*.55,W*.04,H*.15,.22,0,TAU);ctx.fill()}
  ctx.restore();
}
function drawRain(ctx,W,H,t,s){ctx.save();ctx.lineCap='round';for(let i=0;i<75;i++){const x=(i*97.13)%W,y=((i*.173+t*(.22+s.high*.35))%1)*H,len=H*(.018+(i%5)*.006);ctx.strokeStyle=rgba(i%3?s.A:s.B,.08+s.high*.16);ctx.lineWidth=1+(i%2);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-W*.008,y+len);ctx.stroke()}ctx.restore()}
function drawNoir(ctx,W,H,t,s){ctx.save();ctx.translate(W/2,H/2);for(let i=0;i<22;i++){const a=i/22*TAU+t*.05,r=Math.min(W,H)*(.12+i*.018+s.low*.03);ctx.strokeStyle=rgba(i%2?s.A:s.B,.035+s.high*.10);ctx.lineWidth=1+(i%3);ctx.beginPath();ctx.arc(0,0,r,a,a+Math.PI*.9);ctx.stroke()}ctx.restore()}
function drawBloom(ctx,W,H,t,s){ctx.save();ctx.translate(W/2,H*.5);for(let i=0;i<16;i++){const a=i/16*TAU+t*.04,r=Math.min(W,H)*(.07+s.low*.035),len=Math.min(W,H)*(.16+s.mid*.05);ctx.fillStyle=rgba(i%2?s.A:s.B,.05+s.mid*.09);ctx.beginPath();ctx.ellipse(Math.cos(a)*len,Math.sin(a)*len,r*1.5,r,.5+a,0,TAU);ctx.fill()}ctx.restore()}

export function drawVisualizer(ctx,W,H,time,bands,theme){
  const low=unit(bands?.low),mid=unit(bands?.mid),high=unit(bands?.high),[A,B]=theme.palette,t=finite(time,0);ctx.save();ctx.globalAlpha=.42;
  if(theme.visual==='bars')bars(ctx,W,H,{low,mid,high,A,B,t});else if(theme.visual==='chakra')chakra(ctx,W,H,{low,mid,high,A,B,t});else if(theme.visual==='rain')rainViz(ctx,W,H,{low,mid,high,A,B,t});else if(theme.visual==='lotus')lotus(ctx,W,H,{low,mid,high,A,B,t});else wave(ctx,W,H,{low,mid,high,A,B,t});
  ctx.restore();
}
function bars(ctx,W,H,s){const N=42,bw=W/N;for(let i=0;i<N;i++){const v=unit(.12+s.low*.55+Math.sin(i*.7+s.t*4)*.08+s.mid*.2),h=H*(.03+v*.18);ctx.fillStyle=i%2?rgba(s.A,.45):rgba(s.B,.35);ctx.fillRect(i*bw,H-h,bw*.66,h)}}
function chakra(ctx,W,H,s){const cx=W/2,cy=H/2;for(let i=0;i<10;i++){const r=Math.min(W,H)*(.08+i*.025+s.low*.025);ctx.strokeStyle=i%2?rgba(s.A,.35):rgba(s.B,.28);ctx.lineWidth=1+s.mid*4;ctx.beginPath();ctx.arc(cx,cy,r,s.t*.18+i*.4,s.t*.18+i*.4+Math.PI*1.35);ctx.stroke()}}
function rainViz(ctx,W,H,s){for(let i=0;i<16;i++){const y=H*(.2+i*.04),amp=H*(.008+s.mid*.018);ctx.strokeStyle=i%2?rgba(s.A,.25):rgba(s.B,.20);ctx.beginPath();for(let x=0;x<=W;x+=18){const yy=y+Math.sin(x*.012+s.t*(.7+i*.02))*amp;x?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.stroke()}}
function lotus(ctx,W,H,s){ctx.translate(W/2,H/2);for(let i=0;i<12;i++){ctx.rotate(TAU/12);ctx.fillStyle=i%2?rgba(s.A,.16+s.mid*.1):rgba(s.B,.12+s.low*.1);ctx.beginPath();ctx.ellipse(0,-H*(.10+s.low*.02),W*.018,H*.075,.2,0,TAU);ctx.fill()}}
function wave(ctx,W,H,s){ctx.strokeStyle=rgba(s.A,.55);ctx.lineWidth=2+s.mid*3;ctx.beginPath();for(let x=0;x<=W;x+=8){const y=H*.82+Math.sin(x*.015+s.t*2.1)*H*(.015+s.low*.025);x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}

function fitText(ctx,text,maxW){let s=String(text||'');while(s.length>3&&ctx.measureText(s).width>maxW)s=s.slice(0,-2);return s}
function roundedRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function lyricFont(ctx,text,W,preferred){let size=preferred;for(;size>W*.026;size-=2){ctx.font=`850 ${Math.round(size)}px system-ui`;if(ctx.measureText(text).width<=W*.78)break}return size}
function nextLyric(cur,cues){const n=cues?.[cur.index+1];return n&&n.start-cur.end<1.15?n:null}
export function drawLyrics(ctx,W,H,time,cues,theme){
  const cur=lyricAt(time,cues);if(!cur)return;const p=cur.progress,[A,B]=theme.palette,style=theme.lyrics,next=nextLyric(cur,cues);ctx.save();ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.78)';ctx.shadowBlur=Math.max(10,W*.011);let y=H*.73,size=W*.044,scale=1,rot=0;if(style==='punch'){scale=.96+Math.sin(Math.min(1,p)*Math.PI)*.08;size=W*.052}else if(style==='slash'){scale=.98+Math.min(.05,p*.08);rot=Math.sin(time*12)*.004;size=W*.05}else if(style==='chakra'){scale=.98+Math.sin(p*Math.PI)*.04;size=W*.048}else if(style==='anime'){y=H*.77;size=W*.041}else if(style==='soft'){y=H*.75;size=W*.041}
  const raw=String(cur.text||''),section=String(cur.section||'').trim(),sectionVisible=section&&section.toLowerCase()!=='song',text=fitText(ctx,raw,W*.8);size=lyricFont(ctx,text,W,size);ctx.translate(W/2,y);ctx.rotate(rot);ctx.scale(scale,scale);ctx.font=`850 ${Math.round(size)}px system-ui`;const tw=ctx.measureText(text).width,padX=Math.max(24,W*.025),padY=Math.max(14,H*.018),boxW=Math.min(W*.88,tw+padX*2),boxH=size+padY*2;
  // Glass caption plate keeps words legible over bright footage without covering the scene.
  ctx.shadowBlur=0;ctx.fillStyle='rgba(4,7,14,.46)';roundedRect(ctx,-boxW/2,-boxH/2,boxW,boxH,Math.max(14,boxH*.23));ctx.fill();ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=Math.max(1,W*.0012);ctx.stroke();
  if(sectionVisible){ctx.textAlign='left';ctx.font=`750 ${Math.max(12,Math.round(W*.014))}px system-ui`;ctx.fillStyle=rgba(A,.92);ctx.fillText(section.toUpperCase(),-boxW/2+padX,-boxH/2-Math.max(13,H*.018))}
  ctx.textAlign='center';ctx.font=`850 ${Math.round(size)}px system-ui`;ctx.shadowColor='rgba(0,0,0,.92)';ctx.shadowBlur=Math.max(8,W*.008);ctx.fillStyle='rgba(255,255,255,.68)';ctx.fillText(text,0,0);
  // Karaoke progress is rendered with a clip instead of per-letter objects, keeping memory constant.
  const left=-tw/2,progressW=tw*unit(p);ctx.save();ctx.beginPath();ctx.rect(left-size*.05,-size,progressW+size*.1,size*2);ctx.clip();const ink=ctx.createLinearGradient(left,0,left+Math.max(1,tw),0);ink.addColorStop(0,A);ink.addColorStop(1,B);ctx.fillStyle=ink;ctx.fillText(text,0,0);ctx.restore();
  ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.16)';roundedRect(ctx,-tw/2,boxH*.5+Math.max(7,H*.009),tw,Math.max(3,H*.005),99);ctx.fill();ctx.fillStyle=A;roundedRect(ctx,-tw/2,boxH*.5+Math.max(7,H*.009),Math.max(2,tw*p),Math.max(3,H*.005),99);ctx.fill();
  if(next){ctx.font=`650 ${Math.max(12,Math.round(size*.47))}px system-ui`;ctx.fillStyle='rgba(255,255,255,.38)';ctx.fillText(fitText(ctx,next.text,W*.7),0,boxH*.5+size*.86)}
  if(style==='slash'){ctx.strokeStyle=rgba(A,.65);ctx.lineWidth=Math.max(2,W*.0024);ctx.beginPath();ctx.moveTo(-boxW*.32,boxH*.48);ctx.lineTo(-boxW*.32+boxW*.64*p,boxH*.48);ctx.stroke()}if(style==='chakra'){ctx.strokeStyle=rgba(B,.38);ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,Math.min(boxW*.38,H*.16),-Math.PI/2,-Math.PI/2+TAU*p);ctx.stroke()}ctx.restore()
}

export function drawIntroOutro(ctx,W,H,time,duration,project,theme){const intro=time<2.8,outro=time>Math.max(0,duration-3.5);if(!intro&&!outro)return;const local=intro?unit(time/2.8):unit((duration-time)/3.5),text=intro?(project.intro||project.title):(project.outro||'Thanks for listening');ctx.save();ctx.globalAlpha=.92*Math.min(1,local*3);const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,rgba(theme.palette[2],.96));g.addColorStop(1,rgba(theme.palette[0],.24));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=25;ctx.font=`900 ${Math.round(W*.055)}px system-ui`;ctx.fillText(fitText(ctx,String(text||'').toUpperCase(),W*.82),W/2,H*.5);ctx.fillStyle=theme.palette[0];ctx.font=`700 ${Math.round(W*.015)}px system-ui`;ctx.fillText(intro?'ORIGINAL MUSIC VIDEO':'CREATE · EDIT · PUBLISH',W/2,H*.64);ctx.restore()}