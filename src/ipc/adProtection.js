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
// Confirmed HTTP redirect pair from MultiEmbed's public movie and TV endpoints.
const PLAYER_REDIRECTS = new Map([['https://multiembed.mov', new Set(['https://streamingnow.mov'])]]);
function safeNavigation(url, current, isRedirect = false) {
  try {
    const next = new URL(url), base = new URL(current);
    if (!['http:', 'https:'].includes(next.protocol) || next.username || next.password) return false;
    return next.origin === base.origin || (isRedirect && base.protocol === 'https:' && PLAYER_REDIRECTS.get(base.origin)?.has(next.origin) === true);
  } catch { return false; }
}
const protectedContents = new WeakSet();
const cosmeticVersions = new WeakMap();
const cosmeticBusy = new WeakSet();
function protectContents(wc, recordBlocked) {
  if (protectedContents.has(wc)) return;
  protectedContents.add(wc);
  wc.setWindowOpenHandler(({ url }) => { recordBlocked(url); return { action: 'deny' }; });
  let navigationUrl = wc.getURL();
  wc.on('did-start-navigation', (_event, url, _inPlace, isMainFrame) => {
    if (isMainFrame) navigationUrl = url;
  });
  const navigate = (event, url, isRedirect = false) => {
    if (!safeNavigation(url, navigationUrl || wc.getURL(), isRedirect) || blocksRequest({url,referrer:navigationUrl || wc.getURL(),resourceType:'mainFrame'})) {
      event.preventDefault(); recordBlocked(url);
    }
  };
  // Only a confirmed server redirect pair can cross origins; links/popups cannot use this exception.
  wc.on('will-navigate', (event, url) => navigate(event, url));
  wc.on('will-redirect', (event, url, _inPlace, isMainFrame) => { if (isMainFrame) navigate(event, url, true); });
  const applyCosmetics = async (frame) => {
    if (!frame || frame.detached || cosmeticBusy.has(frame)) return;
    cosmeticBusy.add(frame);
    try {
      const url = frame.url;
      if (!/^https?:/.test(url)) return;
      const request = Request.fromRawDetails({ url, type: 'main_frame' });
      const previous = cosmeticVersions.get(frame);
      const lastVersion = previous?.url === url ? previous.version : -1;
      const dom = await Promise.race([
        frame.executeJavaScript(`(() => {
          const key='__streambertCosmeticWatch';
          let state=window[key];
          if(!state || typeof state.version!=='number') {
            state={version:0};window[key]=state;
            const observer=new MutationObserver(()=>state.version++);
            observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['id','class']});
          }
          const hasStyle=!!document.getElementById('streambert-ad-styles');
          if(state.version===${lastVersion} && hasStyle)return null;
          const nodes=[...document.querySelectorAll('[id],[class]')].slice(0,3000);
          return {version:state.version,ids:nodes.map(n=>n.id).filter(Boolean),classes:[...new Set(nodes.flatMap(n=>[...n.classList]))]};
        })()`),
        new Promise(resolve => { const timer = setTimeout(() => resolve(null), 1500); timer.unref?.(); })
      ]);
      if (!dom || frame.detached || frame.url !== url) return;
      const { styles } = getEngine().getCosmeticsFilters({ url, hostname: request.hostname, domain: request.domain, ids: dom.ids, classes: dom.classes, getInjectionRules: false, getExtendedRules: false });
      cosmeticVersions.set(frame,{url,version:dom.version});
      if (styles) await frame.executeJavaScript(`(() => { let s=document.getElementById('streambert-ad-styles'); if(!s){s=document.createElement('style');s.id='streambert-ad-styles';(document.head||document.documentElement).append(s);} if(s.textContent!==${JSON.stringify(styles)})s.textContent=${JSON.stringify(styles)}; })()`);
    } catch { /* A guest can navigate or disappear during inspection. */ }
    finally { if(frame)cosmeticBusy.delete(frame); }
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
  const dynamicTimer=setInterval(refresh,2000);
  dynamicTimer.unref?.();
  wc.once('destroyed', () => { timers.forEach(clearTimeout); clearInterval(dynamicTimer); });
}
module.exports = { getEngine, blocksRequest, safeNavigation, protectContents };



