const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { blocksRequest, safeNavigation, protectContents, getEngine } = require('../src/ipc/adProtection');
test('bundled filters block ad scripts while preserving video, subtitles and ordinary scripts', () => {
  const source = 'https://player.example.org/watch';
  for (const url of ['https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', 'https://ads.exoclick.com/tag.js'])
    assert.equal(blocksRequest({ url, referrer: source, resourceType: 'script' }), true);
  for (const [url, resourceType] of [['https://cdn.example.org/episode.m3u8','xhr'],['https://cdn.example.org/segment.ts','media'],['https://cdn.example.org/en.vtt','xhr'],['https://player.example.org/player.js','script']])
    assert.equal(blocksRequest({ url, referrer: source, resourceType }), false);
});
test('ad markup receives cosmetic rules without removing player or challenge controls generically', () => {
  const { styles, scripts } = getEngine().getCosmeticsFilters({url:'https://example.org/',hostname:'example.org',domain:'example.org',classes:['adsbygoogle'],ids:[],getInjectionRules:false,getExtendedRules:false});
  assert.ok(styles.includes('adsbygoogle'));
  assert.equal(scripts.length, 0);
  assert.ok(!styles.includes('video{'));
});
test('guest popup and cross-origin navigation attempts are denied in main and pop-out players', () => {
  const wc = new EventEmitter(); wc.getURL=()=> 'https://player.example.org/embed/123'; wc.setWindowOpenHandler=fn=>wc.open=fn;
  const blocked=[]; protectContents(wc,url=>blocked.push(url)); protectContents(wc,url=>blocked.push(url));
  assert.deepEqual(wc.open({url:'https://advert.example/'}),{action:'deny'});
  for(const url of ['https://advert.example/','javascript:alert(1)','file:///C:/test','https://player.example.org.evil.test/']) {
    let prevented=false; wc.emit('will-navigate',{preventDefault(){prevented=true}},url); assert.ok(prevented);
  }
  let prevented=false; wc.emit('will-navigate',{preventDefault(){prevented=true}},'https://player.example.org/watch/456'); assert.equal(prevented,false);
  wc.emit('will-redirect',{preventDefault(){prevented=true}},'https://advert.example/',false,true); assert.equal(prevented,true);
  assert.equal(wc.listenerCount('will-navigate'),1);
  assert.equal(safeNavigation('https://player.example.org:444/','https://player.example.org/'),false);
});


test('only the observed MultiEmbed HTTPS redirect is allowed across origins', () => {
  assert.equal(safeNavigation('https://streamingnow.mov/?play=fixture','https://multiembed.mov/?video_id=550&tmdb=1',true),true);
  assert.equal(safeNavigation('https://streamingnow.mov/?play=fixture','https://multiembed.mov/',false),false);
  assert.equal(safeNavigation('https://streamingnow.mov.evil.test/','https://multiembed.mov/',true),false);
  assert.equal(safeNavigation('http://streamingnow.mov/','https://multiembed.mov/',true),false);
  assert.equal(safeNavigation('https://user:pass@streamingnow.mov/','https://multiembed.mov/',true),false);
  const wc=new EventEmitter();wc.getURL=()=>'';wc.setWindowOpenHandler=()=>{};
  protectContents(wc,()=>{});
  wc.emit('did-start-navigation',{},'https://multiembed.mov/?video_id=550&tmdb=1',false,true);
  let prevented=false;
  wc.emit('will-redirect',{preventDefault(){prevented=true}},'https://streamingnow.mov/?play=fixture',false,true);
  assert.equal(prevented,false);
  wc.emit('will-redirect',{preventDefault(){prevented=true}},'https://advert.example.org/',false,true);
  assert.equal(prevented,true);
});

