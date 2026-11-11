const { parse } = require('parse5');
const HOSTS = new Set(['streamingnow.mov']);
const AD_MARKERS = /popundersPerIP|adserverDomain|wpadmngr/;
const LIMIT = 4 * 1024 * 1024;
function protectedHtmlHost(url) {
  try { const u=new URL(url); return u.protocol==='https:' && HOSTS.has(u.hostname); } catch { return false; }
}
// Provider rule provenance: uBlockOrigin/uAssets filters-2025.txt, streamingnow.mov HTML rule.
// Parse HTML, then remove only complete script elements whose text matches that ad-SDK rule.
// Source offsets preserve every other byte, including verification and player scripts.
function filterPlayerHtml(html, url) {
  if(!protectedHtmlHost(url)) return {html,removed:0};
  const tree=parse(html,{sourceCodeLocationInfo:true});const ranges=[];
  const visit=node=>{
    if(node.tagName==='script' && node.namespaceURI==='http://www.w3.org/1999/xhtml') {
      const text=(node.childNodes||[]).filter(n=>n.nodeName==='#text').map(n=>n.value).join('');
      const loc=node.sourceCodeLocation;
      if(loc?.endTag && AD_MARKERS.test(text))ranges.push([loc.startOffset,loc.endOffset]);
    }
    for(const child of node.childNodes||[])visit(child);
    // Template contents are inert until cloned, but ad SDKs there must not become executable later.
    if(node.content)visit(node.content);
  };visit(tree);
  let result=html;
  for(const [start,end] of ranges.sort((a,b)=>b[0]-a[0]))result=result.slice(0,start)+result.slice(end);
  return {html:result,removed:ranges.length};
}
const protectedPlayers=new WeakMap();
function protectPlayerHtml(wc,recordBlocked=()=>{}) {
  if(protectedPlayers.has(wc))return protectedPlayers.get(wc);
  const state={ready:false,failed:false,promise:null};protectedPlayers.set(wc,state);
  // Fake WebContents in pure unit tests have no debugger. Real Electron players always do.
  if(!wc.debugger){state.promise=Promise.resolve(false);return state;}
  const client=wc.debugger;
  const paused=async(_event,method,details)=>{
    if(method!=='Fetch.requestPaused')return;
    const requestId=details.requestId;
    try {
      if(!protectedHtmlHost(details.request.url)||(!details.responseStatusCode || details.responseStatusCode<200 || details.responseStatusCode>=300)||!details.responseHeaders?.some(h=>h.name.toLowerCase()==='content-type'&&/^text\/html(?:;|$)/i.test(h.value))) {
        await client.sendCommand('Fetch.continueRequest',{requestId});return;
      }
      const size=details.responseHeaders.find(h=>h.name.toLowerCase()==='content-length');
      if(size&&Number(size.value)>LIMIT)throw new Error('Player HTML exceeds limit');
      const body=await client.sendCommand('Fetch.getResponseBody',{requestId});
      const bytes=Buffer.from(body.body,body.base64Encoded?'base64':'utf8');
      if(bytes.length>LIMIT)throw new Error('Player HTML exceeds limit');
      const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      const filtered=filterPlayerHtml(html,details.request.url);
      if(!filtered.removed){await client.sendCommand('Fetch.continueRequest',{requestId});return;}
      const responseHeaders=details.responseHeaders.filter(h=>!['content-length','content-encoding','etag','content-md5','digest'].includes(h.name.toLowerCase()));
      await client.sendCommand('Fetch.fulfillRequest',{requestId,responseCode:details.responseStatusCode,responseHeaders,body:Buffer.from(filtered.html,'utf8').toString('base64')});
      for(let i=0;i<filtered.removed;i++)recordBlocked(details.request.url);
    }catch{
      // Never deliver a partially processed targeted document on a filtering failure.
      try{await client.sendCommand('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}catch{}
    }
  };
  try {
    client.attach('1.3');client.on('message',paused);
    client.once('detach',()=>{state.ready=false;state.failed=true;});
    state.promise=client.sendCommand('Fetch.enable',{patterns:[{urlPattern:'https://streamingnow.mov/*',resourceType:'Document',requestStage:'Response'}]}).then(()=>{state.ready=true;return true;}).catch(()=>{state.failed=true;return false;});
  }catch{state.failed=true;state.promise=Promise.resolve(false);}
  return state;
}
module.exports={filterPlayerHtml,protectPlayerHtml,protectedHtmlHost};
