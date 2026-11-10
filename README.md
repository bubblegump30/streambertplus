# Streambert Plus

**Refreshed by Kyle Austin Hillier.** A Windows desktop movie and TV browser with a clean layout, selectable color themes, favorite servers and guarded playback resume.

This fork preserves the original Streambert authorship and GPL-3.0 license. The Plus application was developed from the supplied Streambert 2.6.0 release; this repository also retains the upstream Git history. Upstream: https://github.com/truelockmc/streambert .

## 2.8.0 - Playback & Resume preview

- Favorite and reorder servers. A title or episode can remember the last server on which a usable video clock actually advanced.
- Explicit **Resume / Start over** choice. A provider guest is not created until that decision is made when a bookmark exists.
- Exact-position bookmarks, remaining-time display, retry and next-server controls, and stalled-playback notices.
- Resume seeks are checked against an observable media element. If seeking fails, the old bookmark is kept until you explicitly choose **Continue from here**.
- Up Next with a cancellable countdown using your existing autoplay preferences.
- Optional VLC/mpv launch after a compatible direct stream has been detected. The player must be installed separately.
- One shared playback controller for movies and TV, with AllManga sub/dub resolution, episode mappings, trailers, downloads, pop-out playback and anime intro-skip hooks retained.
- New bookmarks, server preferences and color themes are included in backups. Clearing watch progress clears the new bookmarks too.

The clean Discover layout, library, watchlist, all ten provider options, color themes, and refresh credit from Plus 2.7.1 remain.

![Favorite servers, using local acceptance fixtures](screenshots/plus-servers.png)

![Resume choice, using local acceptance fixtures](screenshots/plus-resume.png)

These screenshots use fictional local test titles. They are interface acceptance evidence, not real-provider playback proof.

## Run or build

Use Node.js 24 (or a supported version meeting Vite's requirements).

```sh
npm ci
npm test
npm run build
npm start
```

Build a Windows folder package:

```sh
npm run package:win
```

The output is `release/win-unpacked`. Keep `Streambert Plus.exe`, `resources`, and the bundled DLLs together. The preview is unsigned. macOS/Linux package scripts are inherited, but this Plus release has only been packaged and tested locally on Windows.

On first launch, enter your own TMDB **API Read Access Token** in the app. The Plus profile is `%APPDATA%/Streambert Plus`; it is separate from upstream Streambert and is shared across Plus versions. Keep your credentials private. No user profile or real credential is committed here.

## Validation

```sh
npm test
npm run test:ui
npm run test:playback
```

The UI tests run Electron with an isolated profile, intercepted HTTPS responses and local metadata. The playback test uses a simulated video clock to check success detection and resume behavior. It does not play real external streams. Run them on a desktop-capable environment. CI runs unit tests and the frontend build on Windows and Ubuntu.

See [VALIDATION.md](VALIDATION.md), [PROVIDERS.md](PROVIDERS.md) and [PLUS-README.md](PLUS-README.md) for details.

## Practical limits

A loaded embed page is not proof that a video works. Progress and resume depend on the source exposing an observable, seekable video. Runtime checks help ignore short ads when metadata is available, but do not prove content identity. Real movie/TV provider playback, every subtitle service, external-player playback and full pop-out recovery still need live acceptance. External providers can change or fail independently of the app.

Upstream binary auto-installation is disabled so an upstream installer cannot replace this custom build. Download recovery preserves records and partial files; automatic byte-level resumption is not implemented.

## Credits

- Original Streambert: truelockmc and upstream contributors.
- Refreshed by Kyle Austin Hillier.
- GPL-3.0: see [LICENSE](LICENSE).
- This product uses the TMDB API but is not endorsed or certified by TMDB.
