import { useEffect, useState } from "react";
import { tmdbFetch } from "../utils/api";
import { clearBookmark, formatTime, readBookmark } from "../utils/playback";
import { PlayIcon } from "../components/Icons";
import MediaCard from "../components/MediaCard";
import TrailerModal from "../components/TrailerModal";
import PlaybackPlayer from "../components/playback/PlaybackPlayer";
import MediaDetails from "../components/playback/MediaDetails";
import { useMediaInfo } from "../components/playback/useMediaInfo";

export default function MoviePage(props) {
  const { item, apiKey, onSave, isSaved, onHistory, progress = {}, saveProgress, onBack, onSettings, watched = {}, onMarkWatched, onMarkUnwatched, onSelect } = props;
  const info = useMediaInfo(item, "movie", apiKey);
  const [playing, setPlaying] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [collection, setCollection] = useState(null);
  const key = `movie_${item.id}`;
  const bookmark = readBookmark(key, progress[key], (info.details.runtime || 0) * 60);
  const unreleased = info.details.release_date && new Date(`${info.details.release_date}T00:00:00`) > new Date();
  useEffect(() => { setPlaying(false); setTrailerOpen(false); }, [item.id]);
  useEffect(() => {
    let active = true;
    setCollection(null);
    if (info.details.belongs_to_collection?.id) tmdbFetch(`/collection/${info.details.belongs_to_collection.id}`, apiKey).then((value) => { if (active) setCollection(value); }).catch(() => {});
    return () => { active = false; };
  }, [info.details.belongs_to_collection?.id, apiKey]);
  const play = () => {
    if (info.restricted || unreleased) return;
    setPlaying(true); onHistory?.({ ...info.details, media_type: "movie" });
  };
  return <div className="fade-in playback-detail-page">
    <MediaDetails item={info.details} mediaType="movie" overview={info.overview} cert={info.rating.cert} restricted={info.restricted} onSettings={onSettings} isSaved={isSaved} onSave={onSave} onBack={onBack} onTrailer={info.trailer ? () => setTrailerOpen(true) : null}>
      <button className="btn btn-primary" onClick={playing ? () => setPlaying(false) : play} disabled={info.restricted || !!unreleased}><PlayIcon />{unreleased ? "Coming soon" : playing ? "Close player" : bookmark.seconds > 10 && bookmark.percent < 98 ? `Resume · ${formatTime(bookmark.seconds)}` : "Play"}</button>
      <button className="btn btn-ghost" onClick={() => watched[key] ? onMarkUnwatched?.(key) : onMarkWatched?.(key)}>{watched[key] ? "Mark unwatched" : "Mark watched"}</button>
      {!playing && bookmark.seconds > 0 && <button className="btn btn-ghost" onClick={() => { clearBookmark(key); saveProgress?.(key, 0); onMarkUnwatched?.(key); }}>Clear progress</button>}
    </MediaDetails>
    {info.error && <p className="playback-notice">{info.error}</p>}
    {playing && !info.restricted && <PlaybackPlayer key={key} {...props} item={info.details} mediaType="movie" mediaKey={key} legacyPercent={progress[key] || 0} duration={(info.details.runtime || 0) * 60} isAnime={info.isAnime} animeMalId={info.anime?.idMal} watched={!!watched[key]} />}
    {collection?.parts?.length > 1 && <section className="section"><h2 className="section-title">{collection.name}</h2><div className="clean-card-shelf">{collection.parts.slice().sort((a, b) => (a.release_date || "").localeCompare(b.release_date || "")).map((part) => <MediaCard key={part.id} item={{ ...part, media_type: "movie" }} onClick={() => onSelect?.({ ...part, media_type: "movie" })} progress={progress[`movie_${part.id}`] || 0} watched={watched} onMarkWatched={onMarkWatched} onMarkUnwatched={onMarkUnwatched} />)}</div></section>}
    {trailerOpen && info.trailer && <TrailerModal trailerKey={info.trailer} title={info.details.title || info.details.name} onClose={() => setTrailerOpen(false)} />}
  </div>;
}
