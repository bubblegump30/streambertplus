import { useCallback, useEffect, useRef, useState } from "react";
import { imgUrl } from "../utils/api";
import { applyEpisodeMapping } from "../utils/episodeMappings";
import { clearBookmark, formatTime, readBookmark } from "../utils/playback";
import TrailerModal from "../components/TrailerModal";
import PlaybackPlayer from "../components/playback/PlaybackPlayer";
import MediaDetails from "../components/playback/MediaDetails";
import { useMediaInfo } from "../components/playback/useMediaInfo";
import { useSeriesCatalog } from "../components/playback/useSeriesCatalog";

const unreleased = (date) => !!date && new Date(`${date}T00:00:00`) > new Date();
export default function TVPage(props) {
  const { item, apiKey, onSave, isSaved, onHistory, progress = {}, saveProgress, onBack, onSettings, watched = {}, onMarkWatched, onMarkUnwatched } = props;
  const info = useMediaInfo(item, "tv", apiKey);
  const [selectedSeason, setSelectedSeason] = useState(() => Number(item.season ?? 1));
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const pendingEpisode = useRef(item.episode || null);
  const catalog = useSeriesCatalog(info.details, info.anime, selectedSeason, apiKey);
  const chooseEpisode = useCallback((episode) => {
    if (info.restricted || unreleased(episode.air_date)) return;
    setActiveEpisode(episode);
    onHistory?.({ ...info.details, media_type: "tv", season: selectedSeason, episode: episode.episode_number, episodeName: episode.name });
  }, [info.restricted, info.details, selectedSeason, onHistory]);
  useEffect(() => {
    setActiveEpisode(null); setSelectedSeason(Number(item.season ?? 1)); pendingEpisode.current = item.episode || null; setTrailerOpen(false);
  }, [item.id]);
  useEffect(() => {
    if (pendingEpisode.current && !catalog.loading) {
      const next = catalog.episodes.find((entry) => entry.episode_number === pendingEpisode.current);
      if (next) { pendingEpisode.current = null; chooseEpisode(next); }
    }
  }, [catalog.episodes, catalog.loading, chooseEpisode]);
  const changeSeason = (number) => { pendingEpisode.current = null; setActiveEpisode(null); setSelectedSeason(number); };
  const index = activeEpisode ? catalog.episodes.findIndex((entry) => entry.episode_number === activeEpisode.episode_number) : -1;
  const followingSeason = catalog.seasons.find((entry) => entry.season_number === selectedSeason + 1);
  const nextInSeason = index >= 0 ? catalog.episodes[index + 1] : null;
  const candidate = index >= 0 ? (nextInSeason ? { ...nextInSeason, displaySeason: selectedSeason } : null) || (followingSeason ? { id: `season_${followingSeason.season_number}`, season_number: followingSeason.season_number, displaySeason: followingSeason.season_number, episode_number: 1, name: `${followingSeason.name} · Episode 1`, air_date: followingSeason.air_date } : null) : null;
  const nextEpisode = candidate && !unreleased(candidate.air_date) ? candidate : null;
  const playNext = () => {
    if (!nextEpisode) return;
    const nextSeason = nextEpisode.displaySeason ?? selectedSeason;
    if (nextSeason !== selectedSeason) { setActiveEpisode(null); pendingEpisode.current = nextEpisode.episode_number; setSelectedSeason(nextSeason); }
    else chooseEpisode(nextEpisode);
  };
  const mediaKey = activeEpisode ? `tv_${item.id}_s${selectedSeason}e${activeEpisode.episode_number}` : null;
  const mapped = activeEpisode ? applyEpisodeMapping(item.id, activeEpisode._tmdbSeason ?? selectedSeason, activeEpisode._tmdbAbsolute ?? activeEpisode.episode_number, catalog.map) : null;
  return <div className="fade-in playback-detail-page">
    <MediaDetails item={info.details} mediaType="tv" overview={info.overview} cert={info.rating.cert} restricted={info.restricted} onSettings={onSettings} isSaved={isSaved} onSave={onSave} onBack={onBack} onTrailer={info.trailer ? () => setTrailerOpen(true) : null}>
      {activeEpisode && <button className="btn btn-ghost" onClick={() => setActiveEpisode(null)}>Close player</button>}
    </MediaDetails>
    {info.error && <p className="playback-notice">{info.error}</p>}
    {activeEpisode && !info.restricted && <><div className="playback-episode-heading"><strong>Season {selectedSeason} · Episode {activeEpisode.episode_number}</strong><span>{activeEpisode.name}</span><button className="btn btn-ghost" onClick={() => watched[mediaKey] ? onMarkUnwatched?.(mediaKey) : onMarkWatched?.(mediaKey)}>{watched[mediaKey] ? "Mark unwatched" : "Mark watched"}</button></div><PlaybackPlayer key={mediaKey} {...props} item={info.details} mediaType="tv" mediaKey={mediaKey} season={selectedSeason} episode={activeEpisode.episode_number} sourceSeason={mapped.season} sourceEpisode={mapped.episode} episodeName={activeEpisode.name} legacyPercent={progress[mediaKey] || 0} duration={(activeEpisode.runtime || info.details.episode_run_time?.[0] || 0) * 60} isAnime={info.isAnime} animeMalId={info.anime?.idMal} watched={!!watched[mediaKey]} nextEpisode={nextEpisode} onNext={playNext} /></>}
    <section className="section"><div className="discover-row-heading"><div><h2>Episodes</h2><p>Choose a season, then an episode.</p></div>{catalog.episodes.length > 0 && <button className="btn btn-ghost" onClick={() => catalog.episodes.forEach((entry) => { if (!unreleased(entry.air_date)) onMarkWatched?.(`tv_${item.id}_s${selectedSeason}e${entry.episode_number}`); })}>Mark season watched</button>}</div>
      <div className="season-selector" aria-label="Seasons">{catalog.seasons.map((entry) => <button key={entry.season_number} className={`season-btn${selectedSeason === entry.season_number ? " active" : ""}`} aria-pressed={selectedSeason === entry.season_number} onClick={() => changeSeason(entry.season_number)}>{entry.name || `Season ${entry.season_number}`}</button>)}</div>
      {catalog.loading && <p role="status">Loading episodes…</p>}{catalog.error && <div className="playback-notice" role="alert">{catalog.error}<button className="btn btn-secondary" onClick={catalog.retry}>Retry episodes</button></div>}
      {!catalog.loading && !catalog.error && !catalog.episodes.length && <p className="clean-empty-state">There are no episode details for this season yet.</p>}
      <div className="episodes-grid">{catalog.episodes.map((entry) => {
        const key = `tv_${item.id}_s${selectedSeason}e${entry.episode_number}`;
        const bookmark = readBookmark(key, progress[key] || 0, (entry.runtime || 0) * 60);
        const future = unreleased(entry.air_date);
        return <article className={`episode-card playback-episode-card${activeEpisode?.episode_number === entry.episode_number ? " is-playing" : ""}`} key={entry.id || entry.episode_number}>
          <button className="episode-open" onClick={() => chooseEpisode(entry)} disabled={info.restricted || future} aria-label={`Play episode ${entry.episode_number}: ${entry.name}`}>
            <div className="episode-thumb">{entry.still_path && <img src={imgUrl(entry.still_path, "w300")} alt="" loading="lazy" />}<span>{future ? "Coming soon" : watched[key] ? "Watched" : activeEpisode?.episode_number === entry.episode_number ? "Selected" : `Episode ${entry.episode_number}`}</span></div>
            <div className="episode-info"><h3 className="episode-name">{entry.name || `Episode ${entry.episode_number}`}</h3><p className="episode-desc">{entry.overview || "Episode details are not available yet."}</p>{bookmark.seconds > 0 && <small>Resume at {formatTime(bookmark.seconds)}{bookmark.duration > 0 ? ` · ${formatTime(Math.max(0, bookmark.duration - bookmark.seconds))} left` : ""}</small>}</div>
          </button>
          <div className="playback-episode-actions"><button className="btn btn-ghost" onClick={() => watched[key] ? onMarkUnwatched?.(key) : onMarkWatched?.(key)}>{watched[key] ? "Mark unwatched" : "Mark watched"}</button>{bookmark.seconds > 0 && <button className="btn btn-ghost" onClick={() => { clearBookmark(key); saveProgress?.(key, 0); onMarkUnwatched?.(key); }}>Clear progress</button>}</div>
        </article>;
      })}</div>
    </section>
    {trailerOpen && info.trailer && <TrailerModal trailerKey={info.trailer} title={info.details.name || info.details.title} onClose={() => setTrailerOpen(false)} />}
  </div>;
}
