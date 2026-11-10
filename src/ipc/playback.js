const { ipcMain, webContents, session } = require("electron");
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { setTimeout, clearTimeout } = require("timers");
async function boundedRead(frame, code) {
  let timer;
  try { return await Promise.race([frame.executeJavaScript(code), new Promise((resolve) => { timer = setTimeout(() => resolve(null), 2000); })]); }
  finally { clearTimeout(timer); }
}

const SNAPSHOT = `(() => {
  const videos = Array.from(document.querySelectorAll('video'));
  const v = videos.find(v => !v.paused && Number.isFinite(v.duration) && v.duration > 0) || videos.find(v => Number.isFinite(v.duration) && v.duration > 0);
  if (!v) return null;
  return { currentTime: v.currentTime, duration: v.duration, paused: v.paused, ended: v.ended,
    readyState: v.readyState, errorCode: v.error?.code || null };
})()`;
function register(getMainWindow) {
  const authorized = (event) => event.sender?.id === getMainWindow()?.webContents.id;
  const playerContents = (event, id) => {
    if (!authorized(event) || !Number.isInteger(id)) return null;
    const wc = webContents.fromId(id);
    return wc && !wc.isDestroyed() && wc.session === session.fromPartition("persist:player") ? wc : null;
  };
  const frames = (wc) => (wc.mainFrame?.framesInSubtree || [wc.mainFrame].filter(Boolean)).slice(0, 40);
  ipcMain.handle("playback-snapshot", async (event, request) => {
    const id = typeof request === "number" ? request : request?.id;
    const expectedDuration = Number.isFinite(request?.expectedDuration) && request.expectedDuration > 0 ? request.expectedDuration : 0;
    const wc = playerContents(event, id);
    if (!wc) return null;
    const results = await Promise.all(frames(wc).map(async (frame) => {
      try {
        const result = await boundedRead(frame, SNAPSHOT);
        if (!result || !Number.isFinite(result.duration) || result.duration < Math.min(600, expectedDuration * 0.2)) return null;
        return { ...result, frameRoutingId: frame.routingId };
      } catch { return null; }
    }));
    return results.find((result) => result && !result.paused) || results.find(Boolean) || null;
  });
  ipcMain.handle("playback-seek", async (event, { id, seconds, frameRoutingId } = {}) => {
    const wc = playerContents(event, id);
    if (!wc || !Number.isFinite(seconds) || seconds < 0) return { ok: false };
    const candidates = Number.isInteger(frameRoutingId) ? frames(wc).filter((frame) => frame.routingId === frameRoutingId) : frames(wc);
    for (const frame of candidates) {
      try {
        const result = await boundedRead(frame, `(() => {
          const videos = Array.from(document.querySelectorAll('video'));
          const v = videos.find(v => !v.paused && Number.isFinite(v.duration) && v.duration > 0) || videos.find(v => Number.isFinite(v.duration) && v.duration > 0);
          if (!v || !v.seekable.length) return null;
          const target = Math.min(${seconds}, Math.max(0, v.duration - 0.5));
          let allowed = false;
          for (let i = 0; i < v.seekable.length; i++) if (target >= v.seekable.start(i) && target <= v.seekable.end(i)) allowed = true;
          if (!allowed) return null;
          v.currentTime = target;
          return { ok: true, target };
        })()`);
        if (result?.ok) return result;
      } catch { /* Try the next frame. */ }
    }
    return { ok: false };
  });
  ipcMain.handle("open-stream-player", async (event, { url, title, seconds = 0 } = {}) => {
    if (!authorized(event)) return { ok: false, error: "Unauthorized request" };
    let parsed;
    try { parsed = new URL(url); } catch { return { ok: false, error: "No compatible stream detected yet" }; }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return { ok: false, error: "Unsupported stream URL" };
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const safeTitle = String(title || "Streambert Plus").replace(/[\r\n]/g, " ").slice(0, 180);
    const find = async (binary, commonPath) => {
      if (commonPath && fs.existsSync(commonPath)) return commonPath;
      return new Promise((resolve) => execFile(process.platform === "win32" ? "where" : "which", [binary], { timeout: 2500, windowsHide: true }, (error, stdout) => resolve(error ? null : stdout.trim().split(/\r?\n/)[0])));
    };
    const candidates = [
      ["mpv", process.platform === "win32" ? "C:\\Program Files\\mpv\\mpv.exe" : null, [`--force-media-title=${safeTitle}`, `--start=${safeSeconds}`, "--", url]],
      ["vlc", process.platform === "win32" ? "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe" : null, [`--meta-title=${safeTitle}`, `--start-time=${safeSeconds}`, "--", url]],
    ];
    for (const [name, commonPath, args] of candidates) {
      const binary = await find(name, commonPath);
      if (!binary || !path.isAbsolute(binary)) continue;
      const launched = await new Promise((resolve) => {
        const child = spawn(binary, args, { detached: true, stdio: "ignore", windowsHide: true, shell: false });
        child.once("error", () => resolve(false));
        child.once("spawn", () => { child.unref(); resolve(true); });
      });
      if (launched) return { ok: true, player: name };
    }
    return { ok: false, error: "Install VLC or mpv to use an external player. The stream must also allow external playback." };
  });
}
module.exports = { register };
