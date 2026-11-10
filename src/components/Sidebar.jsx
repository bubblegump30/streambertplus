import { useRef, useState } from "react";
import { imgUrl } from "../utils/api";
import { PlayIcon, HomeIcon, SearchIcon, HistoryIcon, SettingsIcon, DownloadsQueueIcon, BackIcon, HelpIcon } from "./Icons";

export default function Sidebar({ page, onNavigate, onSearch, savedList = [], activeDownloads = 0,
  onReorderSaved, onRemoveSaved, canGoBack, onBack, onShowShortcuts }) {
  const dragging = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);
  const moveSaved = (from, to) => {
    if (from === null || from === to || to < 0 || to >= savedList.length) return;
    const next = [...savedList];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onReorderSaved?.(next.map((item) => `${item.media_type}_${item.id}`));
  };
  const links = [
    { id: "home", label: "Discover", icon: <HomeIcon /> },
    { id: "history", label: "My library", icon: <HistoryIcon /> },
    { id: "downloads", label: "Downloads", icon: <DownloadsQueueIcon />, count: activeDownloads },
  ];
  return (
    <aside className="sidebar clean-sidebar" aria-label="Main navigation">
      <button className="clean-brand" onClick={() => onNavigate("home")} aria-label="Streambert Plus home">
        <span className="clean-brand-icon"><PlayIcon /></span>
        <span className="clean-brand-copy">Streambert<span>PLUS</span></span>
      </button>
      <button className="clean-search" onClick={onSearch}><SearchIcon /><span>Search titles</span><kbd>Ctrl F</kbd></button>
      <nav className="clean-nav" aria-label="Browse">
        {links.map(({ id, label, icon, count }) => (
          <button key={id} className={`clean-nav-link${page === id ? " is-current" : ""}`} aria-current={page === id ? "page" : undefined} onClick={() => onNavigate(id)}>
            {icon}<span>{label}</span>{count > 0 && <span className="clean-nav-count">{count}</span>}
          </button>
        ))}
        {canGoBack && <button className="clean-nav-link clean-back" onClick={onBack}><BackIcon /><span>Go back</span></button>}
      </nav>
      <section className="clean-saved" aria-label="Saved titles">
        <div className="clean-sidebar-heading"><span>YOUR WATCHLIST</span><span>{savedList.length}</span></div>
        <div className="clean-saved-list">
          {savedList.length === 0 && <p className="clean-saved-empty">Save a movie or show.<br />Find it here when you're ready.</p>}
          {savedList.map((item, index) => {
            const title = item.title || item.name;
            return (
              <div key={`${item.media_type}_${item.id}`} className={`clean-saved-row${dropTarget === index ? " is-drop-target" : ""}`} draggable
                onDragStart={(event) => { dragging.current = index; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }}
                onDragOver={(event) => { event.preventDefault(); setDropTarget(index); }}
                onDrop={(event) => { event.preventDefault(); moveSaved(dragging.current, index); dragging.current = null; setDropTarget(null); }}
                onDragEnd={() => { dragging.current = null; setDropTarget(null); }}>
                <button className="clean-saved-open" onClick={() => onNavigate(item.media_type === "tv" ? "tv" : "movie", item)} title={title}>
                  {item.poster_path ? <img src={imgUrl(item.poster_path, "w92")} alt="" loading="lazy" /> : <span className="clean-saved-placeholder"><PlayIcon /></span>}
                  <span><strong>{title}</strong><small>{item.media_type === "tv" ? "TV show" : "Movie"}</small></span>
                </button>
                <div className="clean-saved-actions">
                  <button aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => moveSaved(index, index - 1)}>↑</button>
                  <button aria-label={`Move ${title} down`} disabled={index === savedList.length - 1} onClick={() => moveSaved(index, index + 1)}>↓</button>
                  <button aria-label={`Remove ${title} from watchlist`} onClick={() => onRemoveSaved?.(item)}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="clean-sidebar-footer">
        <p className="clean-refresh-credit">Refreshed by Kyle Austin Hillier</p>
        <button className={`clean-nav-link${page === "settings" ? " is-current" : ""}`} aria-current={page === "settings" ? "page" : undefined} onClick={() => onNavigate("settings")}><SettingsIcon /><span>Settings & themes</span></button>
        <button className="clean-nav-link" onClick={onShowShortcuts}><HelpIcon /><span>Help & shortcuts</span></button>
      </div>
    </aside>
  );
}
