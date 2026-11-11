# Streambert Plus 2.8.0 validation

Date: November 10, 2026. Refreshed by Kyle Austin Hillier.

## Local checks
- PASS: production frontend build; main/preload/IPC syntax checks; Git whitespace check.
- PASS: 13 node:test checks covering download-history recovery, partial-file preservation, ten provider route definitions, asynchronous probing, packaging configuration, observable-clock-only success, favorite priority, legacy bookmark migration, IPC sender/window validation, seekability, short-media filtering, credential-free backup coverage and external-player URL validation.
- PASS: local Electron layout acceptance: Discover filters, watched actions, TV episodes and player, movie/TV server selection, watchlist save, all six accents and five preset themes, narrow-window layout and Settings access.
- PASS: local Electron playback acceptance with a simulated video clock: loaded/paused pages do not mark success; favorites persist; advancing media records success; pause saves seconds; resume choice delays guest creation; seek restores position; unseekable sources preserve the old bookmark until explicit Continue from here; top-level load failures expose recovery controls.
- Screenshots use fictional fixtures and were visually inspected. All external HTTPS requests were intercepted during these acceptance suites.

## Limits
No real TMDB credentials or external movie/TV streams were used by the acceptance harness. Provider content identity, ads, real subtitles, installed VLC/mpv playback, AllManga live resolution, every episode mapping, macOS/Linux runtime and full pop-out recovery remain unverified. The app uses observable media clocks and runtime heuristics; neither guarantees that a provider served the intended title. Byte-level download resumption is not implemented.

## Implementation and privacy
MoviePage and TVPage were replaced wholesale. Shared code is under src/components/playback; native fixed-purpose commands are under src/ipc/playback.js. Bookmarks and server preferences are local. Archives and repository content exclude user/test profiles, downloaded media, real credentials, node_modules and generated release folders. Original GPL-3.0 notices remain.


## 2.8.1 ad protection

16 unit tests pass, including ad request matching, normal media/subtitle preservation and navigation guards.
The isolated Electron ad fixture checks blocked ad scripts, CSS hiding in main/nested frames, preserved video controls, playlist/subtitle requests, popup denial and cross-origin takeover denial.
Production dependency audit: 0 known vulnerabilities at build time. Development dependency audit is separate.
The screenshot reported by the user is not itself proof that this exact live provider overlay is resolved. Live provider acceptance remains pending.


## 2.8.2 provider compatibility

19 unit tests cover retired-source migration, bounded redirect exceptions and video failures before metadata. The native ad fixture also checks the real Electron redirect event sequence with local HTTPS fixtures while continuing to deny arbitrary navigation.
Provider probes are opt-in diagnostics only. They use an isolated profile, leave verification challenges untouched, request short playback, compare media clocks, then pause and close the players. Short advancing samples do not establish complete playback or availability for every title.


Short live samples on November 10, 2026 used TMDB movie 550 and TV 1399 S1E1. VidSrc, vidsrc.mov and MovieTV API all showed advancing movie clocks with long-form durations and no media error. For TV, vidsrc.mov and MovieTV API showed two advancing samples; VidSrc only reached a valid playing sample at the second observation, after a slower load. These were isolated Electron tests of the protection module, not complete end-to-end watch-through tests in the packaged app.
The packaged ad, simulated playback/resume (including same-server retry) and layout fixtures all passed.


## 2.8.3 EmbedWave investigation

The default EmbedWave route loaded web.nxsha.app and attempted a request to oc.parergygrates.com, blocked by the bundled network rules. The exact user-reported overlay was not reproduced for the sample ID.
The documented server=cinesrc option loaded cinesrc.st and yielded a playing long-form video sample at 13.93 and 15.94 seconds. This is a brief isolated test, not a guarantee for a full session.
The native fixture now checks ad markup inserted after startup and restoration after stylesheet removal, in addition to existing frame, request and navigation coverage.

The shared-session fixture loads every configured source origin with local intercepted HTML and verifies ad-request cancellation and popup denial for each. This establishes protection coverage, not that every real ad on every changing provider is blocked.
The layout and playback fixtures verify purple backgrounds and white wording on the requested player and season actions.


## 2.8.4 startup preference

The Electron UI fixture selects Movies, TV shows and For you through Settings, verifies the start page is Discover, reloads the app and checks the corresponding active Discover tab. The preference is included in the normal backup key list.


## 2.8.5 code scanning

21 unit tests pass, including stylesheet payload round trips with quotes, script tags, Unicode separators, null and non-ASCII characters; injected code is not executed. Native ad checks verify exact-host matching rejects lookalike hosts and domain text in paths/query strings while preserving overlays, media/subtitle traffic and navigation protections.

