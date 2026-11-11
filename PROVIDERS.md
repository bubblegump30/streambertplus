# Provider integration record

Checked November 10, 2026. A documented URL is not proof that a title plays.

## Preserved from supplied Streambert 2.6.0
- Videasy: https://player.videasy.to
- VidSrc: https://vsembed.su
- Vidking: https://www.vidking.net
- AllManga (anime resolver): https://allmanga.to

## Additional sources: documented routes, playback unverified
- vidsrc.mov: https://vidsrc.mov/ -- /embed/movie/{id}, /embed/tv/{id}/{season}/{episode}
- VidLink: https://vidlink.pro/ -- /movie/{tmdbId}, /tv/{tmdbId}/{season}/{episode}
- MultiEmbed: https://superembed.stream/ -- https://multiembed.mov/?video_id={id}&tmdb=1 ; TV adds &s={season}&e={episode}
- EmbedWave: https://embedwave.cc/docs -- /embed/movie/{id}, /embed/tv/{id}/{season}/{episode}
- AutoEmbed: https://autoembed.me/ -- /movie/tmdb/{id}, /tv/tmdb/{id}-{season}-{episode}
- MovieTV API: https://movietvapi.stream/docs -- /embed/movie/{id}, /embed/tv/{id}/{season}/{episode}

These additional adapters are TMDB-based and have watch-progress support off until tested. Anime behavior is retained. Videasy and Vidking are retired as described below; active sources remain selectable.

## Design reference
User supplied screenshot Screenshot 2026-11-10 051832.png and https://flixseries.cyou/ . The website could not be retrieved using the web tool; the screenshot guided the charcoal, rounded server-button grid and bright active selection. No page instructions were followed. No paid/VIP behavior is implied or implemented.


## 2.8.2 availability and redirect investigation

Videasy's official homepage (https://www.videasy.to/) announces closure of Videasy and its Vidking mirror on September 15, 2026. On November 10, local endpoint probes encountered a TLS verification failure for player.videasy.to and DNS failures for www.vidking.net. No TLS checks are disabled. These source records remain visible as unavailable and are not automatically selected.

Movie and TV HTTP probes found MultiEmbed redirecting from https://multiembed.mov to https://streamingnow.mov. Only this exact HTTPS origin pair is allowed for server redirects. Links, popups, lookalike domains and arbitrary redirect destinations remain blocked.

VidSrc (vsembed.su), vidsrc.mov and MovieTV API returned player HTML in initial probes. Isolated Electron inspection loaded VidSrc's nested stellarconductornexus.com player. vidsrc.mov itself frames vidsrc.sh, which loads the same nested player; these are not independent backends. MovieTV API loaded its own player shell. Real verification challenges are left untouched. HTTP/page results are not playback proof.


Short live follow-up: after Play, all three named active providers reached playing movie samples. Both vidsrc.mov and MovieTV API showed two advancing TV samples; VidSrc TV began playing late in the observation window. This narrows the earlier page-only uncertainty for those sample IDs, but does not guarantee other titles, longer sessions or every internal server.


## 2.8.3 EmbedWave backend

EmbedWave's documented server=cinesrc option (https://embedwave.cc/docs) is now pinned by default for movie and TV routes. Its internal server menu remains available. In isolated short checks on November 11, 2026, the selected Cinesrc backend showed advancing video clocks on a sample movie and TV episode while the ad stylesheet was present in both outer and nested frames. The check blocked adexchangerapid.com requests. This is not a guarantee of zero ads or uninterrupted playback for all titles.
The common player/trailer session filters, popup denial and ongoing cosmetic checks apply across all source choices; no source is exempted from ad filtering.

