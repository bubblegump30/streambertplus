// Local-only UI acceptance fixture. All HTTPS requests are intercepted; no real
// credentials or provider playback are used. Run with Electron, not node --test.
const { app, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const artifacts = path.resolve(root, '..', 'ui-evidence');
fs.mkdirSync(artifacts, { recursive: true });
const originalSetPath = app.setPath.bind(app);
app.setPath = (name, value) => originalSetPath(name, name === 'userData' ? path.join(artifacts, 'fixture-profile') : value);
const item = { id: 550, title: 'Local UI acceptance fixture', name: 'Local UI acceptance fixture',
  overview: 'Local test data for checking the application layout. No provider playback is running.',
  media_type: 'movie', vote_average: 8, release_date: '2000-01-01', genres: [], genre_ids: [],
  poster_path: null, backdrop_path: null, runtime: 120, production_countries: [], spoken_languages: [] };
const wired = new WeakSet();
function intercept(ses) {
  if (wired.has(ses)) return;
  wired.add(ses);
  ses.protocol.handle('https', (request) => {
    const url = new URL(request.url);
    if (url.host !== 'api.themoviedb.org') return new Response('<html><body style="background:#15151b;color:white;font-family:sans-serif"><h2>Local player fixture</h2><p>No external video is playing.</p></body></html>', { headers: { 'content-type': 'text/html' } });
    let data = {};
    if (/trending|top_rated|recommendations|similar|popular/.test(url.pathname)) data = { results: [item] };
    else if (/release_dates/.test(url.pathname)) data = { results: [] };
    else if (/videos/.test(url.pathname)) data = { results: [] };
    else if (/credits/.test(url.pathname)) data = { cast: [], crew: [] };
    else if (/movie\/550/.test(url.pathname)) data = item;
    return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
  });
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(win, expression) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await win.webContents.executeJavaScript(expression)) return;
    await delay(150);
  }
  throw new Error(`Timed out: ${expression}`);
}
let tested = false;
app.on('browser-window-created', (_event, win) => {
  if (tested) return;
  tested = true;
  intercept(win.webContents.session);
  intercept(session.fromPartition('persist:player'));
  intercept(session.fromPartition('persist:trailer'));
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript('window.electron.secureSet("apikey", "local-fixture-not-a-real-token")');
      const reloaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
      win.webContents.reload();
      await reloaded;
      await waitFor(win, '!!document.querySelector(".hero-actions .btn-primary")');
      await win.webContents.executeJavaScript('document.querySelector(".hero-actions .btn-primary").click()');
      await waitFor(win, '!!document.querySelector(".detail-actions .btn-primary")');
      await win.webContents.executeJavaScript('document.querySelector(".detail-actions .btn-primary").click()');
      await waitFor(win, '!!document.querySelector("button[title^=Change]")');
      await win.webContents.executeJavaScript('document.querySelector("button[title^=Change]").click()');
      await waitFor(win, 'document.querySelectorAll(".source-dropdown__item").length === 10');
      const readGrid = () => win.webContents.executeJavaScript(`(() => {
        const menu = document.querySelector('.source-dropdown'); const r = menu.getBoundingClientRect();
        return { count: menu.querySelectorAll('button').length, left:r.left, right:r.right, top:r.top,
          bottom:r.bottom, width:innerWidth, height:innerHeight, display:getComputedStyle(menu).display,
          accent:getComputedStyle(document.documentElement).getPropertyValue('--red').trim() };
      })()`);
      await delay(250);
      const desktop = await readGrid();
      assert.equal(desktop.count, 10); assert.equal(desktop.display, 'grid');
      assert.ok(desktop.left >= 0 && desktop.right <= desktop.width && desktop.top >= 0 && desktop.bottom <= desktop.height);
      fs.writeFileSync(path.join(artifacts, 'server-grid-desktop.png'), (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript('Array.from(document.querySelectorAll(".source-dropdown__item")).find(b => b.textContent.includes("VidLink")).click()');
      await waitFor(win, 'document.querySelector("button[title^=Change]")?.textContent.includes("VidLink")');
      assert.equal(await win.webContents.executeJavaScript('JSON.parse(localStorage.getItem("streambert_playerSource"))'), 'vidlink');
      await win.webContents.executeJavaScript('document.querySelector("button[title^=Change]").click()');
      win.setMinimumSize(500, 500); win.setSize(600, 700);
      await delay(300);
      const narrow = await readGrid();
      assert.ok(narrow.left >= 0 && narrow.right <= narrow.width && narrow.top >= 0 && narrow.bottom <= narrow.height);
      fs.writeFileSync(path.join(artifacts, 'server-grid-narrow.png'), (await win.webContents.capturePage()).toPNG());
      fs.writeFileSync(path.join(artifacts, 'result.json'), JSON.stringify({ mode:'local fixtures; no live playback', desktop, narrow, providerSelection:'VidLink selected and preference persisted' }, null, 2));
      console.log('UI ACCEPTANCE PASS: 10 sources, desktop/narrow bounds, provider selection and persistence.');
      app.exit(0);
    } catch (error) { console.error(error); console.error(await win.webContents.executeJavaScript("document.body.innerText")); fs.writeFileSync(path.join(artifacts, "failure.png"), (await win.webContents.capturePage()).toPNG()); app.exit(1); }
  });
});
require('../index.js');
setTimeout(() => { console.error('UI test global timeout'); app.exit(1); }, 30000).unref();
