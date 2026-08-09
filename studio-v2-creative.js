'use strict';
import {sanitizeRenderState,rgbaFromHex,finite,unit} from './studio-v2-core.js';
const TAU=Math.PI*2;
const safe=(fn)=>(ctx,W,H,freq,td,state)=>fn(ctx,Math.max(2,finite(W,2)),Math.max(2,finite(H,2)),freq||new Uint8Array(1),td,sanitizeRenderState(state));
const fv=(f,i)=>unit((f?.[Math.max(0,Math.min((f?.length||1)-1,Math.floor(finite(i,0))))]||0)/255);

export const EXTRA_TEMPLATES=[
{id:'rain-temple',name:'Rain Temple',visual:'rainglass',palette:['#9bd7ff','#7ea7ff','#07111c'],music:'atmospheric rain ballad, soft piano, low strings, distant percussion, emotional vocal or instrumental hook',look:'ancient stone temple in heavy monsoon rain, blue mist, warm lamps, cinematic reflections, volumetric weather'},
{id:'neon-monsoon',name:'Neon Monsoon',visual:'aurora',palette:['#67f7ff','#ff63b6','#110b28'],music:'moody synthwave with rain textures, pulsing bass, glassy lead, cinematic drums, memorable chorus',look:'futuristic neon city in monsoon rain, wet roads, umbrellas, cyan-magenta reflections, cinematic night'},
{id:'ninja-storm',name:'Anime Ninja Storm',visual:'thunder',palette:['#7de8ff','#8d7bff','#071022'],music:'high-energy original anime-style rock, taiko-inspired drums, bright guitars, dramatic strings, urgent hook',look:'original animated ninja world, rooftop storm, wind-whipped cloth, lightning, ink-brush energy, no copyrighted characters or logos'},
{id:'vedic-cosmos',name:'Vedic Cosmos',visual:'chakra',palette:['#ffd86a','#ff8a69','#1b103a'],music:'cinematic Indian fusion, tanpura drone, bansuri, deep percussion, strings and choir-like pads, spiritual build',look:'respectful cosmic Indian mythic imagery, sacred geometry, stars, temple silhouettes, gold-indigo light, epic scale'},
{id:'ramayana-forest',name:'Ramayana Forest Dream',visual:'fireflies',palette:['#f4c86a','#7ed49b','#162318'],music:'gentle Indian cinematic folk, flute, veena-like plucks, hand percussion, warm strings, devotional calm',look:'respectful ancient Indian forest epic atmosphere, moonlit river, lamps, giant trees, soft gold-green mist, storybook animation'},
{id:'mahabharata-epic',name:'Mahabharata Epic',visual:'mandala',palette:['#ffbf5f','#d7655b','#1a1730'],music:'epic Indian orchestral fusion, conch-like brass texture, huge drums, strings, low choir pads, heroic but solemn',look:'respectful mythic battlefield at sunrise, chariot silhouettes, dust, banners, dramatic clouds, painterly cinematic scale'},
{id:'dragon-valley',name:'Fantasy Dragon Valley',visual:'phoenix',palette:['#ff9f62','#6fd8ff','#0e1730'],music:'fantasy cinematic, soaring strings, frame drums, choir pads, flute lead, emotional adventure theme',look:'vast fantasy valley, distant original dragon silhouettes, waterfalls, floating ruins, golden-hour mist, high fantasy concept art'},
{id:'faerie-moon',name:'Moonlit Faerie',visual:'fireflies',palette:['#d6b8ff','#77e5ff','#0c1024'],music:'dream pop ambient, breathy pads, harp-like plucks, soft beat, intimate melody, shimmering textures',look:'moonlit enchanted forest, bioluminescent flowers, tiny floating lights, mist, blue-violet fantasy dreamscape'},
{id:'cyber-samurai',name:'Cyber Ronin',visual:'pulsebloom',palette:['#ff4f93','#53e3ff','#11071c'],music:'dark future bass and cinematic percussion, distorted bass, taiko-like hits, sharp synth hook',look:'original cyber ronin silhouette, rainy megacity, holographic signs without readable text, red-cyan rim light, cinematic animation'},
{id:'mythic-ocean',name:'Mythic Ocean',visual:'nebula',palette:['#63dbff','#6d7cff','#081523'],music:'oceanic ambient cinematic, deep drums, airy vocals or flute, swelling pads, slow emotional rise',look:'mythic ocean at night, glowing waves, giant moon, ancient ruins beneath water, deep blue fantasy light'},
{id:'sacred-mandala',name:'Sacred Mandala',visual:'lotus',palette:['#ffc96a','#ff7aa9','#1a1131'],music:'meditative electronic Indian fusion, tanpura-like drone, gentle percussion, soft synth pulse, serene melody',look:'abstract sacred geometry and lotus forms, gold-magenta light, temple haze, elegant symmetry, respectful spiritual atmosphere'},
{id:'beat-city',name:'Animated Beat City',visual:'pulsebloom',palette:['#71e6ff','#ff6aa9','#0c1022'],music:'upbeat electronic pop instrumental, punchy drums, bass groove, catchy synth motif, bright transitions',look:'stylized animated city synced to music, bold shapes, light trails, windows pulsing with beat, playful cinematic motion'}
];

