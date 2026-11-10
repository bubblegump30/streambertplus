const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const { buildSync } = require('esbuild');

function loadPlayback() {
  const values = new Map();
  const localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const output = buildSync({ entryPoints: ['src/utils/playback.js'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports, localStorage, URL, AbortSignal, console, Date });
  return { api: module.exports, values };
}
const sample = (currentTime, extra = {}) => ({ currentTime, duration: 300, paused: false, readyState: 4, errorCode: null, ...extra });
test('only advancing usable media clocks qualify as successful playback', () => {
  const { api } = loadPlayback();
  assert.equal(api.rememberSuccessfulSource('movie_1', 'movie_1', 'vidlink', null, null), false);
  assert.equal(api.rememberSuccessfulSource('movie_1', 'movie_1', 'vidlink', sample(10), sample(10)), false);
  assert.equal(api.rememberSuccessfulSource('movie_1', 'movie_1', 'vidlink', sample(10), sample(11, { paused: true })), false);
  assert.equal(api.rememberSuccessfulSource('movie_1', 'movie_1', 'vidlink', sample(10), sample(100)), false);
  assert.equal(api.rememberSuccessfulSource('movie_1', 'movie_1', 'vidlink', sample(10), sample(11, { errorCode: 3 })), false);
  assert.equal(api.rememberSuccessfulSource('movie_1', 'movie_1', 'vidlink', sample(10), sample(11)), true);
  assert.equal(api.lastSuccessfulSource('movie_1'), 'vidlink');
});
test('favorite ordering is deduplicated and observed success wins per title', () => {
  const { api } = loadPlayback();
  api.setFavorites(['vidlink', 'not-a-provider', 'vidlink', 'videasy']);
  assert.equal(JSON.stringify(api.getFavorites()), JSON.stringify(['vidlink', 'videasy']));
  assert.equal(api.orderedSources()[0].id, 'vidlink');
  assert.equal(api.preferredSource('tv_1_s1e1', 'tv_1'), 'vidlink');
  api.rememberSuccessfulSource('tv_1_s1e1', 'tv_1', 'multiembed', sample(10), sample(11));
  assert.equal(api.preferredSource('tv_1_s1e1', 'tv_1'), 'multiembed');
  assert.equal(api.preferredSource('tv_1_s1e2', 'tv_1'), 'multiembed');
  assert.equal(api.preferredSource('tv_2_s1e1', 'tv_2'), 'vidlink');
});
test('bookmarks migrate legacy seconds and percentages and reject invalid samples', () => {
  const { api, values } = loadPlayback();
  values.set('streambert_dlTime_movie_1', JSON.stringify(90));
  assert.equal(api.readBookmark('movie_1', 30, 300).seconds, 90);
  assert.equal(api.readBookmark('movie_2', 40, 300).seconds, 120);
  assert.equal(api.saveBookmark('movie_1', sample(Infinity)), false);
  assert.equal(api.saveBookmark('movie_1', sample(3010)), false);
  assert.equal(api.saveBookmark('movie_1', sample(120)), true);
  assert.equal(api.readBookmark('movie_1').seconds, 120);
  assert.equal(api.readBookmark('movie_1').percent, 40);
  api.clearBookmark('movie_1');
  assert.equal(api.readBookmark('movie_1').seconds, 0);
});
function loadIpc(video) {
  const handlers = new Map();
  const mainSession = {}, playerSession = {};
  let executions = 0, spawns = 0;
  const player = { isDestroyed: () => false, session: playerSession, mainFrame: { framesInSubtree: [{ executeJavaScript: async (script) => { executions++; return vm.runInNewContext(script, { document: { querySelectorAll: () => video ? [video] : [] } }); } }] } };
  const module = { exports: {} };
  const fakeRequire = (name) => {
    if (name === 'electron') return { ipcMain: { handle: (id, fn) => handlers.set(id, fn) }, session: { fromPartition: () => playerSession }, webContents: { fromId: (id) => id === 22 ? player : id === 23 ? { ...player, session: mainSession } : null } };
    if (name === 'child_process') return { execFile: (_file, _args, _options, cb) => cb(new Error('not installed'), ''), spawn: () => { spawns++; return new EventEmitter(); } };
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync('src/ipc/playback.js', 'utf8'), { require: fakeRequire, module, process, URL, console });
  module.exports.register(() => ({ webContents: { id: 7 } }));
  return { handlers, calls: () => ({ executions, spawns }) };
}
test('player IPC rejects other senders and non-player windows', async () => {
  const { handlers, calls } = loadIpc(sample(10));
  assert.equal(await handlers.get('playback-snapshot')({ sender: { id: 8 } }, 22), null);
  assert.equal(await handlers.get('playback-snapshot')({ sender: { id: 7 } }, 23), null);
  assert.equal(calls().executions, 0);
});
test('frame snapshots and seek support are checked before reporting resume acceptance', async () => {
  const video = { ...sample(10), ended: false, seekable: { length: 1, start: () => 0, end: () => 300 } };
  const { handlers } = loadIpc(video);
  const event = { sender: { id: 7 } };
  const read = await handlers.get('playback-snapshot')(event, 22);
  assert.equal(read.currentTime, 10);
  assert.equal((await handlers.get('playback-seek')(event, { id: 22, seconds: 120 })).ok, true);
  assert.equal(video.currentTime, 120);
  assert.equal((await handlers.get('playback-seek')(event, { id: 22, seconds: '120' })).ok, false);
  assert.equal((await handlers.get('playback-seek')(event, { id: 22, seconds: -1 })).ok, false);
  video.seekable.length = 0;
  assert.equal((await handlers.get('playback-seek')(event, { id: 22, seconds: 150 })).ok, false);
});
test('short media is ignored when title runtime indicates a full-length feature', async () => {
  const { handlers } = loadIpc(sample(10, { duration: 30 }));
  assert.equal(await handlers.get('playback-snapshot')({ sender: { id: 7 } }, { id: 22, expectedDuration: 6000 }), null);
});
test('backups include new playback preferences and color themes without credentials', () => {
  const output = buildSync({ entryPoints: ['src/utils/backup.js'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const values = new Map();
  const localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const module = { exports: {} };
  vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports, localStorage });
  const source = { playbackFavorites: ['vidlink'], playbackBookmarks: { movie_1: { seconds: 90, duration: 300 } }, theme: 'light', customThemeVars: { '--bg': '#123456' }, apikey: 'must-not-export' };
  module.exports.restoreBackupData(source);
  const backup = module.exports.collectBackupData();
  assert.equal(JSON.stringify(backup.playbackFavorites), '["vidlink"]');
  assert.equal(backup.playbackBookmarks.movie_1.seconds, 90);
  assert.equal(backup.theme, 'light');
  assert.equal(backup.customThemeVars['--bg'], '#123456');
  assert.equal(backup.apikey, undefined);
});
test('external player rejects non-network URLs and embedded credentials without spawning', async () => {
  const { handlers, calls } = loadIpc();
  for (const url of ['file:///C:/test.exe', 'javascript:alert(1)', 'https://user:pass@example.com/a.m3u8']) {
    assert.equal((await handlers.get('open-stream-player')({ sender: { id: 7 } }, { url })).ok, false);
  }
  assert.equal(calls().spawns, 0);
});


test('retired providers are skipped even when saved as favorites, defaults or last success', () => {
  const { api, values } = loadPlayback();
  values.set('streambert_playerSource', JSON.stringify('vidking'));
  api.setFavorites(['videasy', 'vidking']);
  api.rememberSuccessfulSource('movie_55','movie_55','vidking',sample(10),sample(11));
  assert.equal(api.preferredSource('movie_55','movie_55'),'vidlink');
  assert.ok(api.orderedSources().every(source=>source.available !== false));
  assert.equal(api.orderedSources(api.getFavorites(),true).filter(source=>source.available===false).length,2);
});


test('a video failure before metadata is available reaches the existing recovery UI', async () => {
  const fixture=loadIpc({duration:NaN,currentTime:0,paused:true,readyState:0,error:{code:4}});
  const result=await fixture.handlers.get('playback-snapshot')({sender:{id:7}}, {id:22,expectedDuration:7200});
  assert.equal(result.errorCode,4);
});

