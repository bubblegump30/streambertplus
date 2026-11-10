import { imgUrl } from "../../utils/api";
import { BookmarkIcon, BookmarkFillIcon, BackIcon, StarIcon, FilmIcon, TrailerIcon } from "../Icons";

export default function MediaDetails({ item, mediaType, overview, cert, restricted, onSettings, isSaved, onSave, onBack, onTrailer, children }) {
  const title = item.title || item.name;
  return <section className="detail-hero"><div className="detail-bg" style={item.backdrop_path ? { backgroundImage: `url(${imgUrl(item.backdrop_path, "w1280")})` } : undefined} /><div className="detail-gradient" /><div className="detail-content">
    <div className="detail-poster">{item.poster_path ? <img src={imgUrl(item.poster_path)} alt="" /> : <div className="no-poster"><FilmIcon /></div>}</div>
    <div className="detail-info"><div className="detail-type">{mediaType === "tv" ? "Series" : "Movie"}</div><h1 className="detail-title">{title}</h1>
      <div className="detail-meta">{item.vote_average > 0 && <span className="detail-rating"><StarIcon />{item.vote_average.toFixed(1)}</span>}<span>{(item.release_date || item.first_air_date || "").slice(0, 4)}</span>{item.runtime > 0 && <span>{item.runtime} min</span>}{item.number_of_seasons > 0 && mediaType === "tv" && <span>{item.number_of_seasons} seasons</span>}{cert && <span>{cert}</span>}</div>
      <div className="genres">{item.genres?.map((genre) => <span className="genre-tag" key={genre.id}>{genre.name}</span>)}</div>
      <p className="detail-overview">{overview}</p>
      {restricted && <p className="playback-notice">Playback is restricted by your age-rating settings.<button className="btn btn-ghost" onClick={onSettings}>Open settings</button></p>}
      <div className="detail-actions">{children}<button className="btn btn-secondary" onClick={onSave}>{isSaved ? <BookmarkFillIcon /> : <BookmarkIcon />}{isSaved ? "Saved" : "Save"}</button>{onTrailer && <button className="btn btn-ghost" onClick={onTrailer}><TrailerIcon />Trailer</button>}<button className="btn btn-ghost" onClick={onBack}><BackIcon />Back</button></div>
    </div>
  </div></section>;
}
