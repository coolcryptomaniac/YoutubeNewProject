'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const TAU = Math.PI * 2;
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const store = {
  get(k,d=null){ try { const v=localStorage.getItem('ridge.v2.'+k); return v===null?d:JSON.parse(v); } catch { return d; } },
  set(k,v){ try { localStorage.setItem('ridge.v2.'+k,JSON.stringify(v)); } catch {} }
};

const TEMPLATES = [
  {id:'pahadi',name:'Pahadi Dawn',visual:'mountain',palette:['#ffc96a','#8be0c5','#203b62'],suno:'Kumaoni/Pahadi folk, hudka, flute, warm acoustic strings, mountain ambience, intimate vocal, organic dynamics',look:'misty Himalayan ridges at dawn, warm sunlight, restrained film grain'},
  {id:'cinema',name:'Cinematic Peaks',visual:'ribbon',palette:['#ff7a9c','#ffc96a','#10192d'],suno:'cinematic orchestral, expressive strings, low percussion, wide dynamics, gradual build, memorable theme',look:'epic mountain scale, volumetric light, deep shadow, slow camera movement'},
  {id:'neon',name:'Neon Drive',visual:'tunnel',palette:['#ff6f91','#66d9ff','#120d2d'],suno:'synthwave, analog arpeggiator, gated drums, warm bass, glossy retro synths, driving tempo',look:'wet neon streets, chrome reflections, midnight magenta and cyan'},
  {id:'lofi',name:'Lofi Rain',visual:'rain',palette:['#8be0c5','#8f7dff','#151a29'],suno:'lofi hip hop, dusty drums, mellow Rhodes, vinyl texture, soft bass, relaxed tempo, understated melody',look:'rain on glass, warm desk light, dreamy city bokeh, quiet movement'},
  {id:'devotional',name:'Sacred Glow',visual:'orbit',palette:['#ffc96a','#ff9d6c','#281838'],suno:'devotional Indian song, harmonium, manjira, gentle percussion, heartfelt vocal, peaceful rising chorus',look:'diyas, river reflections, saffron and indigo glow, soft haze'},
  {id:'indie',name:'Indie Rooftop',visual:'wave',palette:['#8f7dff','#ff6f91','#151b2c'],suno:'indie pop rock, clean guitar, live drums, warm bass, close honest vocal, anthemic but not overproduced',look:'blue-hour rooftop, city lights, handheld film texture, candid intimacy'},
  {id:'festival',name:'Festival Pulse',visual:'radial',palette:['#ff6f91','#ffc96a','#66d9ff'],suno:'festival electronic pop, punchy drums, bright synth lead, huge chorus, energetic bass, celebratory lift',look:'confetti light, bloom, crowd silhouettes, saturated color and motion'},
  {id:'minimal',name:'Minimal Type',visual:'spectrum',palette:['#edf2ff','#8d9ab5','#080b12'],suno:'minimal modern production, sparse percussion, intimate vocal, clean bass, strong negative space, elegant arrangement',look:'black field, clean typography, restrained monochrome motion'},
  {id:'dark',name:'Storm Shadow',visual:'kaleido',palette:['#ff496f','#8f7dff','#080b12'],suno:'dark cinematic hybrid, low strings, taiko-like percussion, distorted textures, tension build, dramatic release',look:'storm clouds, rain-black surfaces, red-violet accents, high contrast'},
  {id:'space',name:'Deep Space',visual:'particles',palette:['#66d9ff','#8f7dff','#050713'],suno:'ambient electronic, evolving pads, sub bass, sparse percussion, glassy textures, slow cosmic progression',look:'deep space, drifting particles, luminous nebula, enormous depth'},
  {id:'acoustic',name:'Warm Acoustic',visual:'mountain',palette:['#ffc96a','#ff8d6d','#2a1914'],suno:'acoustic singer-songwriter, fingerpicked guitar, room tone, soft percussion, intimate natural vocal, warm tape character',look:'sunlit wood, dust in light, amber highlights, tactile analog grain'},
  {id:'club',name:'Midnight Club',visual:'spectrum',palette:['#66d9ff','#ff6f91','#050811'],suno:'deep house, warm sub bass, shuffled hats, filtered chords, tight kick, hypnotic late-night groove',look:'dark club, fog beam, cool reflections, controlled strobe-like motion'}
];

const VISUALS = {
  spectrum:{label:'Spectrum',draw:drawSpectrum},
  radial:{label:'Radial',draw:drawRadial},
  wave:{label:'Wave',draw:drawWave},
  orbit:{label:'Orbit',draw:drawOrbit},
  ribbon:{label:'Ribbon',draw:drawRibbon},
  tunnel:{label:'Tunnel',draw:drawTunnel},
  particles:{label:'Particles',draw:drawParticles},
  mountain:{label:'Mountain',draw:drawMountain},
  kaleido:{label:'Kaleido',draw:drawKaleido},
  rain:{label:'Rain',draw:drawRain}
};

