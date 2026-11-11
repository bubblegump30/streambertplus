const { app, session, webContents } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.resolve(root, '..', 'playback-evidence');
fs.mkdirSync(artifacts, { recursive: true });
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === 'userData' ? path.join(artifacts, 'fixture-profile') : value);
const movieNames = ['The Quiet Horizon', 'After the Rain', 'A Different Light', 'North of Somewhere', 'The Long Weekend', 'Small Hours'];
const tvNames = ['Open Roads', 'The Last Station', 'Another Season', 'Wild Coast'];
const makeItem = (title, id, type) => ({ id, title: type === 'movie' ? title : undefined, name: title, media_type: type,
  overview: 'Local layout preview with fictional sample titles. Discover a new story, keep your favorites close, and pick up where you left off.',
  vote_average: 7.6 + (id % 4) / 10, release_date: '2024-01-01', first_air_date: '2024-01-01', genres: [], genre_ids: [],
  poster_path: `/fixture-${id}.svg`, backdrop_path: '/fixture-banner.svg', runtime: 112, production_countries: [], spoken_languages: [],
  seasons: [{ id: id * 100, season_number: 1, name: 'Season 1', episode_count: 4 }], number_of_seasons: 1 });
const movies = movieNames.map((title, index) => makeItem(title, 550 + index, 'movie'));
const shows = tvNames.map((title, index) => makeItem(title, 900 + index, 'tv'));
const all = [...movies, ...shows];
const wired = new WeakSet();
function intercept(ses) {
  if (wired.has(ses)) return; wired.add(ses);
  ses.protocol.handle('https', (request) => {
    const url = new URL(request.url);
    if (url.host === 'image.tmdb.org') {
      const colors = ['#6d8077', '#56627f', '#967865', '#697f8c', '#766780', '#9b835c'];
      const id = Number(url.pathname.match(/fixture-(\d+)/)?.[1] || 550);
      const color = colors[id % colors.length];
      const title = (all.find((item) => item.id === id)?.title || all.find((item) => item.id === id)?.name || 'A new perspective').replaceAll('&', '&amp;');
      return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="a" x2=".8" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#182326"/></linearGradient></defs><rect width="1200" height="900" fill="url(#a)"/><circle cx="850" cy="230" r="135" fill="#e9dcc0" opacity=".7"/><path d="M0 700L350 260 720 700 1000 430 1200 690V900H0Z" fill="#11262b" opacity=".8"/><path d="M0 760L300 540 700 780 1000 650 1200 800V900H0Z" fill="#0c1d22"/><text x="600" y="780" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#f1e9df">${title}</text><text x="600" y="830" text-anchor="middle" font-family="sans-serif" font-size="16" letter-spacing="6" fill="#ddd">LOCAL LAYOUT PREVIEW</text></svg>`, { headers: { 'content-type': 'image/svg+xml' } });
    }
    if (url.host !== 'api.themoviedb.org') return new Response('<html><head><meta charset="utf-8"></head><body style="background:#101316;color:#aaa;font:16px sans-serif;display:grid;place-items:center;height:100vh;margin:0"><p>Local player preview - No external video is playing</p></body></html>', { headers: { 'content-type': 'text/html' } });
    const type = /\/tv\//.test(url.pathname) || /\/tv$/.test(url.pathname) ? 'tv' : 'movie';
    let data = {};
    if (/trending|top_rated|recommendations|similar|popular|search/.test(url.pathname)) data = { results: type === 'tv' ? shows : movies };
    else if (/release_dates|content_ratings|videos/.test(url.pathname)) data = { results: [] };
    else if (/credits/.test(url.pathname)) data = { cast: [], crew: [] };
    else if (/\/season\//.test(url.pathname)) data = { season_number: 1, episodes: Array.from({ length: 4 }, (_, i) => ({ id: 10000 + i, name: ['A fresh start', 'The crossing', 'New directions', 'Home again'][i], episode_number: i + 1, season_number: 1, still_path: '/fixture-banner.svg', overview: 'Local episode test data.', air_date: '2024-01-01', runtime: 45, vote_average: 8 })) };
    else if (/\/(movie|tv)\/\d+/.test(url.pathname)) data = all.find((item) => item.id === Number(url.pathname.match(/\/(?:movie|tv)\/(\d+)/)[1])) || movies[0];
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  });
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(win, expression) { for (let i = 0; i < 60; i++) { if (await win.webContents.executeJavaScript(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}`); }
let tested = false;
app.on('browser-window-created', (_event, win) => {
  if (tested) return; tested = true;
  intercept(win.webContents.session); intercept(session.fromPartition('persist:player')); intercept(session.fromPartition('persist:trailer'));
  const run = (code) => win.webContents.executeJavaScript(code);
  const snap = async (name) => { await delay(150); fs.writeFileSync(path.join(artifacts, name), (await win.webContents.capturePage()).toPNG()); };
  const wait = async (code, max = 120) => { for(let i=0;i<max;i++){if(await run(code))return;await delay(100);}throw new Error(`Timed out: ${code}`); };
  const guest = () => webContents.getAllWebContents().find(wc => wc.getType() === 'webview' && wc.session === session.fromPartition('persist:player') && !wc.isDestroyed());
  const fakeVideo = async (seekable = true) => {
    const wc = guest(); assert.ok(wc,'Player guest exists');
    await wc.executeJavaScript(`(() => {
      document.body.innerHTML='<p>Simulated video clock for local acceptance. No real video is playing.</p><video id="v"></video>';
      window.fixtureClock=0;window.fixturePaused=true;window.fixtureSeekable=${seekable};
      const v=document.getElementById('v');
      Object.defineProperties(v,{duration:{get:()=>6720},currentTime:{get:()=>window.fixtureClock,set:x=>window.fixtureClock=x},paused:{get:()=>window.fixturePaused},ended:{get:()=>false},readyState:{get:()=>4},seekable:{get:()=>({length:window.fixtureSeekable?1:0,start:()=>0,end:()=>6720})}});
      setInterval(()=>{if(!window.fixturePaused)window.fixtureClock+=.25;},250);
    })()`);
    return wc;
  };
  win.webContents.once('did-finish-load',async()=>{
    try{
      await run('window.electron.secureSet("apikey","local-fixture-not-a-real-token")');
      await run('localStorage.clear();localStorage.setItem("streambert_theme",JSON.stringify("dark"));localStorage.setItem("streambert_accentColor",JSON.stringify("pink"));');
      const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;
      await wait('!!document.querySelector(".discover-feature .btn-primary")');
      await run('document.querySelector(".discover-feature .btn-primary").click()');
      await wait('!!document.querySelector(".detail-actions .btn-primary")');
      await run('document.querySelector(".detail-actions .btn-primary").click()');
      await wait('!!document.querySelector("button[title^=Change]")');await delay(2000);
      assert.equal(await run('localStorage.getItem("streambert_playbackSuccessfulSources")'),null,'Loaded page must not become a successful source');
      const actionColors=await run(`Array.from(document.querySelectorAll('.playback-secondary .btn')).map(b=>({text:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor}))`);
      assert.equal(actionColors.length,4);
      for(const colors of actionColors){assert.equal(colors.text,'rgb(255, 255, 255)');assert.ok(['rgb(124, 58, 237)','rgb(100, 66, 145)'].includes(colors.background));}

      await run('document.querySelector("button[title^=Change]").click()');
      await wait('document.querySelectorAll(".playback-server-card").length===10');
      await run('Array.from(document.querySelectorAll(".playback-server-card")).find(e=>e.querySelector("strong").textContent==="VidLink").querySelector(".playback-server-options button").click()');
      assert.equal(await run('JSON.parse(localStorage.getItem("streambert_playbackFavorites"))[0]'),'vidlink');
      await snap('Favorite-Servers.png');
      await run('Array.from(document.querySelectorAll(".playback-server-select")).find(b=>b.textContent.includes("VidLink")).click()');
      await wait('document.querySelector("button[title^=Change]").textContent.includes("VidLink")');
      await wait('document.querySelector(".playback-status")?.textContent.includes("Page loaded")');await delay(200);
      let wc=await fakeVideo();await delay(1400);
      assert.equal(await run('localStorage.getItem("streambert_playbackSuccessfulSources")'),null,'Paused static media must not become a successful source');
      await wc.executeJavaScript('window.fixturePaused=false');
      await wait('JSON.parse(localStorage.getItem("streambert_playbackSuccessfulSources")||"{}").movie_550?.sourceId==="vidlink"');
      await wc.executeJavaScript('window.fixtureClock=120;window.fixturePaused=true');
      await wait('JSON.parse(localStorage.getItem("streambert_playbackBookmarks")||"{}").movie_550?.seconds>=120');
      await snap('Playback-Observed.png');
      await run('document.querySelector(".detail-actions .btn-primary").click()');
      await wait('!document.querySelector(".playback-workspace")');
      await run('document.querySelector(".detail-actions .btn-primary").click()');
      await wait('!!document.querySelector(".playback-resume-choice")');
      assert.ok(!guest(),'No provider guest created before resume choice');
      await snap('Resume-Choice.png');
      await run('document.querySelector(".playback-resume-choice .btn-primary").click()');
      await wait('document.querySelector(".playback-status")?.textContent.includes("Page loaded")');
      wc=await fakeVideo(true);await wc.executeJavaScript('window.fixturePaused=false');
      await wait('document.querySelector(".playback-secondary")?.textContent.includes("2:0")');
      assert.ok(await wc.executeJavaScript('window.fixtureClock>=120'),'Resume applies seek to the observed video');
      await run('document.querySelector(".detail-actions .btn-primary").click()');
      await wait('!document.querySelector(".playback-workspace")');
      const saved=await run('JSON.parse(localStorage.getItem("streambert_playbackBookmarks")).movie_550.seconds');
      await run('document.querySelector(".detail-actions .btn-primary").click()');await wait('!!document.querySelector(".playback-resume-choice")');
      await run('document.querySelector(".playback-resume-choice .btn-primary").click()');
      await wait('document.querySelector(".playback-status")?.textContent.includes("Page loaded")');
      wc=await fakeVideo(false);await wc.executeJavaScript('window.fixturePaused=false');
      await wait('document.body.innerText.includes("previous bookmark is preserved")',180);
      assert.equal(await run('JSON.parse(localStorage.getItem("streambert_playbackBookmarks")).movie_550.seconds'),saved,'Unseekable provider must not overwrite saved position');
      await snap('Resume-Preserved.png');
      await run('Array.from(document.querySelectorAll(".playback-notice button")).find(b=>b.textContent==="Continue from here").click()');
      await wait('JSON.parse(localStorage.getItem("streambert_playbackBookmarks")).movie_550.seconds<30');
      await run(`(() => { const e=new Event('did-fail-load');Object.assign(e,{isMainFrame:true,errorCode:-105,errorDescription:'Simulated DNS failure'});document.querySelector('webview').dispatchEvent(e);})()`);
      await wait('document.querySelector(".playback-status")?.textContent.includes("attention")');
      await snap('Playback-Recovery.png');
      fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify({mode:'Local fixtures and simulated video clock; not live playback',passed:['Retrying the already-current server reattaches guest listeners','Loaded pages and paused media do not mark a server successful','Favorite server persistence','Advancing media clock records a successful source','Pause saves exact seconds','Resume choice does not create a provider guest before a decision','Observed seek restores saved position','Unseekable source preserves old bookmark until explicit consent to continue here','Top-level page failures expose recovery controls']},null,2));
      console.log('PLAYBACK ACCEPTANCE PASS');app.exit(0);
    }catch(error){console.error(error);console.error(await run('document.body.innerText'));await snap('Failure.png');app.exit(1);}
  });
});
require(process.env.STREAMBERT_TEST_ASAR || '../index.js');
setTimeout(()=>{console.error('Playback acceptance timed out');app.exit(1);},55000).unref();

