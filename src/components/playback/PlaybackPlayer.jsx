import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYER_SOURCES, getSourceUrl, sourceIsAsync } from "../../utils/api";
import { storage } from "../../utils/storage";
import { clockAdvanced, clearBookmark, formatTime, orderedSources, preferredSource, readBookmark, rememberSuccessfulSource, saveBookmark, validSnapshot } from "../../utils/playback";
import { fetchAniSkipTimings } from "../../utils/aniSkip";
import { useBlockedStats } from "../../utils/useBlockedStats";
import DownloadModal from "../DownloadModal";
import BlockedStatsModal from "../BlockedStatsModal";
import ServerPicker from "./ServerPicker";

export default function PlaybackPlayer({ item, mediaType, season = 1, episode = 1, sourceSeason = season, sourceEpisode = episode,
  episodeName, isAnime = false, animeMalId, mediaKey, playerSettings, legacyPercent = 0, duration = 0,
  saveProgress, watched, onMarkWatched, onMarkUnwatched, onSettings, onDownloadStarted, downloads = [], onGoToDownloads, nextEpisode, onNext }) {
  const titleKey = `${mediaType}_${item.id}`;
  const title = item.title || item.name;
  const [bookmark] = useState(() => readBookmark(mediaKey, legacyPercent, duration));
  const [decision, setDecision] = useState(() => bookmark.seconds > 10 && bookmark.percent < 98 ? null : "start");
  const [sourceId, setSourceId] = useState(() => preferredSource(mediaKey, titleKey, isAnime));
  const [attempt, setAttempt] = useState(0);
  const [dub, setDub] = useState(() => storage.get("allmangaDubMode") || "sub");
  const [url, setUrl] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloaderFolder, setDownloaderFolder] = useState(() => storage.get("downloaderFolder") || "");
  const [streamUrl, setStreamUrl] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [pip, setPip] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [resumeUnavailable, setResumeUnavailable] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [timings, setTimings] = useState(null);
  const webview = useRef(null);
  const guestId = useRef(null);
  const pipId = useRef(null);
  const last = useRef(null);
  const previous = useRef(null);
  const requested = useRef(decision === "resume" ? bookmark.seconds : 0);
  const pendingSeek = useRef(null);
  const seekAttempts = useRef(0);
  const confirmed = useRef(false);
  const savedAt = useRef(0);
  const lastAdvanceAt = useRef(0);
  const marked = useRef(!!watched);
  const nextTriggered = useRef(false);
  const introSkipped = useRef(false);
  const callbacks = useRef({ saveProgress, onMarkWatched, onMarkUnwatched, onNext });
  callbacks.current = { saveProgress, onMarkWatched, onMarkUnwatched, onNext };
  const blockStats = useBlockedStats(mediaKey);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const source = PLAYER_SOURCES.find((entry) => entry.id === sourceId);
  const persist = useCallback(() => {
    if (!confirmed.current || pendingSeek.current !== null || !validSnapshot(last.current)) return;
    saveBookmark(mediaKey, last.current);
    callbacks.current.saveProgress?.(mediaKey, Math.floor(last.current.currentTime / last.current.duration * 100));
  }, [mediaKey]);
  const changeSource = (id) => {
    persist();
    if (pip) window.electron?.closePipWindow?.();
    requested.current = validSnapshot(last.current) && confirmed.current ? last.current.currentTime : requested.current;
    storage.set("playerSource", id);
    if (id === sourceId) setAttempt((value) => value + 1);
    else setSourceId(id);
    setPickerOpen(false);
  };
  const nextSource = () => {
    const sources = orderedSources().filter((entry) => isAnime || !entry.async);
    const index = sources.findIndex((entry) => entry.id === sourceId);
    changeSource(sources[(index + 1) % sources.length].id);
  };
  const begin = (choice) => {
    if (choice === "resume") requested.current = bookmark.seconds;
    else {
      requested.current = 0; clearBookmark(mediaKey);
      callbacks.current.saveProgress?.(mediaKey, 0);
      callbacks.current.onMarkUnwatched?.(mediaKey);
    }
    setDecision(choice);
  };
  useEffect(() => {
    if (!decision) return;
    let active = true;
    setPhase("loading"); setMessage(""); setUrl(null); setSnapshot(null); setStreamUrl(null); setSubtitles([]); setResumeUnavailable(false); setPip(false);
    lastAdvanceAt.current = 0;
    guestId.current = null; pipId.current = null; last.current = null; previous.current = null; confirmed.current = false;
    pendingSeek.current = requested.current; seekAttempts.current = 0; savedAt.current = 0;
    const load = async () => {
      try {
        let playerUrl;
        if (sourceIsAsync(sourceId)) {
          const result = await window.electron.resolveAllManga({ title, seasonNumber: season, episodeNumber: episode, isMovie: mediaType === "movie", translationType: dub });
          if (!active) return;
          if (!result?.ok || !result.url) throw new Error(result?.error || "This title could not be resolved on AllManga.");
          if (result.isDirectMp4 !== undefined) {
            const local = await window.electron.setPlayerVideo({ url: result.url, referer: result.referer || "https://allmanga.to", startTime: 0 });
            if (!active) return;
            playerUrl = local.playerUrl; setStreamUrl(result.url);
          } else playerUrl = result.url;
        } else playerUrl = getSourceUrl(sourceId, mediaType, item.id, sourceSeason, sourceEpisode, {}, playerSettings?.accentColor, playerSettings?.subtitleLang);
        if (active) setUrl(playerUrl);
      } catch (error) { if (active) { setPhase("error"); setMessage(error.message || "Unable to load this source."); } }
    };
    load();
    const slow = setTimeout(() => { if (active) setPhase((value) => value === "loading" || value === "page-ready" ? "waiting" : value); }, 25000);
    return () => { active = false; clearTimeout(slow); };
  }, [sourceId, attempt, decision, dub, mediaKey, title, mediaType, item.id, season, episode, sourceSeason, sourceEpisode, playerSettings?.accentColor, playerSettings?.subtitleLang]);
  useEffect(() => {
    const wc = webview.current;
    if (!url || !wc || pip) return;
    const ready = () => {
      try { guestId.current = wc.getWebContentsId(); } catch { return; }
      setPhase((value) => ["loading", "waiting"].includes(value) ? "page-ready" : value);
    };
    const failed = (event) => {
      if (event.isMainFrame === false || event.errorCode === -3) return;
      setPhase("error"); setMessage(`The player page could not load (${event.errorDescription || event.errorCode}).`);
    };
    const crashed = () => { persist(); setPhase("error"); setMessage("The player process stopped. Retry or choose another source."); };
    wc.addEventListener("dom-ready", ready); wc.addEventListener("did-finish-load", ready); wc.addEventListener("did-fail-load", failed); wc.addEventListener("render-process-gone", crashed);
    return () => { wc.removeEventListener("dom-ready", ready); wc.removeEventListener("did-finish-load", ready); wc.removeEventListener("did-fail-load", failed); wc.removeEventListener("render-process-gone", crashed); };
  }, [url, pip, persist]);
  useEffect(() => {
    if (!url || !decision) return;
    let active = true, timer;
    const poll = async () => {
      try {
        const id = pipId.current || guestId.current;
        const sample = id ? await window.electron.playbackSnapshot(id, duration) : null;
        if (!active) return;
        if (id !== (pipId.current || guestId.current)) { timer = setTimeout(poll, 500); return; }
        if (validSnapshot(sample)) {
          setSnapshot(sample);
          if (pendingSeek.current !== null) {
            const target = Math.min(pendingSeek.current, Math.max(0, sample.duration - 0.5));
            if (Math.abs(sample.currentTime - target) <= 2.5) { pendingSeek.current = null; previous.current = null; setResumeUnavailable(false); }
            else if (seekAttempts.current < 8) { seekAttempts.current++; await window.electron.playbackSeek(id, target, sample.frameRoutingId); }
            else setResumeUnavailable(true);
          }
          if (!active) return;
          if (clockAdvanced(previous.current, sample)) {
            lastAdvanceAt.current = Date.now();
            setPhase("playing");
            if (!confirmed.current) { rememberSuccessfulSource(mediaKey, titleKey, sourceId, previous.current, sample); confirmed.current = true; }
          } else if (confirmed.current && sample.paused) setPhase(sample.ended ? "ended" : "paused");
          else if (confirmed.current && Date.now() - lastAdvanceAt.current > 15000) setPhase("stalled");
          last.current = sample;
          previous.current = sample;
          if (confirmed.current && pendingSeek.current === null) {
            if (Date.now() - savedAt.current >= 5000 || sample.paused || sample.ended) { persist(); savedAt.current = Date.now(); }
            const remaining = sample.duration - sample.currentTime;
            if (!marked.current && remaining <= (storage.get("watchedThreshold") ?? 20)) { marked.current = true; callbacks.current.onMarkWatched?.(mediaKey); }
            if (nextEpisode && !nextTriggered.current && (sample.ended || remaining <= 3) && (storage.get("autoplayNextEnabled") ?? true)) {
              nextTriggered.current = true; setCountdown(storage.get("autoplayNextDuration") ?? 5);
            }
          }
        } else if (sample?.errorCode) { setPhase("error"); setMessage(`The video reported a media error (${sample.errorCode}).`); }
      } catch { /* Lack of a usable media signal is not proof of a failed stream. */ }
      if (active) timer = setTimeout(poll, 1000);
    };
    timer = setTimeout(poll, 500);
    return () => { active = false; clearTimeout(timer); persist(); };
  }, [url, decision, sourceId, mediaKey, titleKey, persist, duration, nextEpisode?.id]);
  useEffect(() => {
    if (countdown === null || countdown === 0) return;
    const timer = setTimeout(() => {
      if (countdown <= 1) { setCountdown(null); persist(); callbacks.current.onNext?.(); }
      else setCountdown(countdown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, persist]);
  useEffect(() => {
    if (!isAnime || !animeMalId || (storage.get("introSkipMode") || "off") === "off") return;
    let active = true;
    fetchAniSkipTimings(animeMalId, episode).then((value) => { if (active) setTimings(value); });
    return () => { active = false; };
  }, [isAnime, animeMalId, episode]);
  const inIntro = timings?.intro && snapshot && snapshot.currentTime >= timings.intro.startTime && snapshot.currentTime < timings.intro.endTime;
  useEffect(() => {
    if (inIntro && !introSkipped.current && storage.get("introSkipMode") === "auto") {
      introSkipped.current = true; window.electron.playbackSeek(pipId.current || guestId.current, timings.intro.endTime).catch(() => {});
    }
  }, [inIntro, timings]);
  useEffect(() => {
    const api = window.electron;
    if (!api) return;
    const media = api.onPlaybackMedia?.((data) => { if (data.webContentsId === guestId.current || data.webContentsId === pipId.current) setStreamUrl(data.url); });
    const sub = api.onSubtitleFound?.((data) => {
      if (data.webContentsId !== guestId.current && data.webContentsId !== pipId.current) return;
      setSubtitles((prev) => prev.some((entry) => entry.url === data.url) ? prev : [...prev, data]);
    });
    const close = api.onPipClosed?.(() => { persist(); requested.current = last.current?.currentTime || requested.current; pendingSeek.current = requested.current; seekAttempts.current = 0; guestId.current = null; pipId.current = null; setPip(false); });
    const enter = api.onWebviewEnterFullscreen?.(() => setFullscreen(true));
    const leave = api.onWebviewLeaveFullscreen?.(() => setFullscreen(false));
    return () => { if (media) api.offPlaybackMedia?.(media); if (sub) api.offSubtitleFound?.(sub); if (close) api.offPipClosed?.(close); if (enter) api.offWebviewEnterFullscreen?.(enter); if (leave) api.offWebviewLeaveFullscreen?.(leave); };
  }, []);
  useEffect(() => {
    if (fullscreen) document.documentElement.setAttribute("data-player-fullscreen", "1");
    else document.documentElement.removeAttribute("data-player-fullscreen");
    return () => document.documentElement.removeAttribute("data-player-fullscreen");
  }, [fullscreen]);
  useEffect(() => { marked.current = !!watched; }, [watched]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) persist(); };
    window.addEventListener("pagehide", persist); document.addEventListener("visibilitychange", hidden);
    return () => { persist(); window.electron?.closePipWindow?.(); window.removeEventListener("pagehide", persist); document.removeEventListener("visibilitychange", hidden); };
  }, [persist]);
  const openPip = async () => {
    if (pip) { await window.electron.closePipWindow(); return; }
    persist();
    const result = await window.electron.openPipWindow(url, title);
    if (result?.ok) { pipId.current = await window.electron.getPipWebContentsId(); requested.current = last.current?.currentTime || 0; pendingSeek.current = requested.current; seekAttempts.current = 0; setPip(true); }
  };
  const openExternal = async () => {
    const result = await window.electron.openStreamPlayer({ url: streamUrl, title, seconds: last.current?.currentTime || requested.current || 0 });
    setMessage(result?.ok ? `${result.player} opened. External playback is controlled by that player.` : result?.error || "Could not open an external player.");
  };
  const recordedDownload = downloads.find((entry) => entry.mediaType === mediaType && Number(entry.tmdbId || entry.mediaId) === Number(item.id) && (mediaType === "movie" || (Number(entry.season) === Number(season) && Number(entry.episode) === Number(episode))) && ["completed", "local", "downloading"].includes(entry.status));
  const labels = { loading: "Loading player page", "page-ready": "Page loaded - start playback in the player", waiting: "No playback detected yet - press Play or try another server", playing: "Playback observed", paused: "Paused", ended: "Finished", stalled: "Playback appears stalled - retry or change server", error: "Playback needs attention" };
  return <section className={`playback-workspace${fullscreen ? " playback-fullscreen" : ""}`} aria-label="Playback">
    {!decision ? <div className="playback-resume-choice"><span className="clean-eyebrow">CONTINUE WATCHING</span><h2>Pick up where you left off?</h2><p>{episodeName || title} · {formatTime(bookmark.seconds)}{bookmark.duration > 0 ? ` of ${formatTime(bookmark.duration)}` : ""}</p><div><button className="btn btn-primary" onClick={() => begin("resume")}>Resume from {formatTime(bookmark.seconds)}</button><button className="btn btn-secondary" onClick={() => begin("start")}>Start over</button></div><small>If this server cannot resume, your saved position stays safe.</small></div> : <>
      <div className="playback-toolbar"><button className="btn btn-secondary" title="Change source" onClick={() => setPickerOpen(true)}>Server: {source?.label}</button><button className="btn btn-secondary" onClick={() => changeSource(sourceId)}>Retry</button><button className="btn btn-secondary" onClick={nextSource}>Try next server</button><button className="btn btn-ghost" onClick={() => { requested.current = 0; clearBookmark(mediaKey); callbacks.current.saveProgress?.(mediaKey, 0); callbacks.current.onMarkUnwatched?.(mediaKey); marked.current = false; if (pip) window.electron.closePipWindow(); setAttempt((value) => value + 1); }}>Start over</button>{sourceIsAsync(sourceId) && <button className="btn btn-secondary" onClick={() => { persist(); requested.current = last.current?.currentTime || requested.current; const value = dub === "sub" ? "dub" : "sub"; setDub(value); storage.set("allmangaDubMode", value); }}>Audio: {dub === "sub" ? "Sub" : "Dub"}</button>}<span className={`playback-status playback-status--${phase}`} role="status">{labels[phase]}</span></div>
      {(message || phase === "error") && <div className="playback-notice" role={phase === "error" ? "alert" : "status"}>{message}<button className="btn btn-ghost" onClick={nextSource}>Try another server</button></div>}
      {resumeUnavailable && <div className="playback-notice">{requested.current > 0 ? "This server has not accepted the saved position. Your previous bookmark is preserved." : "This server could not restart at the beginning. Retry or use its timeline."}<button className="btn btn-secondary" onClick={() => { seekAttempts.current = 0; setResumeUnavailable(false); }}>Retry resume</button><button className="btn btn-ghost" onClick={() => { pendingSeek.current = null; requested.current = last.current?.currentTime || 0; setResumeUnavailable(false); persist(); }}>Continue from here</button></div>}
      <div className="player-wrap playback-screen">
        {url && !pip && <webview key={`${sourceId}:${attempt}:${dub}`} ref={webview} src={url} partition="persist:player" webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />}
        {(!url || pip) && <div className="playback-placeholder">{pip ? "Playing in the pop-out window" : phase === "error" ? "This source could not start" : "Preparing the player…"}</div>}
      </div>
      <div className="playback-secondary"><span>{snapshot ? `${formatTime(snapshot.currentTime)} / ${formatTime(snapshot.duration)}${confirmed.current ? ` · ${formatTime(snapshot.duration - snapshot.currentTime)} left` : ""}` : "Waiting for playback information from this server."}</span><div><button className="btn btn-ghost" disabled={!url || phase === "loading"} onClick={openPip}>{pip ? "Return to main player" : "Pop out"}</button><button className="btn btn-ghost" disabled={!streamUrl} title={streamUrl ? "Open detected stream in VLC or mpv" : "Available after a compatible stream is detected"} onClick={openExternal}>External player</button><button className="btn btn-ghost" onClick={() => recordedDownload ? onGoToDownloads?.(recordedDownload.id) : setDownloadOpen(true)}>{recordedDownload ? "View download" : "Download"}</button><button className="btn btn-ghost" onClick={() => blockStats.setShowModal(true)}>Blocked: {blockStats.sessionTotal}</button></div></div>
      {inIntro && storage.get("introSkipMode") === "manual" && <button className="btn btn-secondary" onClick={() => window.electron.playbackSeek(pipId.current || guestId.current, timings.intro.endTime)}>Skip intro</button>}
      {nextEpisode && <div className="playback-up-next"><div><span className="clean-eyebrow">UP NEXT</span><strong>{nextEpisode.name || `Episode ${nextEpisode.episode_number}`}</strong><small>{countdown !== null ? countdown > 0 ? `Starting in ${countdown}s` : "Ready when you are" : "Choose the next episode when you're ready."}</small></div><button className="btn btn-secondary" onClick={() => { persist(); callbacks.current.onNext?.(); }}>Play next episode</button>{countdown !== null && <button className="btn btn-ghost" onClick={() => setCountdown(null)}>Cancel autoplay</button>}</div>}
    </>}
    {pickerOpen && <ServerPicker current={sourceId} mediaKey={mediaKey} titleKey={titleKey} onSelect={changeSource} onClose={closePicker} />}
    {blockStats.showModal && <BlockedStatsModal sessionDomains={blockStats.getSessionDomains()} sessionTotal={blockStats.sessionTotal} alltimeTotal={blockStats.alltimeTotal} onClose={() => blockStats.setShowModal(false)} />}
    {downloadOpen && <DownloadModal onClose={() => setDownloadOpen(false)} m3u8Url={streamUrl} subtitles={subtitles} mediaName={`${title}${mediaType === "tv" ? ` S${season} E${episode}` : ""}`} downloaderFolder={downloaderFolder} setDownloaderFolder={(folder) => { setDownloaderFolder(folder); storage.set("downloaderFolder", folder); }} onOpenSettings={onSettings} onDownloadStarted={onDownloadStarted} mediaId={item.id} mediaType={mediaType} posterPath={item.poster_path} tmdbId={item.id} season={mediaType === "tv" ? season : undefined} episode={mediaType === "tv" ? episode : undefined} />}
  </section>;
}