const S = {
  audioFile:null,audioBuffer:null,audioUrl:null,renderBlob:null,renderUrl:null,posterBlob:null,
  scenes:[],selectedVisual:null,previewCtx:null,previewSource:null,previewAnalyser:null,previewRAF:null,
  previewFreq:null,previewTime:null,ytToken:null,tokenClient:null,particles:[],rendering:false,uploading:false
};

function currentTemplate(){ return TEMPLATES.find(t=>t.id===$('#templateSelect').value)||TEMPLATES[0]; }
function currentVisual(){ return $('#autoVisual').checked ? currentTemplate().visual : (S.selectedVisual||currentTemplate().visual); }
function fmtTime(sec){ if(!Number.isFinite(sec))return '—'; const m=Math.floor(sec/60),s=Math.round(sec%60); return `${m}:${String(s).padStart(2,'0')}`; }
function baseName(name='track'){ return name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim(); }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function init(){
  $('#templateSelect').innerHTML=TEMPLATES.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  $('#visualGrid').innerHTML=Object.entries(VISUALS).map(([id,v])=>`<button data-visual="${id}">${v.label}</button>`).join('');
  const saved={
    template:store.get('template','pahadi'),language:store.get('language','Hindi'),theme:store.get('theme',''),
    title:store.get('title',''),subtitle:store.get('subtitle',''),client:store.get('googleClientId',''),
    privacy:store.get('privacy','private'),category:store.get('category','10'),description:store.get('description',''),
    tags:store.get('tags',''),titlePosition:store.get('titlePosition','bottom'),grain:store.get('grain','0.1'),
    sceneReactive:store.get('sceneReactive',true),uploadPoster:store.get('uploadPoster',true),autoVisual:store.get('autoVisual',true),
    visual:store.get('visual',null)
  };
  $('#templateSelect').value=saved.template; $('#languageSelect').value=saved.language; $('#themeInput').value=saved.theme;
  $('#videoTitle').value=saved.title; $('#videoSubtitle').value=saved.subtitle; $('#googleClientId').value=saved.client;
  $('#privacySelect').value=saved.privacy; $('#categorySelect').value=saved.category; $('#descriptionInput').value=saved.description;
  $('#tagsInput').value=saved.tags; $('#titlePosition').value=saved.titlePosition; $('#grainSelect').value=saved.grain;
  $('#sceneReactive').checked=saved.sceneReactive; $('#uploadPoster').checked=saved.uploadPoster; $('#autoVisual').checked=saved.autoVisual;
  S.selectedVisual=saved.visual;
  bind(); buildSunoPrompt(); buildAiBrief(); refreshVisualButtons(); drawIdle();
}

function bind(){
  $('#buildPromptBtn').onclick=buildSunoPrompt;
  $('#copyPromptBtn').onclick=()=>copyText($('#sunoPrompt').value,'Suno prompt copied');
  $('#openSunoBtn').onclick=async()=>{ await copyText($('#sunoPrompt').value,'Prompt copied'); window.open('https://suno.com/create','_blank','noopener'); };
  $('#audioFile').onchange=e=>loadAudio(e.target.files?.[0]);
  setupDrop($('#audioDrop'),files=>loadAudio(files.find(f=>f.type.startsWith('audio/'))));
  $('#sceneFiles').onchange=e=>loadScenes([...e.target.files||[]]);
  setupDrop($('#imageDrop'),files=>loadScenes(files.filter(f=>f.type.startsWith('image/'))));
  $('#previewBtn').onclick=startPreview; $('#stopPreviewBtn').onclick=stopPreview;
  $('#renderBtn').onclick=renderVideo; $('#downloadBtn').onclick=downloadVideo; $('#posterBtn').onclick=savePoster;
  $('#buildAiBriefBtn').onclick=buildAiBrief;
  $('#openChatGPTBtn').onclick=()=>openAssistant('https://chatgpt.com/');
  $('#openClaudeBtn').onclick=()=>openAssistant('https://claude.ai/new');
  $('#connectYoutubeBtn').onclick=connectYouTube; $('#disconnectYoutubeBtn').onclick=disconnectYouTube; $('#uploadYoutubeBtn').onclick=uploadYouTube;
  $('#visualGrid').onclick=e=>{ const b=e.target.closest('[data-visual]'); if(!b)return; S.selectedVisual=b.dataset.visual; $('#autoVisual').checked=false; saveSettings(); refreshVisualButtons(); drawIdle(); };
  $('#sceneStrip').onclick=e=>{ const b=e.target.closest('[data-remove-scene]'); if(!b)return; const i=Number(b.dataset.removeScene); const [x]=S.scenes.splice(i,1); if(x?.url)URL.revokeObjectURL(x.url); paintScenes(); drawIdle(); };
  const fields=['templateSelect','languageSelect','themeInput','videoTitle','videoSubtitle','googleClientId','privacySelect','categorySelect','descriptionInput','tagsInput','titlePosition','grainSelect','sceneReactive','uploadPoster','autoVisual'];
  fields.forEach(id=>$('#'+id).addEventListener('change',()=>{ saveSettings(); if(id==='templateSelect'){ buildSunoPrompt(); buildAiBrief(); refreshVisualButtons(); drawIdle(); } if(id==='languageSelect'||id==='themeInput')buildSunoPrompt(); if(['videoTitle','videoSubtitle','titlePosition','grainSelect'].includes(id))drawIdle(); if(id==='autoVisual')refreshVisualButtons(); }));
  ['themeInput','videoTitle','videoSubtitle','descriptionInput','tagsInput','googleClientId'].forEach(id=>$('#'+id).addEventListener('input',()=>{ saveSettings(); if(id==='themeInput')buildSunoPrompt(); if(id==='videoTitle'||id==='videoSubtitle')drawIdle(); }));
  $('#audioPlayer').addEventListener('pause',()=>{ if(!S.rendering)cancelAnimationFrame(S.previewRAF); });
}

