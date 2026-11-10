import { storage } from "./storage";
import { PLAYER_SOURCES, ANIME_DEFAULT_SOURCE, NON_ANIME_DEFAULT_SOURCE } from "./api";

const IDS = new Set(PLAYER_SOURCES.map((source) => source.id));
const BOOKMARKS = "playbackBookmarks";
const SUCCESS = "playbackSuccessfulSources";
const FAVORITES = "playbackFavorites";
const readRecords = (key) => { const value = storage.get(key); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; };
const bounded = (records, limit = 300) => Object.fromEntries(Object.entries(records).sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0)).slice(0, limit));
export const formatTime = (value) => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
export function getFavorites() {
  const raw = storage.get(FAVORITES);
  return Array.isArray(raw) ? [...new Set(raw.filter((id) => IDS.has(id)))] : [];
}
export function setFavorites(ids) {
  storage.set(FAVORITES, [...new Set(ids.filter((id) => IDS.has(id)))]);
}
export function orderedSources(favorites = getFavorites(), includeUnavailable = false) {
  const byId = new Map(PLAYER_SOURCES.map((source) => [source.id, source]));
  const ordered = [...favorites.map((id) => byId.get(id)).filter(Boolean), ...PLAYER_SOURCES.filter((source) => !favorites.includes(source.id))];
  const active = ordered.filter((source) => source.available !== false);
  return includeUnavailable ? [...active, ...ordered.filter((source) => source.available === false)] : active;
}
export function preferredSource(mediaKey, titleKey, anime = false) {
  const successes = readRecords(SUCCESS);
  const supported = (id) => IDS.has(id) && PLAYER_SOURCES.find((source) => source.id === id)?.available !== false && (anime || !PLAYER_SOURCES.find((source) => source.id === id)?.async);
  const candidates = [successes[mediaKey]?.sourceId, successes[titleKey]?.sourceId, ...getFavorites(), anime ? ANIME_DEFAULT_SOURCE : storage.get("playerSource"), NON_ANIME_DEFAULT_SOURCE];
  return candidates.find(supported) || NON_ANIME_DEFAULT_SOURCE;
}
export function readBookmark(key, legacyPercent = 0, duration = 0) {
  const record = (readRecords(BOOKMARKS))[key];
  if (record && Number.isFinite(record.seconds) && record.seconds >= 0 && Number.isFinite(record.duration) && record.duration > 0) return record;
  const rawSeconds = Number(storage.get(`dlTime_${key}`));
  const rawPercent = Number(legacyPercent);
  const seconds = Number.isFinite(rawSeconds) && rawSeconds > 0 ? rawSeconds : Number.isFinite(rawPercent) && duration > 0 ? duration * Math.min(100, Math.max(0, rawPercent)) / 100 : 0;
  return { seconds, duration, percent: Number.isFinite(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : 0 };
}
export function saveBookmark(key, snapshot) {
  if (!validSnapshot(snapshot)) return false;
  const records = readRecords(BOOKMARKS);
  records[key] = { seconds: snapshot.currentTime, duration: snapshot.duration, percent: Math.min(100, snapshot.currentTime / snapshot.duration * 100), updatedAt: Date.now() };
  storage.set(BOOKMARKS, bounded(records));
  storage.set(`dlTime_${key}`, Math.floor(snapshot.currentTime));
  return true;
}
export function clearBookmark(key) {
  const records = readRecords(BOOKMARKS);
  delete records[key];
  storage.set(BOOKMARKS, records);
  storage.set(`dlTime_${key}`, 0);
}
export function validSnapshot(snapshot) {
  return !!snapshot && Number.isFinite(snapshot.currentTime) && snapshot.currentTime >= 0 && Number.isFinite(snapshot.duration) && snapshot.duration > 0 && snapshot.currentTime <= snapshot.duration + 1 && !snapshot.errorCode;
}
// Page events and static video elements are never sufficient playback evidence.
export function clockAdvanced(previous, current) {
  if (!validSnapshot(previous) || !validSnapshot(current) || current.paused || current.readyState < 2) return false;
  const delta = current.currentTime - previous.currentTime;
  return delta > 0.2 && delta < 10 && Math.abs(current.duration - previous.duration) < 2;
}
export function rememberSuccessfulSource(mediaKey, titleKey, sourceId, previous, current) {
  if (!IDS.has(sourceId) || !clockAdvanced(previous, current)) return false;
  const records = readRecords(SUCCESS);
  const value = { sourceId, updatedAt: Date.now() };
  records[mediaKey] = value; records[titleKey] = value;
  storage.set(SUCCESS, bounded(records));
  return true;
}
export const lastSuccessfulSource = (key) => (readRecords(SUCCESS))[key]?.sourceId || null;

