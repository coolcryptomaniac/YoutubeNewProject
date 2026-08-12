const safe = (v, n=4000) => String(v ?? '').trim().slice(0,n);

export class SocialPublishError extends Error {
  constructor(message,{status=502,code='SOCIAL_PROVIDER_ERROR',detail=null}={}){
    super(message); this.name='SocialPublishError'; this.status=status; this.code=code; this.detail=detail;
  }
}

async function requestJson(url, opts={}){
  const r=await fetch(url,opts); const text=await r.text(); let data={};
  try{ data=text?JSON.parse(text):{} }catch{ data={raw:text.slice(0,1000)} }
  if(!r.ok){
    const msg=data?.error?.message||data?.message||data?.raw||`${r.status} ${r.statusText}`;
    throw new SocialPublishError(safe(msg,500),{status:r.status,detail:data});
  }
  return {data,headers:r.headers,status:r.status};
}

export function socialCapabilities(env){
  return {
    linkedin:{
      configured:!!(env.LINKEDIN_ACCESS_TOKEN&&env.LINKEDIN_AUTHOR_URN),
      modes:['text'],
      note:'Image/video publishing can be added after asset-upload permissions are approved.'
    },
    facebook:{
      configured:!!(env.FACEBOOK_PAGE_ACCESS_TOKEN&&env.FACEBOOK_PAGE_ID),
      modes:['text','link'],
      note:'Publishes to a Facebook Page, not a personal profile.'
    },
    instagram:{
      configured:!!(env.INSTAGRAM_ACCESS_TOKEN&&env.INSTAGRAM_USER_ID),
      modes:['image','reel'],
      needsPublicMediaUrl:true,
      note:'Requires a professional Instagram account and a public HTTPS media URL.'
    },
    youtube:{
      configured:false,
      browserOAuth:true,
      modes:['video'],
      note:'Ridge uploads YouTube videos with the user OAuth flow in the browser; no Google password is stored.'
    }
  };
}

