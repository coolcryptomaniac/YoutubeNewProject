'use strict';
import {buildLyricsPrompt,buildPolishPrompt,buildAnalysisPrompt,languageCompliance} from './studio-v2-prompts.js';

const CHAT_API='https://api.groq.com/openai/v1/chat/completions';
const TRANSCRIBE_API='https://api.groq.com/openai/v1/audio/transcriptions';
const MODEL='openai/gpt-oss-20b';
const WHISPER='whisper-large-v3-turbo';

function cleanJson(text=''){
  const t=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  return JSON.parse(a>=0&&b>a?t.slice(a,b+1):t);
}
function errMsg(text=''){try{const j=JSON.parse(text);return j?.error?.message||j?.message||text}catch{return text}}

export class GroqHelper{
  constructor(key=''){this.key=String(key||'').trim()}
  setKey(k){this.key=String(k||'').trim()}
  requireKey(){if(!this.key)throw new Error('Add a Groq API key. Ridge can remember it in the persistent local credential vault.')}
  async chat(messages,{temperature=.72,maxTokens=2600,reasoning='medium'}={}){
    this.requireKey();
    const body={model:MODEL,messages,temperature,max_completion_tokens:maxTokens,response_format:{type:'json_object'},reasoning_effort:reasoning};
    const r=await fetch(CHAT_API,{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok)throw new Error(`Groq ${r.status}: ${errMsg((await r.text()).slice(0,260))}`);
    const j=await r.json();return j.choices?.[0]?.message?.content||'';
  }
  async test(){
    this.requireKey();
    const r=await fetch(CHAT_API,{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'user',content:'Return JSON only: {"ready":true}'}],temperature:0,max_completion_tokens:48,response_format:{type:'json_object'},reasoning_effort:'low'})});
    if(!r.ok)throw new Error(`Groq ${r.status}: ${errMsg((await r.text()).slice(0,180))}`);
    const j=await r.json();return /ready/i.test(j.choices?.[0]?.message?.content||'');
  }
  async lyrics({idea='',language='Hindi',style='',duration=150,combo=''}={}){
    const draft=cleanJson(await this.chat([
      {role:'system',content:'You are a professional songwriter. Think privately like a human writer: story first, hook second, rhyme third. Output one valid JSON object only.'},
      {role:'user',content:buildLyricsPrompt({idea,language,style,duration,combo})}
    ],{temperature:.86,maxTokens:3600,reasoning:'medium'}));
    let final=draft;
    try{
      final=cleanJson(await this.chat([
        {role:'system',content:'You are a senior lyric editor. Preserve strong ideas, but aggressively fix robotic wording, grammar, forced rhyme, weak imagery and language/script mistakes. Output valid JSON only.'},
        {role:'user',content:buildPolishPrompt({draft,idea,language,style})}
      ],{temperature:.45,maxTokens:3600,reasoning:'medium'}));
    }catch(e){console.warn('Lyric polish pass failed; using draft',e)}
    const out={...draft,...final};
    const compliance=languageCompliance(out.lyrics||'',language);out.language_check=compliance;
    if(!out.song_title)out.song_title=draft.song_title||'Untitled';
    if(!out.suno_prompt)out.suno_prompt=draft.suno_prompt||style;
    return out;
  }
  async transcribeAudio(file,{language=''}={}){
    this.requireKey();
    if(!file)throw new Error('Load a song first.');
    if(file.size>25*1024*1024)throw new Error('For the current browser transcription flow, use an MP3/M4A/WAV smaller than 25 MB.');
    const form=new FormData();form.append('file',file,file.name||'song.mp3');form.append('model',WHISPER);form.append('response_format','verbose_json');form.append('timestamp_granularities[]','segment');form.append('temperature','0');if(language&&language.length===2)form.append('language',language);
    const r=await fetch(TRANSCRIBE_API,{method:'POST',headers:{Authorization:'Bearer '+this.key},body:form});
    if(!r.ok)throw new Error(`Groq transcription ${r.status}: ${errMsg((await r.text()).slice(0,240))}`);
    const j=await r.json();return {text:String(j.text||'').trim(),segments:Array.isArray(j.segments)?j.segments:[],duration:Number(j.duration)||0,language:j.language||''};
  }
  async analyzeSong({transcript='',workingLyrics='',workingTitle='',theme='',language='English',channel=''}={}){
    const prompt=buildAnalysisPrompt({transcript,workingLyrics,workingTitle,theme,language,channel});
    const out=cleanJson(await this.chat([
      {role:'system',content:'You are a meticulous music-video editor and release strategist. The song is the source of truth. Keep lyrics, title, description, thumbnail and visuals consistent. Output valid JSON only.'},
      {role:'user',content:prompt}
    ],{temperature:.55,maxTokens:4000,reasoning:'medium'}));
    for(const k of ['hashtags','tags','pexels_queries','scene_prompts'])if(!Array.isArray(out[k]))out[k]=[];
    out.language_check=languageCompliance(out.clean_lyrics||workingLyrics||'',language);
    return out;
  }
  async package({title='',theme='',language='English',music='',look='',lyrics='',channel=''}){
    return this.analyzeSong({workingTitle:title,theme,language,channel,workingLyrics:lyrics,transcript:lyrics||`${music}\n${look}`});
  }
  async dailyIdeas({count=10,themeNames=[],language='English',channel=''}){
    const n=Math.max(1,Math.min(15,Number(count)||10));
    const prompt=`Return JSON object {"ideas":[...]} with ${n} materially different ORIGINAL music-video concepts for ${channel||'an independent YouTube music channel'}. Language: ${language}. Available visual worlds: ${themeNames.join(', ')}. Each item: {"working_title":"short title","theme":"one available visual world name","story":"specific one-sentence emotional/story concept","music":"specific original music direction","hook":"unique human detail","pexels_query":"one concrete stock-video query"}. Avoid copyrighted character/franchise names, generic AI phrases and repeated plots.`;
    const obj=cleanJson(await this.chat([{role:'system',content:'You are a creative producer. Output valid JSON only.'},{role:'user',content:prompt}],{temperature:.8,maxTokens:3600,reasoning:'medium'}));
    return (Array.isArray(obj.ideas)?obj.ideas:[]).slice(0,n);
  }
}

export const GROQ_MODEL=MODEL;
export const GROQ_WHISPER_MODEL=WHISPER;