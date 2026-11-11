const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const protection = require(process.env.STREAMBERT_TEST_ASAR ? path.join(process.env.STREAMBERT_TEST_ASAR,'src/ipc/adProtection.js') : '../src/ipc/adProtection');
const artifacts=path.resolve(__dirname,'../../ad-protection-evidence');
fs.mkdirSync(artifacts,{recursive:true});
app.setPath('userData',path.join(artifacts,'fixture-profile'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const isAdFixture=url=>{try{return new URL(url).hostname === 'ads.exoclick.com'}catch{return false}};
app.whenReady().then(async()=>{
  assert.equal(isAdFixture('https://ads.exoclick.com/tag.js'),true);
  assert.equal(isAdFixture('https://ads.exoclick.com.evil.test/tag.js'),false);
  assert.equal(isAdFixture('https://example.org/path/exoclick.com'),false);
  assert.equal(isAdFixture('https://example.org/?next=exoclick.com'),false);

  let win;
  try {
    const ses=session.fromPartition('ad-protection-fixture');
    const blocked=[];
    ses.webRequest.onBeforeRequest({urls:['*://*/*']},(details,callback)=>{
      const cancel=protection.blocksRequest(details);if(cancel)blocked.push(details.url);callback({cancel});
    });
    const visited=[];
    ses.protocol.handle('https',request=>{
      visited.push(request.url);
      const url=new URL(request.url);
      if(url.host==='multiembed.mov') return new Response(null,{status:302,headers:{Location:'https://streamingnow.mov/?play=fixture'}});
      const frame=url.pathname==='/frame';
      const html=`<!doctype html><html><body><video controls></video><ins class="adsbygoogle" data-ad-client="fixture">Advertisement fixture</ins>${frame?'':'<iframe src="https://fixture.example.org/frame"></iframe>'}<script src="https://ads.exoclick.com/tag.js"></script><script>window.scriptRan=true;fetch('/movie.m3u8').then(r=>r.text()).then(t=>window.mediaOK=t.includes('EXTM3U'));fetch('/en.vtt').then(r=>r.text()).then(t=>window.subsOK=t.includes('WEBVTT'));</script></body></html>`;
      if(url.pathname.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXT-X-ENDLIST',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
      if(url.pathname.endsWith('.vtt'))return new Response('WEBVTT\n',{headers:{'Content-Type':'text/vtt'}});
      return new Response(html,{headers:{'Content-Type':'text/html'}});
    });
    win=new BrowserWindow({show:false,webPreferences:{session:ses,contextIsolation:true,nodeIntegration:false,sandbox:true}});
    protection.protectContents(win.webContents,url=>blocked.push(url));
    await win.loadURL('https://fixture.example.org/watch');await delay(3500);
    const run=code=>win.webContents.executeJavaScript(code);
    assert.equal(await run('window.scriptRan && window.mediaOK && window.subsOK'),true);
    assert.equal(await run('getComputedStyle(document.querySelector(".adsbygoogle")).display'),'none');
    assert.notEqual(await run('getComputedStyle(document.querySelector("video")).display'),'none');
    // Arrives after the previous 2.5-second startup-only checks.
    await run(`document.body.insertAdjacentHTML('beforeend','<div id="late-ad" class="ad-overlay">Late overlay fixture</div>')`);
    await delay(2300);
    assert.equal(await run('getComputedStyle(document.querySelector("#late-ad")).display'),'none');
    await run(`document.getElementById('streambert-ad-styles').textContent=''`);
    await delay(2300);
    assert.equal(await run('getComputedStyle(document.querySelector("#late-ad")).display'),'none');
    await run(`document.getElementById('streambert-ad-styles').remove()`);
    await delay(2300);
    assert.equal(await run('getComputedStyle(document.querySelector("#late-ad")).display'),'none');

    const child=win.webContents.mainFrame.frames.find(frame=>new URL(frame.url).pathname === '/frame');
    assert.ok(child);
    assert.equal(await child.executeJavaScript('getComputedStyle(document.querySelector(".adsbygoogle")).display'),'none');
    let popupCount=0;win.webContents.on('did-create-window',()=>popupCount++);
    await run('window.open("https://advert.example.org/popup")');await delay(200);assert.equal(popupCount,0);
    await run('location.href="https://advert.example.org/takeover"');await delay(200);
    assert.equal(win.webContents.getURL(),'https://fixture.example.org/watch');
    assert.ok(blocked.some(isAdFixture));
    assert.ok(!visited.some(isAdFixture));
    await win.loadURL('https://multiembed.mov/?video_id=550&tmdb=1');
    assert.ok(new URL(win.webContents.getURL()).origin === 'https://streamingnow.mov');
    await run('location.href="https://advert.example.org/takeover"');await delay(200);
    assert.ok(new URL(win.webContents.getURL()).origin === 'https://streamingnow.mov');
    const sourceOrigins=['https://player.videasy.to','https://vsembed.su','https://www.vidking.net','https://allmanga.to','https://vidsrc.mov','https://vidlink.pro','https://multiembed.mov','https://embedwave.cc','https://autoembed.me','https://movietvapi.stream'];
    for(const origin of sourceOrigins){
      const adCount=blocked.filter(isAdFixture).length;
      await win.loadURL(origin+'/coverage-fixture');
      await delay(100);
      await run('window.open("https://advert.example.org/popup")');
      assert.equal(popupCount,0);
      assert.ok(blocked.filter(isAdFixture).length>adCount);
    }

    fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify({mode:'Isolated Electron HTTPS fixtures, no live external stream',passed:['Ad script cancelled before response','Main and nested frame ad markup hidden','Late ad overlays hidden after startup','Removed ad stylesheet restored','Shared-session protection applied to every configured source origin','Video element preserved','Media playlist and subtitle requests preserved','Popup denied','Cross-origin takeover denied','MultiEmbed HTTP redirect accepted without opening arbitrary origins']},null,2));
    console.log('AD PROTECTION ACCEPTANCE PASS');app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
setTimeout(()=>{console.error('Ad protection acceptance timed out');app.exit(1)},30000).unref();

