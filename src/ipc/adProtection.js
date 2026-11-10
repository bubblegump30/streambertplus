const fs = require('node:fs');
const path = require('node:path');
const { FiltersEngine, Request } = require('@ghostery/adblocker');
let engine;
function getEngine() {
  if (!engine) engine = FiltersEngine.parse(fs.readFileSync(path.join(__dirname, 'filters/easylist.txt'), 'utf8'), { loadNetworkFilters: true, loadCosmeticFilters: true });
  return engine;
}
function blocksRequest(details) {
  // Keep Electron's resource type and initiator: filter exceptions and first-party rules matter.
  return getEngine().match(Request.fromRawDetails({ url: details.url, sourceUrl: details.referrer || '', type: details.resourceType || 'other' })).match;
}
function safeNavigation(url, current) {
  try {
    const next = new URL(url), base = new URL(current);
    return ['http:', 'https:'].includes(next.protocol) && next.origin === base.origin;
  } catch { return false; }
}
const protectedContents = new WeakSet();
function protectContents(wc, recordBlocked) {
  if (protectedContents.has(wc)) return;
  protectedContents.add(wc);
  wc.setWindowOpenHandler(({ url }) => { recordBlocked(url); return { action: 'deny' }; });
  const navigate = (event, url) => {
    if (!safeNavigation(url, wc.getURL())) { event.preventDefault(); recordBlocked(url); }
  };
  // Programmatic loadURL/src changes still work; unsolicited guest navigation cannot leave its origin.
  wc.on('will-navigate', navigate);
  wc.on('will-redirect', (event, url, _inPlace, isMainFrame) => { if (isMainFrame) navigate(event, url); });
  const applyCosmetics = async (frame) => {
    try {
      if (!frame || frame.detached) return;
      const url = frame.url;
      if (!/^https?:/.test(url)) return;
      const request = Request.fromRawDetails({ url, type: 'main_frame' });
      const dom = await Promise.race([
        frame.executeJavaScript(`(() => { const nodes = [...document.querySelectorAll('[id],[class]')].slice(0,3000); return { ids: nodes.map(n=>n.id).filter(Boolean), classes: [...new Set(nodes.flatMap(n=>[...n.classList]))] }; })()`),
        new Promise(resolve => { const timer = setTimeout(() => resolve(null), 1500); timer.unref?.(); })
      ]);
      if (!dom || frame.detached || frame.url !== url) return;
      const { styles } = getEngine().getCosmeticsFilters({ url, hostname: request.hostname, domain: request.domain, ids: dom.ids, classes: dom.classes, getInjectionRules: false, getExtendedRules: false });
      if (styles) await frame.executeJavaScript(`(() => { let s=document.getElementById('streambert-ad-styles'); if(!s){s=document.createElement('style');s.id='streambert-ad-styles';(document.head||document.documentElement).append(s);} s.textContent=${JSON.stringify(styles)}; })()`);
    } catch { /* A guest can navigate or disappear during inspection. */ }
  };
  const refresh = () => {
    if (wc.isDestroyed()) return;
    for (const frame of (wc.mainFrame?.framesInSubtree || [wc.mainFrame].filter(Boolean)).slice(0,40)) void applyCosmetics(frame);
  };
  let timers = [];
  const schedule = () => {
    timers.forEach(clearTimeout);
    refresh();
    timers = [750, 2500].map(ms => { const timer = setTimeout(refresh, ms); timer.unref?.(); return timer; });
  };
  wc.on('dom-ready', schedule);
  wc.on('did-frame-finish-load', refresh);
  wc.once('destroyed', () => timers.forEach(clearTimeout));
}
module.exports = { getEngine, blocksRequest, safeNavigation, protectContents };



