'use strict';

const CHAT='https://api.groq.com/openai/v1/chat/completions';
const TRANSCRIBE='https://api.groq.com/openai/v1/audio/transcriptions';
export const GROQ_TEXT_MODEL='openai/gpt-oss-20b';
export const GROQ_AUDIO_MODEL='whisper-large-v3-turbo';

function parseJson(text=''){
  const t=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw new Error('Groq returned invalid JSON.');return JSON.parse(t.slice(a,b+1));
}
function errorText(text=''){try{const j=JSON.parse(text);return j?.error?.message||j?.message||text}catch{return text}}
const langGuide={
  Hindi:'Use natural contemporary Hindi in Devanagari. Do not translate the song into English. Preserve correct gender, postpositions and verb agreement.',
  Kumaoni:'Keep lyrics and metadata in natural Devanagari Kumaoni/Hindi-oriented language. Never invent fake dialect words. Prefer simple authentic phrasing.',
  Hinglish:'Use natural urban Hinglish with consistent Roman script and correct Hindi grammar. Avoid random corporate English and filler slang.',
  English:'Use idiomatic modern English. Prefer concrete human details over generic AI language.'
};

export class GroqSongBrain{
  constructor(key=''){this.key=String(key||'').trim()}
  require(){if(!this.key)throw new Error('Add your Groq key in Settings, or continue without AI metadata.')}
  async chat(messages,{temperature=.45,maxTokens=2600}={}){
    this.require();
    const r=await fetch(CHAT,{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify({model:GROQ_TEXT_MODEL,messages,temperature,max_completion_tokens:maxTokens,response_format:{type:'json_object'},reasoning_effort:'medium'})});
    if(!r.ok)throw new Error(`Groq ${r.status}: ${errorText((await r.text()).slice(0,240))}`);
    const j=await r.json();return parseJson(j.choices?.[0]?.message?.content||'');
  }
  async test(){const x=await this.chat([{role:'user',content:'Return JSON only: {"ready":true}'}],{temperature:0,maxTokens:80});return x.ready===true}
  async transcribe(file){
    this.require();if(!file)throw new Error('Choose a song first.');if(file.size>25*1024*1024)throw new Error('Groq audio analysis currently needs a song file under 25 MB. You can still create the video without AI analysis.');
    const form=new FormData();form.append('file',file,file.name||'song.mp3');form.append('model',GROQ_AUDIO_MODEL);form.append('response_format','verbose_json');form.append('timestamp_granularities[]','segment');form.append('temperature','0');
    const r=await fetch(TRANSCRIBE,{method:'POST',headers:{Authorization:'Bearer '+this.key},body:form});
    if(!r.ok)throw new Error(`Groq transcription ${r.status}: ${errorText((await r.text()).slice(0,240))}`);
    const j=await r.json();return {text:String(j.text||'').trim(),segments:Array.isArray(j.segments)?j.segments.map(s=>({start:Number(s.start)||0,end:Number(s.end)||0,text:String(s.text||'').trim()})).filter(s=>s.end>s.start).slice(0,300):[],duration:Number(j.duration)||0,language:j.language||''};
  }
  async lockMeaning({transcript='',workingLyrics='',filename='',idea='',language='Hindi'}={}){
    const guide=langGuide[language]||langGuide.English,source=String(workingLyrics||transcript||'').slice(0,16000);
    return this.chat([
      {role:'system',content:'You are the semantic director of a serious music video. Understand the lyrics as one connected story before deciding any shots. Output one JSON object only.'},
      {role:'user',content:`Create a LOCKED semantic + visual record for this song. Every later title, scene and edit must stay faithful to it.\n\nSelected language: ${language}\n${guide}\nFilename: ${filename}\nCreator idea: ${idea||'none'}\nLyrics/transcript:\n${source}\n\nRules:\n- Do not translate the song into another language.\n- Correct obvious transcription mistakes only when strongly supported by context.\n- Identify one exact central story, one chorus/hook meaning, recurring characters/places/objects, and the emotional change from beginning to end.\n- Build a continuity bible so scenes feel like ONE music video, not unrelated AI pictures. Keep the same protagonist appearance, wardrobe, world, palette and camera language unless the lyrics clearly require a change.\n- Create 8-16 chronological story_beats that follow the actual lyrical progression. Each beat must explain what the current lyric means and turn it into one coherent filmable visual idea.\n- Repeated choruses may revisit a visual motif but evolve framing/action/intensity. Verse cuts should follow lyric phrases; chorus/drop moments can cut harder; quiet passages should breathe.\n- Prefer human actions, locations, objects, weather and visual metaphors that can be searched or generated. Do not make every line literal.\n- energy is a number from 0.1 to 1.0 following emotional/musical intensity.\n- camera must be one of wide, medium, close, detail. motion should be still, drift, push, pull, track or handheld. transition should be cut, dissolve, fade, push, whip or flash.\n- Reject generic AI wording, invented plot points, celebrity/franchise references, text/logos in visuals and unrelated anime/mythology.\n- If meaning is uncertain, say so instead of inventing facts.\n\nReturn exactly this shape:\n{"language":"${language}","story":"one precise sentence","hook_meaning":"one precise sentence","clean_lyrics":"cleaned lyrics in the same language/script","mood":["3-6 words"],"visual_anchors":["4-8 concrete recurring nouns/actions"],"visual_bible":{"subject":"recurring protagonist/subject, or empty if none","setting":"main world/place and time","palette":"specific color/light progression","camera_language":"lens/framing/movement rules","continuity_rules":["3-6 continuity rules"]},"emotional_arc":"start -> middle -> ending","story_beats":[{"section":"Verse/Chorus/etc","lyric_hint":"short exact or paraphrased lyric cue","meaning":"what this part means","visual":"one coherent filmable scene faithful to visual_bible","query":"2-6 concrete English stock/generation search words","energy":0.5,"camera":"wide","motion":"drift","transition":"dissolve"}],"uncertainty":"short note or empty string","title_anchor":"2-5 words taken from or tightly implied by the hook"}.`}
    ],{temperature:.22,maxTokens:5000});
  }
  async packageFromLock(lock,{channel='@mohucool'}={}){
    const language=lock.language||'English',guide=langGuide[language]||langGuide.English;
    const out=await this.chat([
      {role:'system',content:'You package a music release without changing its meaning. The locked song record is immutable. Output one JSON object only.'},
      {role:'user',content:`LOCKED SONG RECORD\n${JSON.stringify({language:lock.language,story:lock.story,hook_meaning:lock.hook_meaning,mood:lock.mood,visual_anchors:lock.visual_anchors,title_anchor:lock.title_anchor,uncertainty:lock.uncertainty})}\n\n${guide}\n\nCreate publishing metadata from ONLY that record.\n- Title, thumbnail headline and first two description lines must describe the same hook/story.\n- Keep title and description in the selected song language unless a proper noun requires otherwise.\n- Hashtags can include globally useful English tags, but do not replace the song language.\n- No fake claims, celebrity/franchise names, unrelated mythology/anime plot or generic clickbait.\n\nReturn {"title":"under 70 chars","description":"natural concise YouTube description with story meaning and credits placeholder","hashtags":["3-5"],"tags":["10-16"],"thumbnail_headline":"2-5 words","intro":"under 6 words","outro":"under 8 words","edit_energy":"calm|medium|fast","suggested_theme":"clean|lofi-rain|romance|phonk-noir|naru-shadow|naru-chakra|naru-rain|naru-sage|naru-clash","channel":"${channel}"}.`}
    ],{temperature:.32,maxTokens:2200});
    return {...out,clean_lyrics:lock.clean_lyrics||'',language,story:lock.story||'',hook_meaning:lock.hook_meaning||'',visual_anchors:Array.isArray(lock.visual_anchors)?lock.visual_anchors:[],visual_bible:lock.visual_bible||{},story_beats:Array.isArray(lock.story_beats)?lock.story_beats:[],emotional_arc:lock.emotional_arc||''};
  }
  async analyzeSong(args={}){const lock=await this.lockMeaning(args);return {lock,package:await this.packageFromLock(lock,args)}}
}

export function fallbackPackage({filename='Original Song',language='English',lyrics='',idea=''}={}){
  const title=String(filename||'Original Song').replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim()||'Original Song';
  return {title,description:[title,idea||'Original music video.','\nMusic/visual credits: add your credits here.'].filter(Boolean).join('\n'),hashtags:['#music','#musicvideo'],tags:['music','music video'],thumbnail_headline:title.split(/\s+/).slice(0,4).join(' '),intro:title,outro:'Thanks for listening',edit_energy:'medium',suggested_theme:'clean',clean_lyrics:lyrics,language,story:idea||title,hook_meaning:idea||title,visual_anchors:[],visual_bible:{subject:'',setting:idea||title,palette:'cinematic natural color',camera_language:'stable cinematic framing',continuity_rules:['keep one visual world','repeat motifs rather than random subjects']},story_beats:[],emotional_arc:'establish -> develop -> resolve'};
}