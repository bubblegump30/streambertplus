const {app,BrowserWindow,session}=require('electron');
const path=require('path'),fs=require('fs');
const {protectContents,blocksRequest}=require('../src/ipc/adProtection');
const artifacts=path.resolve(__dirname,'../../embedwave-evidence');fs.mkdirSync(artifacts,{recursive:true});app.setPath('userData',path.join(artifacts,'profile'));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const bounded=(promise)=>Promise.race([promise,delay(1500).then(()=>null)]);
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const results=[];
 for(const [kind,url] of [['movie','https://embedwave.cc/embed/movie/550?server=cinesrc'],['tv','https://embedwave.cc/embed/tv/1399/1/1?server=cinesrc']]){
  const ses=session.fromPartition('embedwave-'+kind);const blocked=new Set();
  ses.webRequest.onBeforeRequest({urls:['*://*/*']},(d,cb)=>{const cancel=blocksRequest(d);if(cancel)blocked.add(new URL(d.url).hostname);cb({cancel})});
  ses.webRequest.onHeadersReceived({urls:['*://*/*']},(d,cb)=>{const h={...d.responseHeaders};for(const k of Object.keys(h))if(['content-security-policy','x-frame-options'].includes(k.toLowerCase()))delete h[k];cb({responseHeaders:h})});
  const win=new BrowserWindow({show:false,webPreferences:{session:ses,contextIsolation:true,nodeIntegration:false,sandbox:true}});protectContents(win.webContents,()=>{});
  let loadError=null;await Promise.race([win.loadURL(url).catch(e=>loadError=e.code),delay(8000)]);await delay(8000);
  const sample=async()=>Promise.all(win.webContents.mainFrame.framesInSubtree.slice(0,12).map(async f=>({host:(()=>{try{return new URL(f.url).hostname}catch{return ''}})(),data:await bounded(f.executeJavaScript(`({videos:[...document.querySelectorAll('video')].map(v=>({seconds:v.currentTime,duration:Number.isFinite(v.duration)?v.duration:null,paused:v.paused,error:v.error?.code||null})),challenge:/verify you are human|not a robot|just a moment/i.test(document.body?.innerText||''),adStyles:!!document.getElementById('streambert-ad-styles')})`)).catch(()=>null)})));
  const first=await sample();await delay(2000);const second=await sample();
  for(const frame of win.webContents.mainFrame.framesInSubtree.slice(0,12))await bounded(frame.executeJavaScript("document.querySelectorAll('video').forEach(v=>v.pause())")).catch(()=>{});
  results.push({kind,loadError,first,second,blockedHosts:[...blocked]});win.destroy();
 }
 fs.writeFileSync(path.join(artifacts,'live-check.json'),JSON.stringify({mode:'Bounded live EmbedWave samples; not full-session or all-title acceptance',results},null,2));console.log(JSON.stringify(results,null,2));app.exit(0);
});setTimeout(()=>{console.error('Live check timed out');app.exit(1)},80000).unref();