function saveSettings(){
  const map={template:'templateSelect',language:'languageSelect',theme:'themeInput',title:'videoTitle',subtitle:'videoSubtitle',googleClientId:'googleClientId',privacy:'privacySelect',category:'categorySelect',description:'descriptionInput',tags:'tagsInput',titlePosition:'titlePosition',grain:'grainSelect'};
  Object.entries(map).forEach(([k,id])=>store.set(k,$('#'+id).value));
  store.set('sceneReactive',$('#sceneReactive').checked); store.set('uploadPoster',$('#uploadPoster').checked); store.set('autoVisual',$('#autoVisual').checked); store.set('visual',S.selectedVisual);
}

function setupDrop(el,onFiles){
  ['dragenter','dragover'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.add('hot');}));
  ['dragleave','drop'].forEach(ev=>el.addEventListener(ev,e=>{e.preventDefault();el.classList.remove('hot');}));
  el.addEventListener('drop',e=>onFiles([...e.dataTransfer.files]));
}

function buildSunoPrompt(){
  const t=currentTemplate(),lang=$('#languageSelect').value,theme=$('#themeInput').value.trim();
  const vocal=lang==='Instrumental'?'Instrumental only, no vocals or spoken words.':`Lyrics in ${lang}; natural phrasing and a memorable chorus.`;
  const story=theme?`Theme: ${theme}.`:'';
  $('#sunoPrompt').value=[t.suno,vocal,story,'Original composition. Do not imitate or name a living artist. Clear intro, development and ending; avoid abrupt cutoff.'].filter(Boolean).join(' ');
}

async function copyText(text,ok='Copied'){
  try{ await navigator.clipboard.writeText(text); setStatus($('#renderStatus'),ok,'ok'); return true; }
  catch{ setStatus($('#renderStatus'),'Clipboard blocked — select and copy manually.','err'); return false; }
}

async function loadAudio(file){
  if(!file)return;
  stopPreview();
  if(S.audioUrl)URL.revokeObjectURL(S.audioUrl);
  S.audioFile=file; S.audioUrl=URL.createObjectURL(file); S.renderBlob=null; S.renderUrl&&URL.revokeObjectURL(S.renderUrl); S.renderUrl=null;
  $('#downloadBtn').disabled=true; $('#uploadYoutubeBtn').disabled=true;
  $('#audioPlayer').src=S.audioUrl; $('#trackCard').hidden=false; $('#trackName').textContent=file.name; $('#audioChip').textContent='Analysing…';
  const ab=await file.arrayBuffer();
  const ctx=new AudioContext();
  try{ S.audioBuffer=await ctx.decodeAudioData(ab.slice(0)); }
  finally{ await ctx.close(); }
  const m=analyseBuffer(S.audioBuffer);
  $('#trackMeta').textContent=`${(file.size/1048576).toFixed(1)} MB · ${fmtTime(S.audioBuffer.duration)}`;
  $('#energyMeter').textContent=Math.round(m.energy*100)+'%'; $('#brightnessMeter').textContent=Math.round(m.brightness*100)+'%'; $('#dynamicsMeter').textContent=Math.round(m.dynamics*100)+'%'; $('#durationMeter').textContent=fmtTime(S.audioBuffer.duration);
  $('#audioChip').textContent=`${fmtTime(S.audioBuffer.duration)} loaded`;
  if(!$('#videoTitle').value.trim())$('#videoTitle').value=baseName(file.name);
  saveSettings(); buildAiBrief(); drawIdle();
}

function analyseBuffer(buf){
  const x=buf.getChannelData(0),step=Math.max(1,Math.floor(x.length/220000)); let sum=0,z=0,n=0,prev=0;
  const windows=[],win=Math.max(256,Math.floor(buf.sampleRate*.05)); let wsum=0,wcount=0;
  for(let i=0;i<x.length;i+=step){ const v=x[i]; sum+=v*v; if((v>=0)!==(prev>=0))z++; prev=v;n++; wsum+=v*v;wcount++; if(wcount>=win/step){windows.push(Math.sqrt(wsum/wcount));wsum=0;wcount=0;} }
  const rms=Math.sqrt(sum/Math.max(1,n)),mean=windows.reduce((a,b)=>a+b,0)/Math.max(1,windows.length),variance=windows.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,windows.length);
  return {energy:clamp(rms*5),brightness:clamp((z/Math.max(1,n))*16),dynamics:clamp(Math.sqrt(variance)/(mean||1e-4)/1.8)};
}

