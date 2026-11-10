import { useEffect, useRef, useState } from "react";
import { orderedSources, getFavorites, setFavorites, lastSuccessfulSource } from "../../utils/playback";

export default function ServerPicker({ current, mediaKey, titleKey, onSelect, onClose }) {
  const [favorites, updateFavorites] = useState(getFavorites);
  const dialog = useRef(null);
  const last = lastSuccessfulSource(mediaKey) || lastSuccessfulSource(titleKey);
  useEffect(() => {
    const before = document.activeElement;
    dialog.current?.querySelector("button")?.focus();
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const buttons = [...dialog.current.querySelectorAll("button:not(:disabled)")];
      const first = buttons[0], final = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); final?.focus(); }
      else if (!event.shiftKey && document.activeElement === final) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener("keydown", keydown); if (before?.isConnected) before.focus(); };
  }, [onClose]);
  const save = (next) => { setFavorites(next); updateFavorites(next); };
  const move = (id, offset) => {
    const next = [...favorites], from = next.indexOf(id), to = from + offset;
    if (to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]]; save(next);
  };
  return <div className="playback-modal-backdrop" onClick={onClose}>
    <section className="playback-server-dialog" role="dialog" aria-modal="true" aria-labelledby="server-dialog-title" ref={dialog} onClick={(event) => event.stopPropagation()}>
      <header><div><h2 id="server-dialog-title">Choose a server</h2><p>Star your favorites. Move them into your preferred order.</p></div><button onClick={onClose} aria-label="Close server picker">×</button></header>
      <div className="playback-server-grid">{orderedSources(favorites, true).map((source) => {
        const favoriteIndex = favorites.indexOf(source.id), unavailable = source.available === false;
        return <div className={`playback-server-card${current === source.id ? " is-current" : ""}`} key={source.id}>
          <button className="source-dropdown__item playback-server-select" disabled={unavailable} title={source.unavailableReason || source.label} aria-pressed={current === source.id} onClick={() => onSelect(source.id)}>
            <strong>{source.label}{unavailable ? " · Unavailable" : ""}</strong>
            <small>{unavailable ? source.unavailableReason : last === source.id ? "Last observed playing" : source.async ? "Anime resolver" : "Embedded player"}</small>
          </button>
          <div className="playback-server-options">
            {(!unavailable || favoriteIndex >= 0) && <button aria-label={`Favorite ${source.label}`} aria-pressed={favoriteIndex >= 0} onClick={() => save(favoriteIndex >= 0 ? favorites.filter((id) => id !== source.id) : [...favorites, source.id])}>{favoriteIndex >= 0 ? "★ Favorited" : "☆ Favorite"}</button>}
            {!unavailable && favoriteIndex >= 0 && <><button aria-label={`Move ${source.label} up`} disabled={favoriteIndex === 0} onClick={() => move(source.id, -1)}>↑</button><button aria-label={`Move ${source.label} down`} disabled={favoriteIndex === favorites.length - 1} onClick={() => move(source.id, 1)}>↓</button></>}
          </div>
        </div>;
      })}</div>
      <p className="playback-dialog-note">Availability varies by title and provider. Retired providers are skipped automatically. A loaded page does not confirm playback; sources are remembered as successful only after an observable video clock advances.</p>
    </section>
  </div>;
}

