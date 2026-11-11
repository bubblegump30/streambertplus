const { app, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.resolve(root, '..', 'layout-evidence');
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
  const snap = async (name) => { await delay(250); fs.writeFileSync(path.join(artifacts, name), (await win.webContents.capturePage()).toPNG()); };
  const reload = async () => { const loaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve)); win.webContents.reload(); await loaded; await waitFor(win, '!!document.querySelector(".discover-feature")'); };
  win.webContents.once('did-finish-load', async () => {
    try {
      await run('window.electron.secureSet("apikey", "local-fixture-not-a-real-token")');
      await run('localStorage.clear(); localStorage.setItem("streambert_theme", JSON.stringify("dark")); localStorage.setItem("streambert_accentColor", JSON.stringify("pink")); localStorage.setItem("streambert_startPage", JSON.stringify("home")); localStorage.setItem("streambert_saved", "{}"); localStorage.setItem("streambert_history", "[]"); localStorage.setItem("streambert_homeViewMode", JSON.stringify("carousel"));');
      await reload();
      await snap('Discover-Dark.png');
      assert.equal(await run('document.querySelectorAll(".clean-nav-link.is-current").length'), 1);
      await run(`(() => { const e=document.querySelector('.discover-filter-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'After the Rain'); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await waitFor(win, 'document.querySelectorAll(".discover-collection .clean-card").length === 1');
      await run(`(() => { const e=document.querySelector('.discover-filter-search input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,''); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await waitFor(win, '!!document.querySelector(".discover-feature")');
      await run('document.querySelector(".clean-card-menu-button").click()');
      await waitFor(win, '!!document.querySelector(".clean-card-menu button")');
      await run('document.querySelector(".clean-card-menu button").click()');
      await waitFor(win, '!!document.querySelector(".clean-card.ep-watched")');

      await run('Array.from(document.querySelectorAll(".discover-tabs button")).find(b => b.textContent === "TV shows").click()');
      await waitFor(win, 'document.querySelector(".discover-feature-copy h2")?.textContent === "Open Roads"');
      assert.ok(await run('Array.from(document.querySelectorAll(".discover-collection .card-year")).every(e => e.textContent.includes("TV show"))'));
      await run('document.querySelector(".discover-feature .btn-primary").click()');
      await waitFor(win, 'document.querySelectorAll(".episode-card").length === 4');
      const seasonAction=await run(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Mark season watched');const s=getComputedStyle(b);return {color:s.color,background:s.backgroundColor};})()`);
      assert.equal(seasonAction.color,'rgb(255, 255, 255)');
      assert.equal(seasonAction.background,'rgb(124, 58, 237)');
      await snap('TV-Episodes.png');
      await run('document.querySelector(".episode-open").click()');
      await waitFor(win, '!!document.querySelector("button[title^=Change]")');
      await snap('TV-Player.png');
      await run(`document.querySelector('.playback-secondary').scrollIntoView({block:'center'})`);
      await snap('Purple-Player-Actions.png');
      await run('document.querySelector("button[title^=Change]").click()');
      await waitFor(win, 'document.querySelectorAll(".source-dropdown__item").length === 10');
      await run('Array.from(document.querySelectorAll(".source-dropdown__item")).find(b => b.textContent.includes("VidLink")).click()');
      await waitFor(win, 'document.querySelector("button[title^=Change]")?.textContent.includes("VidLink")');
      await run('Array.from(document.querySelectorAll(".clean-nav-link")).find(b => b.textContent.trim() === "Discover").click()');
      await waitFor(win, '!!document.querySelector(".discover-feature")');
      await run('document.querySelector(".discover-feature .btn-primary").click()');
      await waitFor(win, '!!document.querySelector(".detail-actions .btn-primary")');
      await run('Array.from(document.querySelectorAll(".detail-actions button")).find(b => b.textContent.trim() === "Save").click()');
      await waitFor(win, 'document.querySelectorAll(".clean-saved-row").length === 1');
      await run('document.querySelector(".detail-actions .btn-primary").click()');
      await waitFor(win, '!!document.querySelector("button[title^=Change]")');
      await run('document.querySelector("button[title^=Change]").click()');
      await waitFor(win, 'document.querySelectorAll(".source-dropdown__item").length === 10');
      await delay(200);
      const bounds = await run(`(() => { const r=document.querySelector('.playback-server-dialog').getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}; })()`);
      assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height);
      await snap('Movie-Servers.png');
      const themes = [];
      for (const [theme, accent] of [['light', 'blue'], ['mocha', 'purple'], ['amoled', 'green'], ['slate', 'orange'], ['dark', 'red'], ['dark', 'pink']]) {
        await run(`localStorage.setItem('streambert_theme', ${JSON.stringify(JSON.stringify(theme))}); localStorage.setItem('streambert_accentColor', ${JSON.stringify(JSON.stringify(accent))});`);
        await reload();
        const colors = await run(`(() => {const s=getComputedStyle(document.documentElement);return {bg:s.getPropertyValue('--bg').trim(),accent:s.getPropertyValue('--red').trim()};})()`);
        themes.push({theme,accent,...colors});
        if (theme === 'light') { assert.equal(colors.accent,'#2563eb'); assert.equal(colors.bg,'#ebebed'); await snap('Discover-Light.png'); }
      }
      win.setMinimumSize(500,500); win.setSize(600,800); await delay(300); await snap('Discover-Narrow.png');
      const overflow = await run('document.documentElement.scrollWidth > innerWidth'); assert.equal(overflow,false);
      await run('Array.from(document.querySelectorAll(".clean-sidebar-footer button")).find(b=>b.textContent.includes("Settings")).click()');
      await waitFor(win, 'document.body.innerText.includes("APPEARANCE")');
      await snap('Settings-Narrow.png');

      for (const [id,label] of [['movie','Movies'],['tv','TV shows'],['all','For you']]) {
        await run(`document.querySelector('.startup-discover-tabs button[aria-pressed]')?.scrollIntoView({block:'center'})`);
        await run(`Array.from(document.querySelectorAll('.startup-discover-tabs button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
        assert.equal(await run('JSON.parse(localStorage.getItem("streambert_startPage"))'),'home');
        if(id==='movie') await snap('Startup-Tab-Settings.png');
        await reload();
        assert.equal(await run('document.querySelector(".discover-tabs button[aria-pressed=true]").textContent'),label);
        if(id!=='all') {
          await run('Array.from(document.querySelectorAll(".clean-sidebar-footer button")).find(b=>b.textContent.includes("Settings")).click()');
          await waitFor(win,'!!document.querySelector(".startup-discover-tabs")');
        }
      }
      fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify({mode:'local fixtures; all HTTPS intercepted; no live playback',passed:['Collection text filtering and watched-card action','Discover movie/TV filters','TV episode list and player','TV source switching','Movie player and ten servers','Save updates sidebar watchlist','All six accents and five preset themes load','Narrow layout has no document overflow','Settings remain accessible','Settings startup tabs save automatically and open the selected Discover view after reload'],themes,bounds},null,2));
      console.log('LAYOUT UI ACCEPTANCE PASS');app.exit(0);
    } catch(error) { console.error(error); console.error(await run('document.body.innerText')); await snap('Failure.png');app.exit(1); }
  });
});
require(process.env.STREAMBERT_TEST_ASAR || '../index.js');
setTimeout(()=>{console.error('Layout smoke timeout');app.exit(1);},55000).unref();

