import { useEffect, useMemo, useState } from "react";
import { buildAnilistSeasons, fetchEpisodeGroup, tmdbFetch } from "../../utils/api";
import { EPISODE_GROUP_IDS, buildEpisodeGroupMap } from "../../utils/episodeMappings";

export function useSeriesCatalog(details, anime, selectedSeason, apiKey) {
  const [group, setGroup] = useState(null);
  const [groupPending, setGroupPending] = useState(false);
  const [season, setSeason] = useState({ key: null, episodes: [], loading: true, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setGroup(null);
    const id = EPISODE_GROUP_IDS[Number(details.id)];
    setGroupPending(!!id);
    if (id) fetchEpisodeGroup(id, apiKey).then((data) => { if (active) setGroup(data); }).catch(() => {}).finally(() => { if (active) setGroupPending(false); });
    return () => { active = false; };
  }, [details.id, apiKey]);
  const tmdbSeasons = (details.seasons || []).filter((entry) => entry.season_number >= 0 && entry.episode_count !== 0);
  const virtual = useMemo(() => buildAnilistSeasons(anime), [anime]);
  const useVirtual = !!(virtual?.length > 1 && tmdbSeasons.filter((entry) => entry.season_number > 0).length <= 1 && virtual.every((entry) => entry.episodes > 0));
  const groups = useMemo(() => group?.groups?.slice().sort((a, b) => a.order - b.order), [group]);
  const seasons = groups ? groups.map((entry, index) => ({ season_number: index + 1, name: entry.name || `Season ${index + 1}`, episode_count: entry.episodes?.length || 0 }))
    : useVirtual ? virtual.map((entry) => ({ season_number: entry.seasonNum, name: entry.title || `Season ${entry.seasonNum}`, episode_count: entry.episodes })) : tmdbSeasons;
  const tmdbSeason = useVirtual ? 1 : selectedSeason;
  const key = `${details.id}_${tmdbSeason}`;
  useEffect(() => {
    if (!apiKey || groupPending || groups) return;
    let active = true;
    setSeason({ key, episodes: [], loading: true, error: null });
    tmdbFetch(`/tv/${details.id}/season/${tmdbSeason}`, apiKey).then((data) => { if (active) setSeason({ key, episodes: data.episodes || [], loading: false, error: null }); })
      .catch(() => { if (active) setSeason({ key, episodes: [], loading: false, error: "Episode information could not be loaded. Try again." }); });
    return () => { active = false; };
  }, [details.id, tmdbSeason, apiKey, key, groupPending, groups, retry]);
  const episodes = useMemo(() => {
    if (groupPending) return [];
    if (groups) return (groups[selectedSeason - 1]?.episodes || []).slice().sort((a, b) => a.order - b.order).map((entry, index) => ({ ...entry, episode_number: index + 1, _tmdbSeason: entry.season_number, _tmdbAbsolute: entry.episode_number }));
    if (season.key !== key) return [];
    if (!useVirtual) return season.episodes;
    const offset = virtual.filter((entry) => entry.seasonNum < selectedSeason).reduce((sum, entry) => sum + entry.episodes, 0);
    const count = virtual.find((entry) => entry.seasonNum === selectedSeason)?.episodes || 0;
    return season.episodes.slice(offset, offset + count).map((entry, index) => ({ ...entry, episode_number: index + 1, _tmdbAbsolute: entry.episode_number, _tmdbSeason: 1 }));
  }, [groups, groupPending, selectedSeason, season, key, useVirtual, virtual]);
  return { seasons, episodes, map: useMemo(() => buildEpisodeGroupMap(group), [group]), loading: groupPending || (!groups && (season.key !== key || season.loading)), error: groups ? null : season.error, retry: () => setRetry((value) => value + 1) };
}
