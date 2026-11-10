// Opt-in live diagnostic using an isolated profile and bounded playback; no credentials or stream URLs are logged.
const { app,BrowserWindow,session }=require('electron');
const fs=require('fs'),path=require('path');
const protection=require('../src/ipc/adProtection');
app.setPath('userData',path.resolve(__dirname,'../../provider-probe-profile'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const host=url=>{try{return new URL(url).hostname}catch{return ''}};
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const result=[];
 for(const [name,url] of (process.argv.includes('--movie') ? [['vidsrc','https://vsembed.su/embed/movie/550'],['vidsrc-mov','https://vidsrc.mov/embed/movie/550'],['movietvapi','https://movietvapi.stream/embed/movie/550']] : [['vidsrc','https://vsembed.su/embed/tv/1399/1/1'],['vidsrc-mov','https://vidsrc.mov/embed/tv/1399/1/1'],['movietvapi','https://movietvapi.stream/embed/tv/1399/1/1']])){
  const ses=session.fromPartition('probe-'+name);ses.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  const report={name,failures:[],blocked:{},mediaRequests:0};
  ses.webRequest.onHeadersReceived({urls:['*://*/*']},(details,cb)=>{const headers={...details.responseHeaders};for(const k of Object.keys(headers))if(['x-frame-options','content-security-policy'].includes(k.toLowerCase()))delete headers[k];cb({responseHeaders:headers})});
  ses.webRequest.onBeforeRequest({urls:['*://*/*']},(d,cb)=>{
   const ad=protection.blocksRequest(d),media=d.resourceType==='media'||/\.(m3u8|mpd|mp4|ts)(?:\?|$)/i.test(d.url);
   if(ad)report.blocked[host(d.url)]=(report.blocked[host(d.url)]||0)+1;
   if(media)report.mediaRequests++;
   cb({cancel:ad});
  });
  ses.webRequest.onCompleted({urls:['*://movietvapi.stream/*']},d=>{if(d.statusCode>=400)report.failures.push({host:host(d.url),path:new URL(d.url).pathname,status:d.statusCode})});
  ses.webRequest.onErrorOccurred({urls:['*://*/*']},d=>{if(d.resourceType==='mainFrame'||d.resourceType==='subFrame'||d.resourceType==='xhr')report.failures.push({host:host(d.url),path:(host(d.url)==='movietvapi.stream'?new URL(d.url).pathname:undefined),type:d.resourceType,error:d.error})});
  const win=new BrowserWindow({show:false,webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true}});
  protection.protectContents(win.webContents,u=>{report.blocked[host(u)]=(report.blocked[host(u)]||0)+1});
  await Promise.race([win.loadURL(url).catch(e=>report.loadError=e.code),delay(8000)]);await delay(5000);
  report.playAttempts=[];
  for(const frame of win.webContents.mainFrame.framesInSubtree.slice(0,12)) {
    try {
      const action=await frame.executeJavaScript(`(() => {
        if (/not a robot|verify you are human|checking your browser|just a moment/i.test(document.body?.innerText||'')) return 'challenge-left-untouched';
        const b=document.querySelector('button[aria-label="Play"],button[aria-label="Play video"]');
        if(!b)return 'no-play-button';
        if(getComputedStyle(b).display==='none')return 'play-button-hidden';
        b.click();return 'play-requested';
      })()`,true);
      report.playAttempts.push({host:host(frame.url),action});
    }catch{}
  }
  await delay(12000);
  const snapshots=async()=>Promise.all(win.webContents.mainFrame.framesInSubtree.slice(0,12).map(async frame=>{
    try{return {host:host(frame.url),videos:await frame.executeJavaScript(`[...document.querySelectorAll('video')].map(v=>({seconds:v.currentTime,duration:Number.isFinite(v.duration)?v.duration:null,paused:v.paused,readyState:v.readyState,error:v.error?.code||null}))`)}}catch{return null}
  }));
  report.first=await snapshots();await delay(2000);report.second=await snapshots();
  for(const frame of win.webContents.mainFrame.framesInSubtree.slice(0,12)){try{await frame.executeJavaScript("document.querySelectorAll('video').forEach(v=>v.pause())")}catch{}}
  result.push(report);win.destroy();
 }
 fs.writeFileSync(path.resolve(__dirname,'../../provider-electron-probe.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.map(({name,first,second,playAttempts})=>({name,first,second,playAttempts})),null,2));app.exit(0);
});
setTimeout(()=>app.exit(1),90000).unref();

