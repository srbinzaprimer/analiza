<div align="center">

![Bölüm — Turkish dramas. Full episodes. Official and free.](sajt/deljenje.png)

# Bölüm

**Every full episode of Turkish dramas that broadcasters publish for free on their official YouTube channels, organized by series.**

Website · Stremio addon · English · Srpski · Türkçe · Español

</div>

---

Turkish broadcasters upload thousands of full episodes to YouTube for free, often with
subtitles. They are scattered across hundreds of playlists and mixed with trailers,
clips and recaps, so fans end up on sketchy pirate sites instead.

Bölüm fixes that. It finds the full episodes on official channels, groups them by
series and episode number, and gives you a clean place to watch them.

## Features

- **Series, not videos.** Episodes are grouped by series and season, in order, with
  trailers, clips, recaps and shorts filtered out. Long seasons (Turkish shows often
  run 100+ episodes) are split into ranges.
- **A real streaming experience.** Cinematic home page with a featured carousel,
  **Top 10 today** (by fresh views), new episodes, genre rows and **Explore** with
  filters for genre, channel, subtitle language and sort order.
- **Posters, synopses in 4 languages, genres, ratings and cast** from
  [TMDB](https://www.themoviedb.org/), matched automatically and fixable by hand.
- **Where else to watch, legally.** Each series shows the streaming services that
  carry it in your country (subscription, free, with ads, rent, buy), with data from
  JustWatch via TMDB.
- **Subtitles first.** Subtitle languages are detected per channel and per episode,
  shown on every card, and turned on automatically in the player in your language.
  The home page has a "With subtitles in your language" row.
- **A player built for binge-watching.** Season playlist next to the player, resume
  where you stopped, autoplay next episode with a countdown, theater mode, subtitle
  toggle, and finished episodes marked as watched.
- **My list** and instant search (press `/`) that ignores Turkish letters
  (`yali capkini` finds `Yalı Çapkını`) and also matches translated titles.
- **Stremio addon** with the same catalog: new, popular and genre catalogs, posters,
  cast and a "where else to watch" link.
- **Four languages**: English, Serbian, Turkish and Spanish, picked from your browser.
- **Search engine friendly.** Every series has its own prerendered page with
  structured data.
- **No accounts, no ads, no tracking.** Your progress stays in your browser.
- **No servers.** It runs on GitHub Pages and GitHub Actions for free.

## Legal by design

- Only **official** channels of broadcasters and production companies are included,
  and a person confirms each one (see `katalog/kanali.json`).
- Videos play in **YouTube's own embedded player**, so views count for the owners,
  their ads run, and their geo restrictions apply.
- Nothing is downloaded, re-hosted or scraped. Data comes from the official
  [YouTube Data API](https://developers.google.com/youtube/v3) and the
  [TMDB API](https://developer.themoviedb.org/), refreshed daily.
- Other sources are **links to licensed services only**. No pirate streams and no
  fan-made subtitle files.
- Bölüm is not affiliated with YouTube, TMDB, JustWatch or any broadcaster.

This product uses the TMDB API but is not endorsed or certified by TMDB.
Streaming availability data is provided by JustWatch.

## Stremio

In Stremio, open **Add-ons**, paste the addon address into the search field and install it:

```
https://<your-site>/stremio/manifest.json
```

The website footer has a one-click **Add to Stremio** button and a button that copies
the address.

## How it works

```
katalog/kanali.json ── confirmed official channels
        │
        ▼  scripts/osvezi.mjs (daily, GitHub Actions, YouTube Data API)
data/katalog.json ──── episodes: series, season, number, duration, views, subtitles
        │
        ▼  scripts/obogati.mjs (daily, TMDB API, cached for a week)
data/tmdb.json ─────── posters, synopses, genres, cast, where to watch
        │
        ▼  scripts/napravi.mjs
dist/ ──────────────── website + one page per series + Stremio addon (static JSON)
        │
        ▼  GitHub Pages
```

- **Episode detection** (`src/epizode.mjs`) reads titles such as `Series 45. Bölüm`,
  `Series Episode 45`, `Capítulo 45` or `الحلقة 45`, and rejects trailers, clips,
  recaps and anything shorter than 20 minutes. Subtitle languages are read from
  titles such as `English Subtitles` or `(Arabic Subtitle)`.
- **Refreshing** (`src/katalog.mjs`) reads a channel's uploads from newest to oldest
  and stops at the first video it has already seen, so a daily run uses a few dozen
  of the 10,000 free API units. Views of recent episodes are refreshed every day for
  the Top 10, and once a week it rescans everything to drop deleted videos.
- **Enrichment** (`src/tmdb.mjs`) matches each series by its Turkish title and the
  year of its first episode, so remakes with the same name are told apart. Wrong
  matches can be fixed in `katalog/serije.json`.
- **The website** (`sajt/`) is plain HTML, CSS and JavaScript modules with no build
  step and no dependencies. It has a strict Content Security Policy, self-hosted
  fonts (Manrope and Playfair Display, OFL) and works down to 360 px wide screens.

## Run it locally

Requires Node.js 22 or newer. There are no dependencies to install.

```bash
npm test          # all tests
npm run primer    # build with demo data, then open http://localhost:8080
```

The demo data in `test/` uses invented series, channels, cast and streaming services,
with original abstract artwork.

With your own API keys:

```bash
YOUTUBE_API_KEY=... npm run osvezi   # refresh data/katalog.json
TMDB_API_KEY=... npm run obogati     # refresh data/tmdb.json (optional)
npm run napravi && npm run pokreni   # build and preview
```

Setup for the GitHub repository (keys, Pages, confirming channels) is described step
by step in [UPUTSTVO.md](UPUTSTVO.md) (Serbian).

## Suggest a channel

Open an issue or a pull request that adds the channel to `katalog/kanali.json` with
`"potvrdjeno": false`. Include a link that shows the channel is official, such as the
broadcaster's website linking to it. A maintainer verifies it and turns it on.

## Project structure

| Path | Purpose |
| --- | --- |
| `katalog/kanali.json` | Official channels and their language and subtitles |
| `katalog/serije.json` | Manual fixes for TMDB matches |
| `src/` | Episode detection, YouTube and TMDB clients, catalog refresh, Stremio, HTML pages |
| `scripts/` | `osvezi` (refresh), `obogati` (TMDB), `napravi` (build), `server` (local preview) |
| `sajt/` | The web app |
| `test/` | Tests (`npm test`) and demo data |
| `.github/workflows/` | Tests, daily refresh and publishing |