export const THEME_PACKS=EXTRA_TEMPLATES.map(t=>({id:t.id,name:t.name,template:t.id,visual:t.visual,pexels:({
  'rain-temple':['monsoon rain temple','rain forest temple','heavy rain night','wet stone lantern'],
  'neon-monsoon':['neon city rain','rainy street night','cyberpunk city rain','wet road neon'],
  'ninja-storm':['storm clouds city rooftop','martial arts silhouette','lightning storm night','windy mountain fog'],
  'vedic-cosmos':['temple silhouette sunset','stars night sky india','sacred geometry light','himalaya sunrise clouds'],
  'ramayana-forest':['ancient forest river','india forest sunrise','oil lamps river','misty jungle moonlight'],
  'mahabharata-epic':['sunrise dust landscape','ancient battlefield landscape','horses sunset silhouette','dramatic clouds sunrise'],
  'dragon-valley':['fantasy mountains valley','waterfall mountains mist','epic valley sunrise','clouds mountain aerial'],
  'faerie-moon':['moonlit forest','fireflies forest night','enchanted woods mist','blue forest bokeh'],
  'cyber-samurai':['rain city neon','martial arts silhouette night','city neon fog','red cyan lights'],
  'mythic-ocean':['ocean moon night','waves slow motion','underwater ruins','blue sea aerial'],
  'sacred-mandala':['temple lamps india','incense smoke dark','lotus water closeup','golden bokeh spiritual'],
  'beat-city':['city timelapse night','animated lights city','traffic lights bokeh','night skyline timelapse']
})[t.id]||[t.name]}));

