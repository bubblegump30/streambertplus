import { memo, useEffect, useRef, useState } from "react";
import { imgUrl, isAnimeContent } from "../utils/api";
import { PlayIcon, FilmIcon, TVIcon, WatchedIcon } from "./Icons";

const MediaCard = memo(function MediaCard({ item, onClick, progress = 0, watched, onMarkWatched, onMarkUnwatched, ageRating, restricted }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const menuRef = useRef(null);
  const title = item.title || item.name || "Untitled";
  const isTV = item.media_type === "tv";
  const hasEpisode = item.season != null && item.episode != null;
  const key = isTV ? (hasEpisode ? `tv_${item.id}_s${item.season}e${item.episode}` : `tv_${item.id}`) : `movie_${item.id}`;
  const isWatched = !!watched?.[key];
  const date = item.release_date || item.first_air_date;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = !!date && new Date(`${date}T00:00:00`) > today;
  const canMark = !upcoming && (!isTV || hasEpisode) && !!(onMarkWatched || onMarkUnwatched);
  useEffect(() => setImageFailed(false), [item.poster_path]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => { if (event.type === "keydown" ? event.key === "Escape" : !menuRef.current?.contains(event.target)) setMenuOpen(false); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", close); };
  }, [menuOpen]);
  const metadata = hasEpisode ? `S${item.season} · E${item.episode}` : `${date?.slice(0, 4) || "Year unavailable"} · ${isTV ? "TV show" : "Movie"}`;
  return (
    <article className={`card clean-card${isWatched ? " ep-watched" : ""}${upcoming ? " card--unreleased" : ""}`}>
      <button className="clean-card-open" onClick={onClick} aria-label={`Open ${title}`} onContextMenu={(event) => { if (canMark) { event.preventDefault(); setMenuOpen(true); } }}>
        <div className="card-poster">
          {item.poster_path && !imageFailed ? <img src={imgUrl(item.poster_path, "w342")} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <div className="no-poster">{isTV ? <TVIcon /> : <FilmIcon />}<span>{title}</span></div>}
          <span className="clean-card-type">{upcoming ? "Coming soon" : isAnimeContent(item) ? "Anime" : isTV ? "Series" : "Movie"}</span>
          {ageRating && <span className={`clean-card-rating${restricted ? " is-restricted" : ""}`}>{restricted ? "Restricted · " : ""}{ageRating}</span>}
          <div className="card-overlay"><span className="card-play"><PlayIcon /></span></div>
          {isWatched && <span className="card-watched-badge"><WatchedIcon size={22} /></span>}
          {!isWatched && progress > 0 && <div className="card-progress"><div className="card-progress-fill" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} /></div>}
        </div>
        <div className="card-info"><h3 className="card-title" title={title}>{title}</h3><p className="card-year">{metadata}</p></div>
      </button>
      {canMark && <div className="clean-card-options" ref={menuRef}>
        <button className="clean-card-menu-button" aria-label={`Options for ${title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>•••</button>
        {menuOpen && <div className="clean-card-menu"><button onClick={() => { (isWatched ? onMarkUnwatched : onMarkWatched)?.(key); setMenuOpen(false); }}>{isWatched ? "Mark unwatched" : "Mark watched"}</button></div>}
      </div>}
    </article>
  );
});
export default MediaCard;
