const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const { readDownloadStore, writeDownloadStore } = require('../src/ipc/downloadStore');

function historyFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'streambert-plus-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'downloads.json');
}
test('unfinished and failed jobs survive restart without losing partial files', (t) => {
  const file = historyFile(t);
  const partial = path.join(path.dirname(file), 'movie.part');
  fs.writeFileSync(partial, 'partial video');
  writeDownloadStore(file, [
    { id: 'active', status: 'downloading', progress: 42 },
    { id: 'failed', status: 'error', lastMessage: 'Network failed' },
    { id: 'done', status: 'completed' },
  ]);
  const restored = readDownloadStore(file);
  assert.equal(restored[0].status, 'interrupted');
  assert.equal(restored[0].progress, 42);
  assert.equal(restored[1].lastMessage, 'Network failed');
  assert.equal(restored[2].status, 'completed');
  assert.equal(fs.readFileSync(partial, 'utf8'), 'partial video');
});
test('corrupt primary history recovers last valid backup and preserves corrupt evidence', (t) => {
  const file = historyFile(t);
  writeDownloadStore(file, [{ id: 'first', status: 'completed' }]);
  writeDownloadStore(file, [{ id: 'second', status: 'completed' }]);
  fs.writeFileSync(file, '{broken');
  assert.equal(readDownloadStore(file)[0].id, 'first');
  writeDownloadStore(file, [{ id: 'recovered', status: 'completed' }]);
  assert.ok(fs.readdirSync(path.dirname(file)).some((name) => name.includes('.corrupt-')));
  assert.equal(readDownloadStore(file)[0].id, 'recovered');
  assert.ok(!fs.existsSync(`${file}.tmp`));
});
function loadApi() {
  const output = buildSync({ entryPoints: ['src/utils/api.js'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports, URL, AbortSignal, console });
  return module.exports;
}
test('all four original sources remain and every additional provider has movie and TV routes', () => {
  const api = loadApi();
  const sources = api.PLAYER_SOURCES;
  for (const id of ['videasy', 'vidsrc', 'vidking', 'allmanga']) assert.ok(sources.some((s) => s.id === id));
  assert.equal(sources.length, 10);
  assert.equal(new Set(sources.map((s) => s.id)).size, sources.length);
  for (const source of sources.filter((s) => s.note === 'Additional')) {
    for (const type of ['movie', 'tv']) {
      const url = new URL(api.getSourceUrl(source.id, type, 550, 2, 3));
      assert.equal(url.protocol, 'https:');
      assert.ok(url.href.includes('550'));
      assert.ok(!url.href.includes('undefined'));
    }
    assert.notEqual(source.supportsProgress, true);
  }
  const multi = new URL(api.getSourceUrl('multiembed', 'tv', 1399, 2, 3));
  assert.equal(multi.searchParams.get('tmdb'), '1');
  assert.equal(multi.searchParams.get('s'), '2');
  assert.equal(multi.searchParams.get('e'), '3');
  assert.equal(api.getSourceUrl('autoembed', 'tv', 1399, 2, 3), 'https://autoembed.me/tv/tmdb/1399-2-3');
});
test('duration probing does not call blocking child-process operations', async () => {
  const handlers = new Map();
  let probes = 0;
  const module = { exports: {} };
  const nativeRequire = require;
  const fakeRequire = (name) => {
    if (name === 'electron') return { ipcMain: { handle: (id, fn) => handlers.set(id, fn) }, app: {}, shell: {} };
    if (name === 'child_process') return {
      spawnSync: () => { throw new Error('Blocking process call'); }, spawn: () => {},
      execFile: (_file, _args, options, callback) => {
        probes++;
        assert.equal(options.windowsHide, true);
        setImmediate(() => callback(null, '120.5', ''));
      },
    };
    return nativeRequire(name);
  };
  vm.runInNewContext(fs.readFileSync('src/ipc/player.js', 'utf8'), { require: fakeRequire, module, process, console, URL });
  module.exports.register(() => null, { writeSecretMigration() {} });
  const pending = handlers.get('get-video-duration')({}, 'C:\\example.mp4');
  assert.equal(typeof pending.then, 'function');
  const result = await pending;
  assert.equal(result.duration, 120.5);
  assert.equal(probes, 1);
  const update = await handlers.get('download-and-install-update')({}, {});
  assert.equal(update.ok, false);
});
test('packaging includes the pop-out preload and a distinct app identity', () => {
  const pkg = require('../package.json');
  assert.ok(pkg.build.files.includes('popout-preload.js'));
  assert.ok(fs.existsSync('popout-preload.js'));
  assert.notEqual(pkg.build.appId, 'com.truelockmc.streambert');
});


test('EmbedWave movie and TV routes pin the tested backend without losing episode identifiers', () => {
  const api=loadApi();
  const movie=new URL(api.getSourceUrl('embedwave','movie',550));
  const tv=new URL(api.getSourceUrl('embedwave','tv',1399,2,3));
  assert.equal(movie.origin,'https://embedwave.cc');
  assert.equal(movie.pathname,'/embed/movie/550');
  assert.equal(tv.pathname,'/embed/tv/1399/2/3');
  assert.equal(movie.searchParams.get('server'),'cinesrc');
  assert.equal(tv.searchParams.get('server'),'cinesrc');
});

