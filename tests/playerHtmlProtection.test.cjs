const {test}=require('node:test');const assert=require('node:assert/strict');
const {filterPlayerHtml,protectedHtmlHost}=require('../src/ipc/playerHtmlProtection');
const url='https://streamingnow.mov/?play=fixture';
test('MultiEmbed inline ad SDKs are removed before parsing while player and verification bytes remain',()=>{
 const challenge='<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>';
 const player='<script>window.playerReady=true</script><video controls></video>';
 const html='<!doctype html>'+challenge+'<script data-id="sdk">const adserverDomain="ads.example";window.adRan=true;</script>'+player+'<script>const popundersPerIP=2;window.popunderRan=true;</script>';
 const result=filterPlayerHtml(html,url);
 assert.equal(result.removed,2);assert.equal(result.html,'<!doctype html>'+challenge+player);
 assert.equal(filterPlayerHtml(html,'https://other.example').html,html);
});
test('scope rejects lookalike hosts and non-HTTPS pages',()=>{
 assert.equal(protectedHtmlHost('https://streamingnow.mov.evil.test/'),false);
 assert.equal(protectedHtmlHost('https://example.org/streamingnow.mov'),false);
 assert.equal(protectedHtmlHost('http://streamingnow.mov/'),false);
});
test('ordinary player scripts and verification scripts containing no ad SDK marker are retained',()=>{
 const html='<script>const zoneId=123; window.playerReady=true;</script><script>window.turnstileConfig={sitekey:"fixture"}</script>';
 assert.equal(filterPlayerHtml(html,url).html,html);
});

const {EventEmitter}=require('node:events');
const {protectPlayerHtml}=require('../src/ipc/playerHtmlProtection');
test('CDP response filtering fulfills sanitized HTML and drops stale entity headers',async()=>{
 const client=new EventEmitter();const commands=[];
 client.attach=()=>{};
 client.sendCommand=async(method,args)=>{commands.push({method,args});if(method==='Fetch.getResponseBody')return {body:'<script>window.adserverDomain="fixture"</script><script>window.playerReady=true</script>',base64Encoded:false};return {}};
 const wc={debugger:client};let blocked=0;
 await protectPlayerHtml(wc,()=>blocked++).promise;
 client.emit('message',{},'Fetch.requestPaused',{requestId:'fixture',request:{url},responseStatusCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'},{name:'Content-Encoding',value:'gzip'},{name:'Content-Length',value:'100'},{name:'Set-Cookie',value:'player=1'}]});
 await new Promise(resolve=>setImmediate(resolve));
 const fulfilled=commands.find(c=>c.method==='Fetch.fulfillRequest').args;
 assert.equal(Buffer.from(fulfilled.body,'base64').toString(),'<script>window.playerReady=true</script>');
 assert.deepEqual(fulfilled.responseHeaders,[{name:'Content-Type',value:'text/html'},{name:'Set-Cookie',value:'player=1'}]);
 assert.equal(blocked,1);
});
test('CDP filtering fails closed when a targeted response cannot be read',async()=>{
 const client=new EventEmitter();const commands=[];client.attach=()=>{};
 client.sendCommand=async(method,args)=>{commands.push({method,args});if(method==='Fetch.getResponseBody')throw Error('unreadable');return {}};
 await protectPlayerHtml({debugger:client}).promise;
 client.emit('message',{},'Fetch.requestPaused',{requestId:'fixture',request:{url},responseStatusCode:200,responseHeaders:[{name:'content-type',value:'text/html'}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(commands.some(c=>c.method==='Fetch.failRequest'));
 assert.ok(!commands.some(c=>c.method==='Fetch.fulfillRequest'||c.method==='Fetch.continueRequest'));
});
