'use strict';

function hash(s=''){let h=2166136261>>>0;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000}}
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
const note=n=>440*Math.pow(2,(n-69)/12);

function writeWav(left,right,sr=44100){
  const n=Math.min(left.length,right.length),buf=new ArrayBuffer(44+n*4),v=new DataView(buf);let o=0;
  const str=s=>{for(const c of s)v.setUint8(o++,c.charCodeAt(0))};
  str('RIFF');v.setUint32(o,36+n*4,true);o+=4;str('WAVE');str('fmt ');v.setUint32(o,16,true);o+=4;v.setUint16(o,1,true);o+=2;v.setUint16(o,2,true);o+=2;v.setUint32(o,sr,true);o+=4;v.setUint32(o,sr*4,true);o+=4;v.setUint16(o,4,true);o+=2;v.setUint16(o,16,true);o+=2;str('data');v.setUint32(o,n*4,true);o+=4;
  for(let i=0;i<n;i++){v.setInt16(o,Math.round(clamp(left[i])*.96*32767),true);o+=2;v.setInt16(o,Math.round(clamp(right[i])*.96*32767),true);o+=2}
  return new Blob([buf],{type:'audio/wav'});
}

export async function generateLocalMusic({duration=45,style='dream',seed='ridge',tempo=92}={}){
  const sr=44100,d=Math.max(12,Math.min(90,Number(duration)||45)),n=Math.floor(sr*d),L=new Float32Array(n),R=new Float32Array(n),random=rng(hash(seed+style)),bpm=Math.max(60,Math.min(150,Number(tempo)||92)),beat=60/bpm;
  const scales={dream:[57,60,64,67,69],rain:[55,59,62,67,69],mythic:[50,55,57,62,64],neon:[45,52,57,60,64],ninja:[52,55,59,62,64],ambient:[48,55,60,62,67]};
  const scale=scales[style]||scales.dream,prog=[0,3,1,4],bar=beat*4;
  for(let i=0;i<n;i++){
    const t=i/sr,barIx=Math.floor(t/bar),root=scale[prog[barIx%prog.length]%scale.length],phase=t%bar,env=.72+.28*Math.sin(Math.PI*Math.min(1,phase/bar));
    let l=0,r=0;
    for(let k=0;k<3;k++){const f=note(root+[0,7,12][k]),p=Math.sin(2*Math.PI*f*t+(.2*k));const amp=[.105,.07,.045][k]*env;l+=p*amp*(1-.08*k);r+=p*amp*(.92+.06*k)}
    const pulse=Math.pow(Math.max(0,1-(t%beat)/(.13+beat*.05)),5),kick=Math.sin(2*Math.PI*(52+18*pulse)*t)*pulse*.28;
    const snPos=t%(beat*2),sn=snPos>beat&&snPos<beat+.07?(random()*2-1)*Math.pow(1-(snPos-beat)/.07,3)*.13:0;
    const hatPos=t%(beat/2),hat=hatPos<.025?(random()*2-1)*Math.pow(1-hatPos/.025,4)*.045:0;
    const arpStep=Math.floor(t/(beat/2)),arpN=scale[(arpStep+barIx)%scale.length]+12,arpPhase=t%(beat/2),arpEnv=Math.pow(Math.max(0,1-arpPhase/(beat*.42)),2),arp=Math.sin(2*Math.PI*note(arpN)*t)*arpEnv*.055;
    const air=(random()*2-1)*.009*(style==='rain'?1.8:.7);
    const fadeIn=Math.min(1,t/1.8),fadeOut=Math.min(1,(d-t)/2.4),fade=Math.max(0,Math.min(fadeIn,fadeOut));
    l=(l+kick+sn+hat+arp+air)*fade;r=(r+kick+sn*.85-hat*.5+arp*.92-air*.35)*fade;
    L[i]=l;R[i]=r;
    if(i%500000===0)await new Promise(res=>setTimeout(res,0));
  }
  return writeWav(L,R,sr);
}

export function localMusicPreset(themeId=''){
  const id=String(themeId).toLowerCase();
  if(id.includes('rain')||id.includes('monsoon'))return{style:'rain',tempo:82};
  if(id.includes('ninja')||id.includes('anime'))return{style:'ninja',tempo:124};
  if(id.includes('vedic')||id.includes('myth')||id.includes('ramayana')||id.includes('mahabharata'))return{style:'mythic',tempo:88};
  if(id.includes('neon')||id.includes('cyber'))return{style:'neon',tempo:112};
  if(id.includes('ambient')||id.includes('space')||id.includes('ocean'))return{style:'ambient',tempo:74};
  return{style:'dream',tempo:94};
}