async function loadScenes(files){
  for(const f of files){
    if(!f.type.startsWith('image/'))continue;
    const url=URL.createObjectURL(f),img=new Image();
    await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;}).catch(()=>null);
    if(img.naturalWidth)S.scenes.push({file:f,url,img}); else URL.revokeObjectURL(url);
  }
  paintScenes(); drawIdle();
}
function paintScenes(){
  $('#sceneStrip').innerHTML=S.scenes.map((s,i)=>`<div class="scene-thumb"><img src="${s.url}" alt="Scene ${i+1}"><button data-remove-scene="${i}" aria-label="Remove scene">×</button></div>`).join('');
}

function refreshVisualButtons(){
  const active=currentVisual();
  $$('#visualGrid [data-visual]').forEach(b=>b.classList.toggle('on',b.dataset.visual===active));
  $('#hudTemplate').textContent=currentTemplate().name; $('#hudVisualizer').textContent=VISUALS[active].label;
}

function audioBands(freq){
  if(!freq?.length)return {low:.18,mid:.12,high:.08,energy:.12};
  const avg=(a,b)=>{let s=0,n=0;for(let i=a;i<b&&i<freq.length;i++){s+=freq[i]/255;n++;}return n?s/n:0;};
  const low=avg(1,Math.floor(freq.length*.08)),mid=avg(Math.floor(freq.length*.08),Math.floor(freq.length*.35)),high=avg(Math.floor(freq.length*.35),Math.floor(freq.length*.82));
  return {low,mid,high,energy:low*.45+mid*.35+high*.2};
}

function drawIdle(){
  const c=$('#stage'),ctx=c.getContext('2d');
  const fake=new Uint8Array(256); for(let i=0;i<fake.length;i++)fake[i]=32+Math.round(22*Math.sin(i*.17));
  drawFrame(ctx,c.width,c.height,fake,null,{time:performance.now()/1000,progress:.18,...audioBands(fake)});
}

function drawFrame(ctx,W,H,freq,timeData,state){
  const t=currentTemplate(),A=t.palette[0],B=t.palette[1],C=t.palette[2];
  drawBackdrop(ctx,W,H,state,A,B,C);
  ctx.save(); VISUALS[currentVisual()].draw(ctx,W,H,freq,timeData,{...state,A,B,C}); ctx.restore();
  drawOverlay(ctx,W,H,state,A,B); drawGrain(ctx,W,H,Number($('#grainSelect').value)||0,state.time);
}

