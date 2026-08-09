'use strict';

const API='https://api.groq.com/openai/v1/chat/completions';
const MODEL='llama-3.1-8b-instant';

function cleanJson(text=''){
  const t=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t);
}
function cleanArray(text=''){
  const t=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=t.indexOf('['),b=t.lastIndexOf(']');
  return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t);
}
function errMsg(text=''){try{const j=JSON.parse(text);return j?.error?.message||j?.message||text}catch{return text}}

export class GroqHelper{
  constructor(key=''){this.key=String(key||'').trim()}
  setKey(k){this.key=String(k||'').trim()}
  requireKey(){if(!this.key)throw new Error('Add a Groq API key for smart titles/descriptions. The key is kept only for this browser tab.')}
  async chat(messages,{temperature=.75,maxTokens=2400}={}){
    this.requireKey();
    const r=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages,temperature,max_completion_tokens:maxTokens})});
    if(!r.ok)throw new Error(`Groq ${r.status}: ${errMsg((await r.text()).slice(0,220))}`);
    const j=await r.json();return j.choices?.[0]?.message?.content||'';
  }
  async test(){const out=await this.chat([{role:'user',content:'Reply with exactly READY'}],{temperature:0,maxTokens:8});return /READY/i.test(out)}
  async package({title='',theme='',language='English',music='',look='',lyrics='',channel=''}){
    const prompt=`Create concise, high-quality YouTube packaging for an ORIGINAL music video. Return JSON only.\nWorking title: ${title||'Untitled'}\nTheme: ${theme||'open emotional theme'}\nLanguage: ${language}\nMusic direction: ${music}\nVisual direction: ${look}\nChannel/artist: ${channel||'independent creator'}\nLyrics context: ${String(lyrics||'').slice(0,1800)}\n\nReturn {"title":"truthful clickable title under 70 chars","description":"natural description with strong first 2 lines, brief story/context, credits placeholders and 3-5 hashtags","hashtags":["3-5 hashtags without spaces"],"tags":["12-18 useful tags"],"thumbnail_headline":"2-5 words","pinned_comment":"one authentic question","intro":"short intro card under 8 words","outro":"short subscribe/next-video CTA under 10 words","pexels_queries":["4 specific stock-video search phrases"],"scene_prompts":["6 distinct cinematic prompts"]}. Avoid keyword stuffing, fake claims, copyrighted character names and generic AI filler.`;
    const out=cleanJson(await this.chat([{role:'system',content:'You are a sharp YouTube music-video editor. Output valid JSON only.'},{role:'user',content:prompt}],{temperature:.72,maxTokens:2600}));
    out.tags=Array.isArray(out.tags)?out.tags:[];out.hashtags=Array.isArray(out.hashtags)?out.hashtags:[];out.pexels_queries=Array.isArray(out.pexels_queries)?out.pexels_queries:[];out.scene_prompts=Array.isArray(out.scene_prompts)?out.scene_prompts:[];return out;
  }
  async dailyIdeas({count=10,themeNames=[],language='English',channel=''}){
    const n=Math.max(1,Math.min(15,Number(count)||10));
    const prompt=`Plan ${n} materially different ORIGINAL music-video concepts for ${channel||'an independent YouTube music channel'}. Language: ${language}. Available visual worlds: ${themeNames.join(', ')}. Return JSON array only. Each item: {"working_title":"short title","theme":"one available visual world name","story":"one-sentence distinct emotional/story concept","music":"specific original music direction","hook":"what makes this episode unique","pexels_query":"one stock-video query"}. Make every concept meaningfully different in story, pacing, palette, and emotional angle. Do not use copyrighted character/franchise names.`;
    const arr=cleanArray(await this.chat([{role:'system',content:'You are a creative producer planning varied original music-video episodes. Output JSON array only.'},{role:'user',content:prompt}],{temperature:.88,maxTokens:3600}));
    return (Array.isArray(arr)?arr:[]).slice(0,n);
  }
}

export const GROQ_MODEL=MODEL;
