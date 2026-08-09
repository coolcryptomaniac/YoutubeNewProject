'use strict';

const CHAT_API='https://api.groq.com/openai/v1/chat/completions';
const TRANSCRIBE_API='https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL='llama-3.1-8b-instant';
const WHISPER='whisper-large-v3-turbo';

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
  requireKey(){if(!this.key)throw new Error('Add a Groq API key. It is kept only for this browser tab.')}
  async chat(messages,{temperature=.72,maxTokens=2600}={}){
    this.requireKey();
    const r=await fetch(CHAT_API,{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages,temperature,max_completion_tokens:maxTokens,response_format:{type:'json_object'}})});
    if(!r.ok)throw new Error(`Groq ${r.status}: ${errMsg((await r.text()).slice(0,220))}`);
    const j=await r.json();return j.choices?.[0]?.message?.content||'';
  }
  async test(){
    this.requireKey();
    const r=await fetch(CHAT_API,{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:'Return JSON: {"ready":true}'}],temperature:0,max_completion_tokens:24,response_format:{type:'json_object'}})});
    if(!r.ok)throw new Error(`Groq ${r.status}: ${errMsg((await r.text()).slice(0,180))}`);
    const j=await r.json();return /ready/i.test(j.choices?.[0]?.message?.content||'');
  }
  async lyrics({idea='',language='Hindi',style='',duration=150}={}){
    const prompt=`Write ORIGINAL song lyrics for a music generator. Return JSON only.\nIdea/story: ${idea||'an emotional journey with a memorable hook'}\nLanguage: ${language}\nMusic/style: ${style||'cinematic modern song'}\nTarget duration: about ${duration} seconds.\n\nReturn {"song_title":"short memorable original title","lyrics":"complete lyrics using [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Final Chorus] labels","suno_prompt":"concise production/style prompt under 900 characters, no living artist names","mood":"3-6 words"}. Make the chorus immediately memorable, avoid generic filler, avoid copyrighted lyrics/characters and keep pronunciation natural.`;
    return cleanJson(await this.chat([{role:'system',content:'You are an expert songwriter. Output one valid JSON object only.'},{role:'user',content:prompt}],{temperature:.82,maxTokens:3200}));
  }
  async transcribeAudio(file,{language=''}={}){
    this.requireKey();
    if(!file)throw new Error('Load a song first.');
    if(file.size>25*1024*1024)throw new Error('For the Groq free-tier audio limit, use an MP3/M4A/WAV smaller than 25 MB.');
    const form=new FormData();
    form.append('file',file,file.name||'song.mp3');
    form.append('model',WHISPER);
    form.append('response_format','verbose_json');
    form.append('timestamp_granularities[]','segment');
    form.append('temperature','0');
    if(language&&language.length===2)form.append('language',language);
    const r=await fetch(TRANSCRIBE_API,{method:'POST',headers:{Authorization:'Bearer '+this.key},body:form});
    if(!r.ok)throw new Error(`Groq transcription ${r.status}: ${errMsg((await r.text()).slice(0,240))}`);
    const j=await r.json();
    return {text:String(j.text||'').trim(),segments:Array.isArray(j.segments)?j.segments:[],duration:Number(j.duration)||0,language:j.language||''};
  }
  async analyzeSong({transcript='',workingLyrics='',workingTitle='',theme='',language='English',channel=''}={}){
    const source=String(transcript||workingLyrics||'').slice(0,14000);
    const prompt=`Analyze this ORIGINAL song like a sharp music-video editor. Return JSON only.\nWorking title: ${workingTitle||'Untitled'}\nTheme hint: ${theme||'infer it from the song'}\nLanguage hint: ${language}\nChannel/artist: ${channel||'independent creator'}\nTranscribed/working lyrics:\n${source}\n\nReturn {"title":"best truthful music-video title under 70 characters","clean_lyrics":"cleaned lyrics reconstructed from the transcript; keep original language; add simple [Verse]/[Chorus]/[Bridge] labels where reasonably inferable","description":"natural YouTube description with strongest two lines first, short song meaning/context, credits placeholders and 3-5 hashtags","hashtags":["3-5 hashtags"],"tags":["12-18 useful search tags"],"thumbnail_headline":"2-5 words","thumbnail_prompt":"cinematic 16:9 thumbnail background prompt, one strong focal subject, dramatic light, negative space for headline, no text/logo/watermark","pexels_queries":["4 concrete visual search phrases that work for both Pexels photos and videos and map to exact lyric/story moments"],"scene_prompts":["6 cinematic image prompts related to exact lyric/story moments, visually coherent but compositionally varied"],"intro":"short punchy intro card under 7 words","outro":"short end-card CTA under 9 words","mood":"short mood","visual_theme":"short visual direction","edit_profile":"one of phonk, hyper, naru, rain, dream, mythic, clean","visualizer_hint":"one visual motif such as lightning, rain, aura, speed lines, particles, mandala, spectrum, tunnel","lyric_animation":"one of cinematic, karaoke, kinetic, wordpop, glitch, manga, outline, vertical","thumbnail_style":"one of impact, naru, chrome, rain, mythic, minimal"}. Favor specific visual nouns and locations over abstract adjectives. If the song feels aggressive/dark/drift-oriented, choose a high-energy phonk-like edit profile; if it is anime/ninja-inspired choose naru. Avoid keyword stuffing, fake claims, copyrighted franchise/character names, logos and celebrity imitation.`;
    const out=cleanJson(await this.chat([{role:'system',content:'You are a viral music-video editor who turns an actual song into accurate metadata, stock-search phrases, visual direction and edit decisions. Output valid JSON only.'},{role:'user',content:prompt}],{temperature:.64,maxTokens:3800}));
    for(const k of ['hashtags','tags','pexels_queries','scene_prompts'])if(!Array.isArray(out[k]))out[k]=[];
    return out;
  }
  async package({title='',theme='',language='English',music='',look='',lyrics='',channel=''}){
    return this.analyzeSong({workingTitle:title,theme,language,channel,workingLyrics:lyrics,transcript:lyrics||`${music}\n${look}`});
  }
  async dailyIdeas({count=10,themeNames=[],language='English',channel=''}){
    const n=Math.max(1,Math.min(15,Number(count)||10));
    const prompt=`Return JSON object {"ideas":[...]} with ${n} materially different ORIGINAL music-video concepts for ${channel||'an independent YouTube music channel'}. Language: ${language}. Available visual worlds: ${themeNames.join(', ')}. Each item: {"working_title":"short title","theme":"one available visual world name","story":"one-sentence distinct emotional/story concept","music":"specific original music direction","hook":"what makes this episode unique","pexels_query":"one stock-video query"}. Do not use copyrighted character/franchise names.`;
    const obj=cleanJson(await this.chat([{role:'system',content:'You are a creative producer. Output valid JSON only.'},{role:'user',content:prompt}],{temperature:.86,maxTokens:3600}));
    return (Array.isArray(obj.ideas)?obj.ideas:[]).slice(0,n);
  }
}

export const GROQ_MODEL=MODEL;
export const GROQ_WHISPER_MODEL=WHISPER;
