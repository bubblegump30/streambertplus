// Embed routes checked against provider documentation on 2026-11-10.
// Documentation is not playback acceptance; progress support stays off until tested.
export const ADDITIONAL_SOURCES = [
  {
    id: "vidsrc-mov", label: "vidsrc.mov", note: "Additional", params: {},
    movieUrl: (id) => `https://vidsrc.mov/embed/movie/${id}`,
    tvUrl: (id, season, ep) => `https://vidsrc.mov/embed/tv/${id}/${season}/${ep}`,
  },
  {
    id: "vidlink", label: "VidLink", note: "Additional", params: { autoplay: "false" },
    colorParam: "primaryColor",
    movieUrl: (id) => `https://vidlink.pro/movie/${id}`,
    tvUrl: (id, season, ep) => `https://vidlink.pro/tv/${id}/${season}/${ep}`,
  },
  {
    id: "multiembed", label: "MultiEmbed", note: "Additional", params: {},
    movieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl: (id, season, ep) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${ep}`,
  },
  {
    id: "embedwave", label: "EmbedWave", note: "Additional", params: {},
    movieUrl: (id) => `https://embedwave.cc/embed/movie/${id}`,
    tvUrl: (id, season, ep) => `https://embedwave.cc/embed/tv/${id}/${season}/${ep}`,
  },
  {
    id: "autoembed", label: "AutoEmbed", note: "Additional", params: {},
    movieUrl: (id) => `https://autoembed.me/movie/tmdb/${id}`,
    tvUrl: (id, season, ep) => `https://autoembed.me/tv/tmdb/${id}-${season}-${ep}`,
  },
  {
    id: "movietvapi", label: "MovieTV API", note: "Additional", params: {},
    movieUrl: (id) => `https://movietvapi.stream/embed/movie/${id}`,
    tvUrl: (id, season, ep) => `https://movietvapi.stream/embed/tv/${id}/${season}/${ep}`,
  },
];