async function publishLinkedIn(env,post){
  if(!env.LINKEDIN_ACCESS_TOKEN||!env.LINKEDIN_AUTHOR_URN) throw new SocialPublishError('LinkedIn is not configured',{status:503,code:'LINKEDIN_NOT_CONFIGURED'});
  const commentary=safe(post.text||post.caption,3000); if(!commentary) throw new SocialPublishError('LinkedIn text is required',{status:400,code:'BAD_REQUEST'});
  const version=safe(env.LINKEDIN_VERSION||'202607',6);
  const body={author:env.LINKEDIN_AUTHOR_URN,commentary,visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false};
  const {headers}=await requestJson('https://api.linkedin.com/rest/posts',{method:'POST',headers:{Authorization:`Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,'Content-Type':'application/json','X-Restli-Protocol-Version':'2.0.0','Linkedin-Version':version},body:JSON.stringify(body)});
  return {ok:true,platform:'linkedin',id:headers.get('x-restli-id')||null};
}

async function publishFacebook(env,post){
  if(!env.FACEBOOK_PAGE_ACCESS_TOKEN||!env.FACEBOOK_PAGE_ID) throw new SocialPublishError('Facebook Page is not configured',{status:503,code:'FACEBOOK_NOT_CONFIGURED'});
  const version=safe(env.META_GRAPH_VERSION||'v25.0',12);
  const body=new URLSearchParams(); body.set('message',safe(post.text||post.caption,60000));
  if(post.link) body.set('link',safe(post.link,2000));
  body.set('access_token',env.FACEBOOK_PAGE_ACCESS_TOKEN);
  const {data}=await requestJson(`https://graph.facebook.com/${version}/${encodeURIComponent(env.FACEBOOK_PAGE_ID)}/feed`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  return {ok:true,platform:'facebook',id:data.id||null};
}

async function igContainerStatus(env,id){
  const version=safe(env.META_GRAPH_VERSION||'v25.0',12);
  const qs=new URLSearchParams({fields:'status_code,status',access_token:env.INSTAGRAM_ACCESS_TOKEN});
  const {data}=await requestJson(`https://graph.facebook.com/${version}/${encodeURIComponent(id)}?${qs}`);
  return data;
}
async function waitInstagram(env,id){
  for(let i=0;i<18;i++){
    const s=await igContainerStatus(env,id); if(s.status_code==='FINISHED') return s;
    if(['ERROR','EXPIRED'].includes(s.status_code)) throw new SocialPublishError(`Instagram container ${s.status_code.toLowerCase()}`,{detail:s});
    await new Promise(r=>setTimeout(r,2500));
  }
  throw new SocialPublishError('Instagram media is still processing; retry shortly',{status:202,code:'INSTAGRAM_PROCESSING',detail:{creationId:id}});
}

async function publishInstagram(env,post){
  if(!env.INSTAGRAM_ACCESS_TOKEN||!env.INSTAGRAM_USER_ID) throw new SocialPublishError('Instagram is not configured',{status:503,code:'INSTAGRAM_NOT_CONFIGURED'});
  const mediaUrl=safe(post.mediaUrl,2000); if(!/^https:\/\//i.test(mediaUrl)) throw new SocialPublishError('Instagram requires a public HTTPS mediaUrl',{status:400,code:'MEDIA_URL_REQUIRED'});
  const version=safe(env.META_GRAPH_VERSION||'v25.0',12), isVideo=(post.mediaType||'').toLowerCase()==='video'||/\.(mp4|mov|m4v)(?:$|\?)/i.test(mediaUrl);
  const create=new URLSearchParams({caption:safe(post.text||post.caption,2200),access_token:env.INSTAGRAM_ACCESS_TOKEN});
  if(isVideo){ create.set('media_type','REELS'); create.set('video_url',mediaUrl); }
  else create.set('image_url',mediaUrl);
  const {data}=await requestJson(`https://graph.facebook.com/${version}/${encodeURIComponent(env.INSTAGRAM_USER_ID)}/media`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:create});
  const creationId=data.id; if(!creationId) throw new SocialPublishError('Instagram returned no creation id',{detail:data});
  await waitInstagram(env,creationId);
  const publish=new URLSearchParams({creation_id:creationId,access_token:env.INSTAGRAM_ACCESS_TOKEN});
  const out=await requestJson(`https://graph.facebook.com/${version}/${encodeURIComponent(env.INSTAGRAM_USER_ID)}/media_publish`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:publish});
  return {ok:true,platform:'instagram',id:out.data.id||null,creationId};
}

export async function publishSocial(env,platform,post={}){
  switch(platform){
    case 'linkedin': return publishLinkedIn(env,post);
    case 'facebook': return publishFacebook(env,post);
    case 'instagram': return publishInstagram(env,post);
    default: throw new SocialPublishError(`Unsupported social platform: ${platform}`,{status:400,code:'UNSUPPORTED_PLATFORM'});
  }
}

export async function crossPost(env,{platforms=[],post={}}={}){
  const wanted=[...new Set(platforms.map(x=>safe(x,24).toLowerCase()))].filter(x=>['linkedin','facebook','instagram'].includes(x));
  if(!wanted.length) throw new SocialPublishError('Choose at least one supported social platform',{status:400,code:'NO_PLATFORMS'});
  const settled=await Promise.all(wanted.map(async platform=>{
    try{return [platform,{ok:true,result:await publishSocial(env,platform,post)}]}
    catch(e){return [platform,{ok:false,error:safe(e?.message||e,400),code:e?.code||'SOCIAL_PROVIDER_ERROR',status:e?.status||502}]}
  }));
  const results=Object.fromEntries(settled); return {ok:Object.values(results).every(x=>x.ok),partial:Object.values(results).some(x=>x.ok),results};
}
