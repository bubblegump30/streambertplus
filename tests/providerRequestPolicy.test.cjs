const {test}=require('node:test');const assert=require('node:assert/strict');
const {blocksProviderScript}=require('../src/ipc/providerRequestPolicy');
const request=(url,referrer,resourceType='script')=>({url,referrer,resourceType});
test('AutoEmbed blocks rotating third-party executable scripts on all verified wrapper frames',()=>{
 for(const host of ['autoembed.me','player.autoembed.me','nextgencloudfabric.com']){
  for(const ad of ['https://gussiessmutchy.com/ad.js','https://b.efvcxevyy9lqbf.cfd/random','https://new-rotating.example/ad.js'])assert.equal(blocksProviderScript(request(ad,'https://'+host+'/watch')),true);
 }
});
test('player libraries, first-party scripts, media, subtitles and genuine verification remain available',()=>{
 for(const [url,source] of [
 ['https://ajax.googleapis.com/jquery.js','https://autoembed.me/'],
 ['https://player.autoembed.me/local.js','https://player.autoembed.me/'],
 ['https://cdn.jsdelivr.net/npm/hls.js','https://nextgencloudfabric.com/'],
 ['https://www.gstatic.com/cast.js','https://nextgencloudfabric.com/'],
 ['https://challenges.cloudflare.com/turnstile/v0/api.js','https://player.autoembed.me/'],
 ['https://www.google.com/recaptcha/api.js','https://autoembed.me/']
 ])assert.equal(blocksProviderScript(request(url,source)),false);
 for(const type of ['media','xhr','subFrame'])assert.equal(blocksProviderScript(request('https://cdn.example/media','https://nextgencloudfabric.com/',type)),false);
});
test('script policy uses exact hosts and does not broaden to unrelated providers',()=>{
 assert.equal(blocksProviderScript(request('https://cdn.jsdelivr.net.evil.test/ad.js','https://nextgencloudfabric.com/')),true);
 assert.equal(blocksProviderScript(request('https://anything.example/script.js','https://autoembed.me.evil.test/')),false);
 assert.equal(blocksProviderScript(request('https://anything.example/script.js','https://vidlink.pro/')),false);
});
