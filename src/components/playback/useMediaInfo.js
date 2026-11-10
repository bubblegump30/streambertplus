import { useEffect, useState } from "react";
import { tmdbFetch, isAnimeContent, fetchAnilistData, cleanAnilistDescription } from "../../utils/api";
import { fetchMovieRating, fetchTVRating, getAgeLimitSetting, getRatingCountry, isRestricted } from "../../utils/ageRating";
import { storage } from "../../utils/storage";

export function useMediaInfo(item, type, apiKey) {
  const [state, setState] = useState({ details: item, trailer: null, anime: null, rating: { cert: null, minAge: null }, error: null });
  useEffect(() => {
    let active = true;
    setState({ details: item, trailer: null, anime: null, rating: { cert: null, minAge: null }, error: null });
    tmdbFetch(`/${type}/${item.id}`, apiKey).then(async (details) => {
      if (!active) return;
      setState((prev) => ({ ...prev, details }));
      if (isAnimeContent(item, details)) {
        const anime = await fetchAnilistData(details.title || details.name, "ANIME", item.id);
        if (active) setState((prev) => ({ ...prev, anime }));
      }
    }).catch(() => { if (active) setState((prev) => ({ ...prev, error: "Some title details could not be refreshed. You can retry by reopening this title." })); });
    tmdbFetch(`/${type}/${item.id}/videos`, apiKey).then((data) => {
      const trailer = data.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")?.key;
      if (active) setState((prev) => ({ ...prev, trailer }));
    }).catch(() => {});
    (type === "tv" ? fetchTVRating : fetchMovieRating)(item.id, apiKey, getRatingCountry(storage))
      .then((rating) => { if (active) setState((prev) => ({ ...prev, rating })); }).catch(() => {});
    return () => { active = false; };
  }, [item.id, type, apiKey]);
  const anime = isAnimeContent(item, state.details);
  const overview = anime && state.anime?.description ? cleanAnilistDescription(state.anime.description) : state.details.overview;
  const restricted = isRestricted(state.rating.minAge, getAgeLimitSetting(storage));
  return { ...state, isAnime: anime, overview, restricted };
}
