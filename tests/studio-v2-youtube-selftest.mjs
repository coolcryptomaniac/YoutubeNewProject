import assert from 'node:assert/strict';

const fetchCalls=[];
globalThis.fetch=async (url,opts={})=>{
  fetchCalls.push({url,opts});
  if(String(url).includes('videos?uploadType=resumable')){
    assert.equal(opts.headers.Authorization,'Bearer test-token');
    return new Response('{}',{status:200,headers:{Location:'https://upload.example/session'}});
  }
  if(String(url).includes('thumbnails/set')){
    assert.equal(opts.headers.Authorization,'Bearer test-token');
    return new Response('{"ok":true}',{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw new Error('unexpected fetch '+url);
};

const xhrCalls=[];let dataPut=0;
class FakeXHR{
  constructor(){this.headers={};this.status=0;this.responseText='';this.upload={};this.timeout=0;}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(k,v){this.headers[k]=v;}
  getResponseHeader(name){return this.responseHeaders?.[name]||this.responseHeaders?.[name.toLowerCase()]||null;}
  send(blob){
    xhrCalls.push(this);
    queueMicrotask(()=>{
      try{
        assert.equal(this.headers.Authorization,'Bearer test-token');
        const cr=this.headers['Content-Range'];
        assert.ok(cr,'Content-Range required');
        if(cr.startsWith('bytes */')){
          this.status=308;this.responseHeaders={'Range':`bytes=0-${512*1024-1}`};this.responseText='';
        }else{
          dataPut++;
          assert.ok(blob instanceof Blob);
          if(dataPut===1){this.status=308;this.responseHeaders={'Range':`bytes=0-${512*1024-1}`};this.responseText='';}
          else{this.status=201;this.responseHeaders={};this.responseText='{"id":"video123"}';}
          this.upload.onprogress?.({lengthComputable:true,loaded:blob.size,total:blob.size});
        }
        this.onload?.();
      }catch(e){this.onerror?.(e);}
    });
  }
}
globalThis.XMLHttpRequest=FakeXHR;

const {startYouTubeSession,uploadYouTubeResumable,setYouTubeThumbnail}=await import('../studio-v2-youtube.js');
const file=new Blob([new Uint8Array(900*1024)],{type:'video/webm'});
const session=await startYouTubeSession({token:'test-token',file,metadata:{snippet:{title:'Test'},status:{privacyStatus:'private'}}});
assert.equal(session,'https://upload.example/session');
let maxProgress=0;
const video=await uploadYouTubeResumable({url:session,token:'test-token',file,chunkBytes:512*1024,onProgress:p=>maxProgress=Math.max(maxProgress,p)});
assert.equal(video.id,'video123');assert.equal(maxProgress,1);
assert.ok(xhrCalls.length>=2);
await setYouTubeThumbnail({token:'test-token',videoId:'video123',blob:new Blob(['jpg'],{type:'image/jpeg'})});
console.log('studio-v2-youtube-selftest: PASS');
