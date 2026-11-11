// AutoEmbed wrapper scripts were observed loading rotating ad domains on NCIS S24E4.
// Scope to exact verified frame hosts. Media, subtitles and verification requests
// retain the ordinary filter-list policy; only executable scripts are restricted.
const LIBRARIES = new Map([
  ['autoembed.me', new Set(['ajax.googleapis.com','cdnjs.cloudflare.com'])],
  ['player.autoembed.me', new Set()],
  ['nextgencloudfabric.com', new Set(['cdn.jsdelivr.net','code.jquery.com','cdnjs.cloudflare.com','www.gstatic.com'])],
]);
function blocksProviderScript(details) {
  if(details.resourceType!=='script')return false;
  try {
    const source=new URL(details.referrer||'');const target=new URL(details.url);
    const allowed=LIBRARIES.get(source.hostname);
    if(!allowed)return false;
    if(target.protocol!=='https:'||target.username||target.password)return true;
    if(target.origin===source.origin)return false;
    // Explicitly retain genuine browser-verification scripts.
    if(target.hostname==='challenges.cloudflare.com')return false;
    if(['www.google.com','www.recaptcha.net'].includes(target.hostname)&&target.pathname.startsWith('/recaptcha/'))return false;
    if(target.hostname==='js.hcaptcha.com'&&target.pathname==='/1/api.js')return false;
    return !allowed.has(target.hostname);
  }catch{return false;}
}
module.exports={blocksProviderScript};
