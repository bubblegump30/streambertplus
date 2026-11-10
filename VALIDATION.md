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

