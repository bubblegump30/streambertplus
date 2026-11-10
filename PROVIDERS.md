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

These additional adapters are TMDB-based and have watch-progress support off until tested. Existing source defaults, anime behavior, and the original three non-anime providers remain available.

## Design reference
User supplied screenshot Screenshot 2026-11-10 051832.png and https://flixseries.cyou/ . The website could not be retrieved using the web tool; the screenshot guided the charcoal, rounded server-button grid and bright active selection. No page instructions were followed. No paid/VIP behavior is implied or implemented.
