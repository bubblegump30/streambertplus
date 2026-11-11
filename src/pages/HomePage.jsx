import { useEffect, useMemo, useState } from "react";
import MediaCard from "../components/MediaCard";
import { PlayIcon, StarIcon, SearchIcon } from "../components/Icons";
import { imgUrl, tmdbFetch } from "../utils/api";
import { useRatings, getRatingForItem } from "../utils/useRatings";
import { isRestricted } from "../utils/ageRating";
import { loadHomeLayout, loadHomeViewMode, loadDiscoverStartTab } from "../utils/homeLayout";

const typed = (items, type) => (items || []).map((item) => ({ ...item, media_type: type }));
const unique = (items) => [...new Map(items.map((item) => [`${item.media_type}_${item.id}`, item])).values()];

export default function HomePage({ trending = [], trendingTV = [], loading, onSelect, progress = {}, inProgress = [],
  offline, onRetry, watched, onMarkWatched, onMarkUnwatched, history = [], apiKey }) {
  const [filter, setFilter] = useState(loadDiscoverStartTab);
  const [query, setQuery] = useState("");
  const [extras, setExtras] = useState({ recommended: [], topRated: [] });
  const [layout] = useState(loadHomeLayout);
  const [viewMode] = useState(loadHomeViewMode);
  const movies = useMemo(() => typed(trending, "movie"), [trending]);
  const shows = useMemo(() => typed(trendingTV, "tv"), [trendingTV]);
  useEffect(() => {
    let active = true;
    if (!apiKey || offline) { setExtras({ recommended: [], topRated: [] }); return; }
    const watchedIds = new Set(history.map((item) => `${item.media_type || "movie"}_${item.id}`));
    const recent = unique(history.filter((item) => item.watchedAt > Date.now() - 30 * 86400000)
      .slice().sort((a, b) => b.watchedAt - a.watchedAt).map((item) => ({ ...item, media_type: item.media_type || "movie" }))).slice(0, 5);
    const recommendations = recent.map(async (item) => {
      const type = item.media_type === "tv" ? "tv" : "movie";
      try {
        let data = await tmdbFetch(`/${type}/${item.id}/recommendations`, apiKey);
        if (!data.results?.length) data = await tmdbFetch(`/${type}/${item.id}/similar`, apiKey);
        return typed(data.results, type);
      } catch { return []; }
    });
    Promise.all(recommendations).then((groups) => {
      if (!active) return;
      const mixed = [];
      for (let i = 0; i < Math.max(0, ...groups.map((group) => group.length)); i++) for (const group of groups) if (group[i]) mixed.push(group[i]);
      setExtras((prev) => ({ ...prev, recommended: unique(mixed).filter((item) => !watchedIds.has(`${item.media_type}_${item.id}`)).slice(0, 20) }));
    });
    Promise.all([tmdbFetch("/movie/top_rated?page=1", apiKey), tmdbFetch("/tv/top_rated?page=1", apiKey)])
      .then(([movieData, showData]) => { if (active) setExtras((prev) => ({ ...prev, topRated: unique([...typed(movieData.results, "movie").slice(0, 8), ...typed(showData.results, "tv").slice(0, 8)]).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)) })); })
      .catch(() => { if (active) setExtras((prev) => ({ ...prev, topRated: [] })); });
    return () => { active = false; };
  }, [apiKey, offline, history]);
  const allItems = useMemo(() => unique([...movies, ...shows, ...inProgress, ...extras.recommended, ...extras.topRated]), [movies, shows, inProgress, extras]);
  const { ratingsMap, ageLimitSetting } = useRatings(allItems);
  const allowed = (item) => !isRestricted(getRatingForItem(item, ratingsMap).minAge, ageLimitSetting);
  const matches = (item) => (filter === "all" || item.media_type === filter) && (item.title || item.name || "").toLowerCase().includes(query.trim().toLowerCase());
  const hero = [...movies, ...shows].find((item) => allowed(item) && (filter === "all" || item.media_type === filter));
  const results = allItems.filter((item) => matches(item) && allowed(item));
  const rows = {
    continue: { label: "Pick up where you left off", note: "Continue watching", items: inProgress },
    recommended: { label: "Made for your watchlist", note: "Based on your recent viewing", items: extras.recommended.filter(allowed) },
    trendingMovies: { label: "Movies worth a look", note: "Trending this week", items: movies },
    trendingTV: { label: "Your next series", note: "Trending TV shows", items: shows },
    topRated: { label: "Highly rated", note: "Audience favorites", items: extras.topRated },
  };
  const card = (item) => {
    const rating = getRatingForItem(item, ratingsMap);
    const progressKey = item.media_type === "tv" ? `tv_${item.id}_s${item.season}e${item.episode}` : `movie_${item.id}`;
    return <MediaCard key={`${item.media_type}_${item.id}_${item.season || ""}_${item.episode || ""}`} item={item} onClick={() => onSelect(item)} progress={progress[progressKey] || 0}
      watched={watched} onMarkWatched={onMarkWatched} onMarkUnwatched={onMarkUnwatched} ageRating={rating.cert} restricted={isRestricted(rating.minAge, ageLimitSetting)} />;
  };
  return (
    <main className="discover-page">
      <header className="discover-header"><div><span className="clean-eyebrow">YOUR NEXT GOOD WATCH</span><h1>Discover</h1><p>Less searching. More watching.</p></div>
        <label className="discover-filter-search"><SearchIcon /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this collection" aria-label="Filter this collection" /></label>
      </header>
      <div className="discover-toolbar"><div className="discover-tabs" role="group" aria-label="Content type">
        {[["all", "For you"], ["movie", "Movies"], ["tv", "TV shows"]].map(([id, label]) => <button key={id} aria-pressed={filter === id} className={filter === id ? "is-selected" : ""} onClick={() => setFilter(id)}>{label}</button>)}
      </div><span className="discover-toolbar-note">Your library, your pace.</span></div>
      {offline && <div className="clean-empty-state"><h2>You're offline</h2><p>Your library and downloaded videos are still available from the sidebar.</p><button className="btn btn-secondary" onClick={onRetry}>Try connecting again</button></div>}
      {!offline && loading && <div className="discover-skeleton" aria-label="Loading your collection" aria-busy="true"><div /><div /><div /></div>}
      {!loading && !offline && !query.trim() && hero && <section className="discover-feature" aria-label="Featured title">
        {hero.backdrop_path && <img className="discover-feature-image" src={imgUrl(hero.backdrop_path, "w1280")} alt="" />}
        <div className="discover-feature-shade" /><div className="discover-feature-copy"><span className="clean-eyebrow">IN THE SPOTLIGHT · {hero.media_type === "tv" ? "TV SHOW" : "MOVIE"}</span>
          <h2>{hero.title || hero.name}</h2><div className="discover-feature-meta">{hero.vote_average > 0 && <span><StarIcon /> {hero.vote_average.toFixed(1)}</span>}<span>{(hero.release_date || hero.first_air_date || "").slice(0, 4)}</span><span>{hero.media_type === "tv" ? "TV show" : "Movie"}</span></div>
          <p>{hero.overview || "Find your next favorite and choose a streaming source when you're ready."}</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => onSelect(hero)}><PlayIcon /> {hero.media_type === "tv" ? "Explore episodes" : "View movie"}</button></div>
        </div>{hero.poster_path && <img className="discover-feature-poster" src={imgUrl(hero.poster_path, "w342")} alt="" />}
      </section>}
      {query.trim() ? <section className="discover-collection"><div className="discover-row-heading"><div><h2>Collection results</h2><p>{results.length} matching {results.length === 1 ? "title" : "titles"}. Use Search everything for the full catalog.</p></div></div><div className="clean-card-grid">{results.map(card)}</div>{!results.length && <p className="clean-empty-state">No matches here. Try a different title or the main search.</p>}</section> : layout.order.map((id) => {
        const row = rows[id]; if (!row || !layout.visible[id]) return null;
        const items = row.items.filter(matches); if (!items.length) return null;
        return <section className="discover-collection" key={id}><div className="discover-row-heading"><div><h2>{row.label}</h2><p>{row.note}</p></div><span>{items.length} titles</span></div><div className={viewMode === "list" || id === "continue" ? "clean-card-grid" : "clean-card-shelf"}>{items.map(card)}</div></section>;
      })}
      {!offline && !loading && !allItems.length && <div className="clean-empty-state"><h2>Your next favorite is waiting</h2><p>Add your TMDB token in Settings to browse movies and TV shows, or open your library and downloads.</p></div>}
      <footer className="discover-footer">Refreshed by Kyle Austin Hillier</footer>
    </main>
  );
}

