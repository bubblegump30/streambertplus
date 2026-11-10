const { app, BrowserWindow, session } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const protection = require(process.env.STREAMBERT_TEST_ASAR ? path.join(process.env.STREAMBERT_TEST_ASAR,'src/ipc/adProtection.js') : '../src/ipc/adProtection');
const artifacts=path.resolve(__dirname,'../../ad-protection-evidence');
fs.mkdirSync(artifacts,{recursive:true});
app.setPath('userData',path.join(artifacts,'fixture-profile'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
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
    const child=win.webContents.mainFrame.frames.find(frame=>frame.url.includes('/frame'));
    assert.ok(child);
    assert.equal(await child.executeJavaScript('getComputedStyle(document.querySelector(".adsbygoogle")).display'),'none');
    let popupCount=0;win.webContents.on('did-create-window',()=>popupCount++);
    await run('window.open("https://advert.example.org/popup")');await delay(200);assert.equal(popupCount,0);
    await run('location.href="https://advert.example.org/takeover"');await delay(200);
    assert.equal(win.webContents.getURL(),'https://fixture.example.org/watch');
    assert.ok(blocked.some(url=>url.includes('exoclick.com')));
    assert.ok(!visited.some(url=>url.includes('exoclick.com')));
    fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify({mode:'Isolated Electron HTTPS fixtures, no live external stream',passed:['Ad script cancelled before response','Main and nested frame ad markup hidden','Video element preserved','Media playlist and subtitle requests preserved','Popup denied','Cross-origin takeover denied']},null,2));
    console.log('AD PROTECTION ACCEPTANCE PASS');app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
setTimeout(()=>{console.error('Ad protection acceptance timed out');app.exit(1)},20000).unref();