function aurora(ctx,W,H,f,_td,s){ctx.save();ctx.globalCompositeOperation='screen';for(let k=0;k<6;k++){ctx.beginPath();for(let x=0;x<=W;x+=12){const u=x/W,v=fv(f,u*f.length*.5),y=H*(.18+k*.09)+Math.sin(u*TAU*(1.1+k*.16)+s.time*(.25+k*.035))*H*(.035+v*.055);x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=k%2?s.A:s.B;ctx.globalAlpha=.06+k*.035+s.mid*.12;ctx.lineWidth=8+k*3;ctx.stroke()}ctx.restore()}
function rainglass(ctx,W,H,f,_td,s){ctx.save();for(let i=0;i<140;i++){const x=(i*97.37)%W,spd=.22+((i*17)%33)/80+s.high*.35,phase=(i*.129+s.time*spd)%1,y=phase*H,len=H*(.025+fv(f,i*3)*.08);const g=ctx.createLinearGradient(x,y,x-8,y+len);g.addColorStop(0,rgbaFromHex(s.A,.05));g.addColorStop(1,rgbaFromHex(s.B,.42+s.high*.22));ctx.strokeStyle=g;ctx.lineWidth=.7+fv(f,i)*1.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+len);ctx.stroke()}ctx.globalAlpha=.07+s.low*.08;for(let i=0;i<24;i++){ctx.strokeStyle=i%2?s.A:s.B;ctx.beginPath();ctx.arc((i*83)%W,(i*47+s.time*19)%H,10+(i%5)*5,0,TAU);ctx.stroke()}ctx.restore()}
function thunder(ctx,W,H,f,_td,s){ctx.save();const flash=Math.pow(fv(f,2),3)*.5+s.high*.12;if(flash>.06){ctx.fillStyle=`rgba(220,240,255,${unit(flash)})`;ctx.fillRect(0,0,W,H)}const branches=4;for(let b=0;b<branches;b++){const seed=b*77+(s.time*.8|0),x0=W*(.2+.18*b);ctx.strokeStyle=b%2?s.A:s.B;ctx.globalAlpha=.12+s.high*.5;ctx.lineWidth=1.4+s.high*4;ctx.beginPath();let x=x0,y=0;ctx.moveTo(x,y);for(let j=1;j<12;j++){y=H*j/12;x+=Math.sin(seed+j*3.7)*W*.025+(fv(f,j*8)-.5)*W*.04;ctx.lineTo(x,y)}ctx.stroke()}ctx.restore()}
function lotus(ctx,W,H,f,_td,s){ctx.save();ctx.translate(W/2,H/2);for(let ring=0;ring<5;ring++){const petals=8+ring*4,R=Math.min(W,H)*(.07+ring*.052+s.low*.012);for(let i=0;i<petals;i++){const a=i/petals*TAU+s.time*(ring%2?.025:-.018),v=fv(f,i*5+ring*13);ctx.save();ctx.rotate(a);ctx.translate(R,0);ctx.rotate(Math.PI/2);ctx.fillStyle=ring%2?rgbaFromHex(s.A,.08+v*.28):rgbaFromHex(s.B,.08+v*.26);ctx.beginPath();ctx.ellipse(0,0,6+v*9,18+v*24,0,0,TAU);ctx.fill();ctx.restore()}}ctx.restore()}
function mandala(ctx,W,H,f,_td,s){ctx.save();ctx.translate(W/2,H/2);for(let ring=0;ring<7;ring++){const N=12+ring*6,R=Math.min(W,H)*(.045+ring*.045);ctx.rotate((ring%2?1:-1)*s.time*.004);for(let i=0;i<N;i++){const a=i/N*TAU,v=fv(f,i*4+ring*11),r=2+v*7;ctx.fillStyle=(i+ring)%2?s.A:s.B;ctx.globalAlpha=.055+v*.35;ctx.beginPath();ctx.arc(Math.cos(a)*R,Math.sin(a)*R,r,0,TAU);ctx.fill()}}ctx.restore();ctx.globalAlpha=1}
function nebula(ctx,W,H,f,_td,s){ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<8;i++){const x=W*(.15+((i*31)%70)/100),y=H*(.15+((i*47)%68)/100),r=Math.min(W,H)*(.12+.025*i+s.low*.04),g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgbaFromHex(i%2?s.A:s.B,.10+s.mid*.14));g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}ctx.restore()}
function fireflies(ctx,W,H,_f,_td,s){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<90;i++){const a=i*12.9898,x=((Math.sin(a)*43758.5453)%1+1)%1,y=((Math.sin(a*1.37)*12345.678)%1+1)%1,px=(x+.035*Math.sin(s.time*.2+i))%1*W,py=(y+.025*Math.cos(s.time*.17+i*.7))%1*H,r=1.2+((i*19)%7)/4+s.mid*2;ctx.fillStyle=i%3?s.A:s.B;ctx.globalAlpha=.08+.4*((Math.sin(s.time*1.7+i)+1)/2);ctx.beginPath();ctx.arc(px,py,r,0,TAU);ctx.fill()}ctx.restore();ctx.globalAlpha=1}
function pulsebloom(ctx,W,H,f,_td,s){ctx.save();ctx.translate(W/2,H/2);const bass=.8+s.low*.55;for(let r=0;r<9;r++){const N=24,base=Math.min(W,H)*(.035+r*.035)*bass;ctx.beginPath();for(let i=0;i<=N;i++){const a=i/N*TAU,v=fv(f,i*5+r*7),rad=base*(1+v*.18),x=Math.cos(a)*rad,y=Math.sin(a)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.strokeStyle=r%2?s.A:s.B;ctx.globalAlpha=.06+r*.025+s.energy*.18;ctx.lineWidth=1+r*.4;ctx.stroke()}ctx.restore();ctx.globalAlpha=1}
function phoenix(ctx,W,H,f,_td,s){ctx.save();ctx.translate(W/2,H*.66);ctx.globalCompositeOperation='lighter';for(let i=0;i<80;i++){const a=(-Math.PI*.9)+(i/79)*Math.PI*.8,spread=Math.sin(i*.7+s.time*.3)*.12,life=.2+((i*17)%80)/100,v=fv(f,i*3),R=Math.min(W,H)*(.16+life*.42+s.low*.05);const x=Math.cos(a+spread)*R,y=-Math.abs(Math.sin(a+spread))*R*(.55+life*.5),r=1+v*5+(1-life)*2;ctx.fillStyle=i%2?s.A:s.B;ctx.globalAlpha=.04+v*.38;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}ctx.restore();ctx.globalAlpha=1}
function chakra(ctx,W,H,f,_td,s){ctx.save();ctx.translate(W/2,H/2);const R=Math.min(W,H)*(.28+s.low*.03),N=32;for(let i=0;i<N;i++){const a=i/N*TAU+s.time*.03,v=fv(f,i*6);ctx.strokeStyle=i%2?s.A:s.B;ctx.globalAlpha=.08+v*.32;ctx.lineWidth=1+v*2.6;ctx.beginPath();ctx.moveTo(Math.cos(a)*R*.25,Math.sin(a)*R*.25);ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R);ctx.stroke();ctx.beginPath();ctx.arc(0,0,R*(.34+i/N*.02),a,a+TAU/N*.7);ctx.stroke()}ctx.restore();ctx.globalAlpha=1}

export const EXTRA_VISUALS={
  aurora:{label:'Aurora Veil',draw:safe(aurora)},
  rainglass:{label:'Rain Glass',draw:safe(rainglass)},
  thunder:{label:'Storm Lightning',draw:safe(thunder)},
  lotus:{label:'Lotus Bloom',draw:safe(lotus)},
  mandala:{label:'Sacred Mandala',draw:safe(mandala)},
  nebula:{label:'Dream Nebula',draw:safe(nebula)},
  fireflies:{label:'Firefly Forest',draw:safe(fireflies)},
  pulsebloom:{label:'Beat Bloom',draw:safe(pulsebloom)},
  phoenix:{label:'Phoenix Sparks',draw:safe(phoenix)},
  chakra:{label:'Cosmic Chakra',draw:safe(chakra)}
};
