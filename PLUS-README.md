# Streambert Plus 2.8.0 - Clean Layout


## 2.8.1 - Ad protection update

- Bundled EasyList network filtering and standard cosmetic rules, available offline.
- Filtering starts before the first embedded-player request.
- Popup windows and unsolicited cross-origin top-level navigation are blocked in embedded and pop-out players.
- Player frames receive cosmetic ad rules; media and subtitle detection stay on the same request handler.

The filter snapshot updates with app releases. Provider changes, inline promotions and ads stitched into the actual video may still need source-specific fixes. Real verification challenges are not solved or bypassed. Live verification of the reported provider overlay remains pending.

A separate Windows x64 build based on upstream Streambert 2.6.0, with the reliability improvements from Plus 2.6.1 and a redesigned interface. Original project: https://github.com/truelockmc/streambert . Original authors and GPL-3.0 license retained.

## Start
Extract the entire Windows ZIP to a folder. Run Streambert Plus.exe and keep the resources folder and DLLs beside it. No installer is required. Close an older running Streambert Plus window before opening this version.

This version uses the same %APPDATA%/Streambert Plus profile as Plus 2.6.1, preserving your theme and library settings. The original upstream Streambert uses a separate profile. If your Plus profile has not been set up, enter your own TMDB Read Access Token in the app. Never post your token in chat or share a backup that contains credentials.

## New layout
- A labeled sidebar: Discover, My library, Downloads, Settings & themes, and Help.
- A visible search button opens the existing full-catalog search.
- Watchlist entries show title names and small posters. Drag to reorder, or focus/hover an entry for move-up, move-down, and remove controls.
- Discover uses a smaller featured panel and clean poster rows. Choose For you, Movies, or TV shows.
- Filter this collection narrows the titles already loaded on Discover. Use the sidebar search for the whole catalog.
- Existing home-row visibility and order settings are retained. Rows replaces the old rotating carousel; the Grid option still works.
- Movie and TV details use compact information panels; the header shrinks further during playback, keeping the player closer to the top.
- TV episodes use clear cards and season buttons.
- Title cards are keyboard-accessible buttons, with an explicit options button for marking supported titles watched/unwatched.
- The navigation adapts to a top bar in narrow windows.
- Existing Dark, AMOLED, Mocha, Slate, Light and Custom themes remain, along with all six accent colors. New controls use theme variables, including the server picker.

The rewritten Sidebar, HomePage and MediaCard components replace their old implementations completely. App state remains in place; MoviePage and TVPage now use the shared PlaybackPlayer controller.

## Streaming and reliability
All four original providers (Videasy, VidSrc, Vidking, AllManga) and all six additional adapters remain. See PROVIDERS.md for routes and documentation. Real provider playback remains unverified.

Active/failed download history persists, unfinished jobs restore as Interrupted, and partial files are preserved. History has a last-valid backup. Reopen a title to retry; automatic byte-level resumption is not implemented and depends on the external downloader. Video-duration probes are asynchronous. Player caches stay warm between titles. The pop-out preload is packaged. Upstream installers remain disabled to preserve the custom build. Metadata requests time out after 15 seconds.

Fault logs are at %APPDATA%/Streambert Plus/plus-diagnostics.log. Logs are bounded and do not record stream URLs or credentials.

## Build and validation
Run npm ci, npm test, npm run build, then npm run package:win. Electron is pinned to 45.2.1. Run node node_modules/electron/cli.js tests/layout-smoke.cjs for the isolated local UI test. That test intercepts HTTPS and uses fictional metadata; it does not play external streams. Source tests and fixtures contain no real user credentials or profiles.

See VALIDATION.md for the checks performed and remaining limits. This is an unsigned preview, not a claim that every third-party service has passed live acceptance.

## Refresh credit
Refreshed by Kyle Austin Hillier. This credit appears in the desktop sidebar and Discover footer. Original upstream authorship and GPL-3.0 notices are retained.

## Playback & Resume update
Favorites and per-title/per-episode observed-success preferences are available in the server picker. Resume / Start over is explicit; a failed seek preserves the prior bookmark until Continue from here is chosen. Status messages distinguish a loaded player page from detected playback. Retry, next-server, stalled-playback notices and a next-episode countdown are available. External player launch requires installed VLC or mpv and a detected compatible stream. Movie and TV page controllers were replaced wholesale by thin pages and a shared PlaybackPlayer component.

Existing percentage/seconds progress is read where sufficient runtime data is available. The new records are backed up along with server preferences and themes. Clearing watch progress removes new bookmarks and legacy time records.

The unit suite has 13 checks. The local layout and simulated-clock playback acceptance suites pass. Real external playback is not certified by these tests.