function drawBackdrop(ctx,W,H,s,A,B,C){
  if(S.scenes.length){
    const n=S.scenes.length,segment=1/n,pos=clamp(s.progress,0,.999999),idx=Math.min(n-1,Math.floor(pos/segment)),local=(pos-idx*segment)/segment;
    const img=S.scenes[idx].img,next=S.scenes[(idx+1)%n].img; const pulse=$('#sceneReactive').checked?s.low*.025:0;
    drawCover(ctx,img,W,H,1.03+local*.05+pulse,(local-.5)*W*.025,0);
    const fade=clamp((local-.72)/.28); if(fade>0&&idx<n-1){ctx.save();ctx.globalAlpha=fade;drawCover(ctx,next,W,H,1.02+(1-local)*.04,0,0);ctx.restore();}
    const wash=ctx.createLinearGradient(0,0,0,H);wash.addColorStop(0,'rgba(3,5,10,.12)');wash.addColorStop(.65,'rgba(3,5,10,.18)');wash.addColorStop(1,'rgba(3,5,10,.65)');ctx.fillStyle=wash;ctx.fillRect(0,0,W,H);
  }else{
    const g=ctx.createRadialGradient(W*.35,H*.32,0,W*.5,H*.5,W*.8);g.addColorStop(0,hexAlpha(A,.20+s.mid*.14));g.addColorStop(.46,hexAlpha(B,.10+s.high*.1));g.addColorStop(1,C);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
}
function drawCover(ctx,img,W,H,scale=1,ox=0,oy=0){
  const r=Math.max(W/img.naturalWidth,H/img.naturalHeight)*scale,dw=img.naturalWidth*r,dh=img.naturalHeight*r;ctx.drawImage(img,(W-dw)/2+ox,(H-dh)/2+oy,dw,dh);
}
function hexAlpha(hex,a){ const h=hex.replace('#',''); if(h.length!==6)return hex; const n=parseInt(h,16); return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`; }

function drawSpectrum(ctx,W,H,freq,_td,s){
  const N=72,gap=W*.0028,bw=(W*.82-(N-1)*gap)/N,x0=W*.09,base=H*.76;
  for(let i=0;i<N;i++){ const ix=Math.floor((i/N)**1.6*freq.length*.78),v=(freq[ix]||0)/255,h=H*(.025+v*.43); const g=ctx.createLinearGradient(0,base-h,0,base);g.addColorStop(0,s.A);g.addColorStop(1,hexAlpha(s.B,.18));ctx.fillStyle=g;ctx.globalAlpha=.3+v*.7;ctx.fillRect(x0+i*(bw+gap),base-h,bw,h); }
  ctx.globalAlpha=1;
}
function drawRadial(ctx,W,H,freq,_td,s){
  const cx=W/2,cy=H/2,R=Math.min(W,H)*(.18+s.low*.05),N=96;ctx.lineCap='round';
  for(let i=0;i<N;i++){const a=i/N*TAU-Math.PI/2,v=(freq[Math.floor(i/N*freq.length*.65)]||0)/255,len=H*(.02+v*.17);ctx.strokeStyle=i%2?s.A:s.B;ctx.globalAlpha=.22+v*.75;ctx.lineWidth=1.3+v*3;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);ctx.lineTo(cx+Math.cos(a)*(R+len),cy+Math.sin(a)*(R+len));ctx.stroke();}
  ctx.globalAlpha=.7;ctx.strokeStyle=s.A;ctx.lineWidth=2+s.low*5;ctx.beginPath();ctx.arc(cx,cy,R*(.9+s.mid*.1),0,TAU);ctx.stroke();ctx.globalAlpha=1;
}
function drawWave(ctx,W,H,_freq,td,s){
  if(!td)return;ctx.lineWidth=2.2+s.mid*3;ctx.strokeStyle=s.A;ctx.shadowColor=s.B;ctx.shadowBlur=14+s.high*28;ctx.beginPath();
  for(let i=0;i<td.length;i++){const x=i/(td.length-1)*W,y=H*.5+(td[i]-128)/128*H*(.16+s.low*.12);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();ctx.shadowBlur=0;
  ctx.globalAlpha=.16;ctx.strokeStyle=s.B;for(let k=1;k<4;k++){ctx.beginPath();for(let i=0;i<td.length;i+=2){const x=i/(td.length-1)*W,y=H*.5+(td[i]-128)/128*H*(.16+s.low*.12)+Math.sin(i*.03+s.time*k)*k*4;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}ctx.globalAlpha=1;
}
function drawOrbit(ctx,W,H,freq,_td,s){
  const cx=W/2,cy=H/2;for(let r=0;r<7;r++){const rr=Math.min(W,H)*(.08+r*.052+s.low*.014*r);ctx.strokeStyle=r%2?s.A:s.B;ctx.globalAlpha=.1+r*.055+s.mid*.2;ctx.lineWidth=1+r*.35;ctx.beginPath();ctx.ellipse(cx,cy,rr*1.55,rr,Math.sin(s.time*.08+r)*.7,0,TAU);ctx.stroke();const a=s.time*(.25+r*.03)+r;const v=(freq[(r*17)%freq.length]||0)/255;ctx.fillStyle=r%2?s.B:s.A;ctx.globalAlpha=.5+v*.5;ctx.beginPath();ctx.arc(cx+Math.cos(a)*rr*1.55,cy+Math.sin(a)*rr,3+v*9,0,TAU);ctx.fill();}ctx.globalAlpha=1;
}
function drawRibbon(ctx,W,H,freq,_td,s){
  const bands=7;for(let b=0;b<bands;b++){ctx.beginPath();for(let x=0;x<=W;x+=8){const u=x/W,ix=Math.floor(u*freq.length*.55),v=(freq[ix]||0)/255,y=H*(.2+b*.09)+Math.sin(u*TAU*(1.2+b*.13)+s.time*(.35+b*.04))*H*(.018+b*.003)+v*H*(.06+b*.004);x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle=b%2?s.A:s.B;ctx.globalAlpha=.1+b*.07+s.mid*.12;ctx.lineWidth=1.5+b*.6;ctx.stroke();}ctx.globalAlpha=1;
}
function drawTunnel(ctx,W,H,freq,_td,s){
  const cx=W/2,cy=H*.48,N=18;for(let i=N;i>=1;i--){const p=(i/N+s.time*.10)%1,depth=p*p,size=Math.min(W,H)*(.08+depth*.86),v=(freq[Math.floor((1-p)*freq.length*.5)]||0)/255;ctx.strokeStyle=i%2?s.A:s.B;ctx.globalAlpha=.05+depth*.35+v*.25;ctx.lineWidth=1+depth*4;ctx.save();ctx.translate(cx,cy);ctx.rotate(s.time*.035+i*.04);ctx.strokeRect(-size*1.3,-size*.72,size*2.6,size*1.44);ctx.restore();}ctx.globalAlpha=1;
}
function drawParticles(ctx,W,H,freq,_td,s){
  if(S.particles.length<180){for(let i=S.particles.length;i<180;i++)S.particles.push({x:Math.random(),y:Math.random(),z:Math.random(),a:Math.random()*TAU});}
  ctx.globalCompositeOperation='lighter';for(const p of S.particles){p.z+=.0015+s.low*.008;if(p.z>1)p.z=.03; p.a+=.002+s.high*.01;const spread=.15+p.z*1.15,x=W/2+(p.x-.5)*W*spread+Math.cos(p.a)*18*s.mid,y=H/2+(p.y-.5)*H*spread+Math.sin(p.a)*18*s.mid,r=.7+p.z*4+s.high*3;ctx.fillStyle=p.z>.55?s.A:s.B;ctx.globalAlpha=.12+p.z*.6;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
}
function drawMountain(ctx,W,H,freq,_td,s){
  const layers=7;for(let l=layers-1;l>=0;l--){const y0=H*(.35+l*.08),amp=H*(.035+l*.012)*(1+s.low*.8),N=70;ctx.beginPath();for(let i=0;i<=N;i++){const u=i/N,ix=Math.floor((u**1.5)*freq.length*.45),v=(freq[ix]||0)/255,y=y0-v*amp-Math.sin(u*TAU*(1.1+l*.07)+l)*H*.018;i?ctx.lineTo(u*W,y):ctx.moveTo(0,y);}ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=l%2?hexAlpha(s.A,.055+l*.045):hexAlpha(s.B,.05+l*.042);ctx.fill();ctx.strokeStyle=l%2?s.A:s.B;ctx.globalAlpha=.09+l*.075;ctx.lineWidth=1+l*.25;ctx.stroke();}ctx.globalAlpha=1;
}
function drawKaleido(ctx,W,H,freq,_td,s){
  const cx=W/2,cy=H/2,arms=12;ctx.translate(cx,cy);for(let a=0;a<arms;a++){ctx.save();ctx.rotate(a/arms*TAU+s.time*.035);for(let i=0;i<18;i++){const v=(freq[(i*7+a*3)%freq.length]||0)/255,r=Math.min(W,H)*(.06+i*.018+v*.022),sz=2+v*11;ctx.fillStyle=(i+a)%2?s.A:s.B;ctx.globalAlpha=.08+v*.5;ctx.beginPath();ctx.arc(r,Math.sin(i*.7+s.time)*r*.13,sz,0,TAU);ctx.fill();}ctx.restore();}ctx.globalAlpha=1;
}
function drawRain(ctx,W,H,freq,_td,s){
  const N=95;ctx.lineCap='round';for(let i=0;i<N;i++){const x=(i*73.21%W),phase=(i*.37+s.time*(.25+s.high*.9))%1,y=phase*H,len=H*(.02+(freq[i%freq.length]||0)/255*.055);ctx.strokeStyle=i%3?s.A:s.B;ctx.globalAlpha=.07+s.high*.34;ctx.lineWidth=.8+s.high*1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+len);ctx.stroke();}ctx.globalAlpha=1;
}

function drawOverlay(ctx,W,H,s,A,B){
  const title=$('#videoTitle').value.trim(),sub=$('#videoSubtitle').value.trim(); if(!title&&!sub)return;
  const pos=$('#titlePosition').value; let y=pos==='top'?H*.16:pos==='center'?H*.52:H*.82;
  ctx.save();ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,.72)';ctx.shadowBlur=24;ctx.shadowOffsetY=3;
  if(title){ctx.font=`800 ${Math.round(W*.045)}px ui-sans-serif,system-ui`;ctx.fillStyle='#fff';ctx.fillText(title,W/2,y);}
  if(sub){ctx.font=`600 ${Math.round(W*.016)}px ui-sans-serif,system-ui`;ctx.fillStyle=hexAlpha(A,.95);ctx.fillText(sub,W/2,y+W*.031);}
  ctx.restore();
}
function drawGrain(ctx,W,H,amount,t){
  if(!amount)return;ctx.save();ctx.globalAlpha=amount;ctx.fillStyle='#fff';const n=Math.round(260+amount*900);let seed=Math.floor(t*24)*1664525+1013904223;for(let i=0;i<n;i++){seed=(seed*1664525+1013904223)>>>0;const x=(seed%W);seed=(seed*1664525+1013904223)>>>0;const y=(seed%H);ctx.fillRect(x,y,1+(seed%2),1+(seed%2));}ctx.restore();
}

async function ensurePreviewGraph(){
  if(S.previewCtx)return;
  S.previewCtx=new AudioContext(); S.previewAnalyser=S.previewCtx.createAnalyser(); S.previewAnalyser.fftSize=1024; S.previewAnalyser.smoothingTimeConstant=.82;
  S.previewSource=S.previewCtx.createMediaElementSource($('#audioPlayer')); S.previewSource.connect(S.previewAnalyser); S.previewAnalyser.connect(S.previewCtx.destination);
  S.previewFreq=new Uint8Array(S.previewAnalyser.frequencyBinCount); S.previewTime=new Uint8Array(S.previewAnalyser.fftSize);
}
async function startPreview(){
  if(!S.audioFile){setStatus($('#renderStatus'),'Drop a track first.','err');return;}
  await ensurePreviewGraph(); await S.previewCtx.resume(); const a=$('#audioPlayer'); await a.play();
  const loop=()=>{if(a.paused)return;S.previewAnalyser.getByteFrequencyData(S.previewFreq);S.previewAnalyser.getByteTimeDomainData(S.previewTime);const state={time:a.currentTime,progress:a.duration?a.currentTime/a.duration:0,...audioBands(S.previewFreq)};drawFrame($('#stage').getContext('2d'),1280,720,S.previewFreq,S.previewTime,state);S.previewRAF=requestAnimationFrame(loop);}; cancelAnimationFrame(S.previewRAF);loop();
}
function stopPreview(){const a=$('#audioPlayer');a.pause();cancelAnimationFrame(S.previewRAF);drawIdle();}

function preferredMime(){
  return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x))||'';
}
async function renderVideo(){
  if(!S.audioBuffer||S.rendering)return setStatus($('#renderStatus'),'Drop and decode a track first.','err');
  stopPreview(); S.rendering=true; $('#renderBtn').disabled=true; $('#downloadBtn').disabled=true; $('#uploadYoutubeBtn').disabled=true; $('#renderProgress').style.width='0%';
  const canvas=$('#stage'),ctx=canvas.getContext('2d'),ac=new AudioContext(),source=ac.createBufferSource(),an=ac.createAnalyser(),dest=ac.createMediaStreamDestination(); an.fftSize=1024;an.smoothingTimeConstant=.8;source.buffer=S.audioBuffer;source.connect(an);an.connect(dest);
  const canvasStream=canvas.captureStream(30),stream=new MediaStream([...canvasStream.getVideoTracks(),...dest.stream.getAudioTracks()]),mime=preferredMime(),rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:7_000_000}:undefined),chunks=[];
  const freq=new Uint8Array(an.frequencyBinCount),td=new Uint8Array(an.fftSize);let raf,startTime=0,finished=false;
  const done=new Promise((resolve,reject)=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onerror=e=>reject(e.error||new Error('MediaRecorder failed'));rec.onstop=()=>resolve();});
  try{
    rec.start(1000); await ac.resume(); startTime=ac.currentTime; source.start();
    const loop=()=>{if(finished)return;an.getByteFrequencyData(freq);an.getByteTimeDomainData(td);const elapsed=ac.currentTime-startTime,progress=clamp(elapsed/S.audioBuffer.duration);drawFrame(ctx,canvas.width,canvas.height,freq,td,{time:elapsed,progress,...audioBands(freq)});$('#renderProgress').style.width=(progress*100).toFixed(1)+'%';$('#renderStatus').textContent=`Rendering ${Math.round(progress*100)}% · keep this tab visible`;raf=requestAnimationFrame(loop);}; loop();
    await new Promise(res=>source.onended=res); finished=true;cancelAnimationFrame(raf);rec.stop();await done;
    const blob=new Blob(chunks,{type:rec.mimeType||'video/webm'});S.renderBlob=blob;if(S.renderUrl)URL.revokeObjectURL(S.renderUrl);S.renderUrl=URL.createObjectURL(blob);$('#downloadBtn').disabled=false;$('#uploadYoutubeBtn').disabled=!S.ytToken;$('#renderProgress').style.width='100%';setStatus($('#renderStatus'),`Rendered ${(blob.size/1048576).toFixed(1)} MB WebM. Ready to download or upload.`,'ok');
    await capturePosterBlob();
  }catch(e){setStatus($('#renderStatus'),'Render failed: '+e.message,'err');}
  finally{S.rendering=false;$('#renderBtn').disabled=false;stream.getTracks().forEach(t=>t.stop());await ac.close().catch(()=>{});}
}
function downloadVideo(){if(!S.renderUrl)return;const a=document.createElement('a');a.href=S.renderUrl;a.download=(baseName(S.audioFile?.name)||'ridge-video')+'.webm';a.click();}
async function capturePosterBlob(){S.posterBlob=await new Promise(res=>$('#stage').toBlob(res,'image/jpeg',.92));return S.posterBlob;}
async function savePoster(){const blob=await capturePosterBlob();if(!blob)return;const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(baseName(S.audioFile?.name)||'ridge')+'-poster.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);}

function buildAiBrief(){
  const t=currentTemplate(),track=$('#videoTitle').value.trim()||baseName(S.audioFile?.name||'Untitled track'),theme=$('#themeInput').value.trim()||'not specified';
  $('#aiBrief').value=`You are helping package an original music video for YouTube.\n\nTrack: ${track}\nCreative template: ${t.name}\nTheme/story: ${theme}\nVisual direction: ${t.look}\nMusic direction: ${t.suno}\n\nReturn:\n1. Three clickable but truthful YouTube title options (max ~70 characters).\n2. One polished description with a strong first two lines, credits placeholders, and no fake claims.\n3. 12-18 relevant tags, comma-separated.\n4. A thumbnail headline of 2-5 words.\n5. Three scene prompts that fit the visual direction and avoid copyrighted characters, logos, artist imitation, or watermarks.\n6. One pinned-comment idea that invites a real response.\n\nKeep it specific to this track; avoid generic AI-music filler.`;
}
async function openAssistant(url){buildAiBrief();await copyText($('#aiBrief').value,'Brief copied');window.open(url,'_blank','noopener');}

function ensureGoogle(){
  if(window.google?.accounts?.oauth2)return Promise.resolve();
  return new Promise((resolve,reject)=>{let n=0;const id=setInterval(()=>{if(window.google?.accounts?.oauth2){clearInterval(id);resolve();}else if(++n>50){clearInterval(id);reject(new Error('Google Identity script did not load'));}},100);});
}
async function connectYouTube(){
  const clientId=$('#googleClientId').value.trim();if(!clientId)return setStatus($('#uploadStatus'),'Paste your Google OAuth web client ID first.','err');saveSettings();
  try{await ensureGoogle();
    if(!S.tokenClient)S.tokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/youtube.upload',callback:r=>{if(r.error){setStatus($('#uploadStatus'),'YouTube sign-in failed: '+r.error,'err');return;}S.ytToken=r.access_token;$('#ytChip').textContent='YouTube connected';$('#uploadYoutubeBtn').disabled=!S.renderBlob;setStatus($('#uploadStatus'),'Connected. Access token is kept only in memory.','ok');}});
    S.tokenClient.requestAccessToken({prompt:'consent'});
  }catch(e){setStatus($('#uploadStatus'),e.message,'err');}
}
function disconnectYouTube(){
  if(S.ytToken&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(S.ytToken,()=>{});S.ytToken=null;$('#ytChip').textContent='YouTube disconnected';$('#uploadYoutubeBtn').disabled=true;setStatus($('#uploadStatus'),'Disconnected.','ok');
}

async function uploadYouTube(){
  if(!S.renderBlob||!S.ytToken||S.uploading)return setStatus($('#uploadStatus'),'Render a video and connect YouTube first.','err');
  const title=$('#videoTitle').value.trim()||baseName(S.audioFile?.name||'Ridge music video'),description=$('#descriptionInput').value,tags=$('#tagsInput').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,50),privacyStatus=$('#privacySelect').value,categoryId=$('#categorySelect').value;
  S.uploading=true;$('#uploadYoutubeBtn').disabled=true;$('#uploadProgress').style.width='0%';setStatus($('#uploadStatus'),'Creating resumable YouTube upload…');
  try{
    const meta={snippet:{title,description,tags,categoryId},status:{privacyStatus,selfDeclaredMadeForKids:false}};
    const r=await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+S.ytToken,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(S.renderBlob.size),'X-Upload-Content-Type':S.renderBlob.type||'video/webm'},body:JSON.stringify(meta)});
    if(!r.ok)throw new Error(`YouTube session ${r.status}: ${(await r.text()).slice(0,220)}`);
    const location=r.headers.get('Location')||r.headers.get('location');if(!location)throw new Error('YouTube did not expose the resumable upload URL.');
    const video=await xhrUpload(location,S.renderBlob,p=>{$('#uploadProgress').style.width=(p*100).toFixed(1)+'%';$('#uploadStatus').textContent=`Uploading ${Math.round(p*100)}%`;});
    if($('#uploadPoster').checked&&video.id){try{const poster=S.posterBlob||await capturePosterBlob();await setThumbnail(video.id,poster);}catch(e){setStatus($('#uploadStatus'),`Video uploaded, but thumbnail was not set: ${e.message}`,'warn');}}
    $('#uploadProgress').style.width='100%';setStatus($('#uploadStatus'),`Uploaded: https://youtu.be/${video.id}`,'ok');
  }catch(e){setStatus($('#uploadStatus'),'Upload failed: '+e.message,'err');}
  finally{S.uploading=false;$('#uploadYoutubeBtn').disabled=!S.renderBlob||!S.ytToken;}
}
function xhrUpload(url,blob,onProgress){
  return new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('PUT',url);x.setRequestHeader('Content-Type',blob.type||'video/webm');x.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total)};x.onerror=()=>reject(new Error('Network error during upload'));x.onload=()=>{if(x.status>=200&&x.status<300){try{resolve(JSON.parse(x.responseText))}catch{reject(new Error('YouTube returned invalid JSON'))}}else reject(new Error(`YouTube upload ${x.status}: ${x.responseText.slice(0,220)}`));};x.send(blob);});
}
async function setThumbnail(videoId,blob){
  const r=await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,{method:'POST',headers:{Authorization:'Bearer '+S.ytToken,'Content-Type':'image/jpeg'},body:blob});
  if(!r.ok)throw new Error(`thumbnail ${r.status}`);return r.json();
}

function setStatus(el,msg,kind=''){el.textContent=msg;el.dataset.kind=kind;}

window.addEventListener('beforeunload',()=>{if(S.audioUrl)URL.revokeObjectURL(S.audioUrl);if(S.renderUrl)URL.revokeObjectURL(S.renderUrl);S.scenes.forEach(s=>URL.revokeObjectURL(s.url));});
init();
