# Mapa GoPro — GoPro videos & photos map server

Local web app for visualizing GoPro footage and photos on an interactive map. It scans a NAS or local directory for GoPro videos and photos, extracts embedded GPS telemetry, generates thumbnails, and provides an interactive UI to explore tracks and media.

## Features

- Extracts GPS telemetry from GoPro `.mp4` files (GPMF format)
- Extracts GPS from photo EXIF data (`.jpg`, `.heic`, etc.)
- Generates video and photo thumbnails via FFmpeg / image processing
- Interactive Leaflet map with track overlays and media markers
- Table view with sortable columns
- Filters by year, month, day, camera, and geographic region
- Mountain pass waypoint overlays (43 GPX files, Europe-wide)
- Export tracks and media locations to KML (Google Earth)
- Audit view to compare disk contents vs. cache

## What's new (recent changes)

- Project name and README clarified (2026-07-27)
- Rescan functionality added to detect new media and generate missing thumbnails automatically (2026-07-26)
- Photo thumbnail generation and improved thumbnail processing (2026-07-25)
- Refactor of video processing pipeline and geocoding improvements to reduce rate limiting and OOM issues (2026-07-25)
- Environment and script updates for better cross-platform behaviour (2026-07-24)

Notes:
- If you process large numbers of videos, set `VIDEO_CONCURRENCY=1` in your `.env.local` to avoid OOM during video processing.
- The server now includes improved background task priority handling, playback information fetching, and basic transcoding logic to improve compatibility when streaming.
- Client performance improvements include virtualization in the table view and marker clustering on the map for large datasets.

## Stack

| Layer | Tech |
|---|---|
| Server | Node.js, Express (ESM), port 3001 |
| Client | React 19, Vite, Leaflet/react-leaflet, port 5173 |
| GPS extraction | `gopro-telemetry`, `gpmf-extract`, `exifr` |
| Thumbnails | `fluent-ffmpeg` |
| Cache | JSON files on disk |

## Setup

1. Install dependencies:
   ```bash
   npm install          # root (installs both client and server)
   ```

2. Configure the data directory by creating a `.env.local` file at the repository root:
   ```bash
   # Windows NAS share
   DATA_DIR=\\Babel\GoPro
   ```
   Or for Linux/Synology:
   ```bash
   DATA_DIR=/volume1/GoPro
   ```

   Recommended environment variables (examples):
   ```bash
   # Reduce concurrent video work to prevent OOM
   VIDEO_CONCURRENCY=1

   # Path to where thumbnails and cache are stored (optional)
   CACHE_DIR=./cache
   ```

3. Start both server and client:
   ```bash
   npm run dev          # concurrently runs server + client
   ```
   Or on Windows:
   ```powershell
   .\scripts\start.ps1          # opens separate PS windows for server and client
   ```
   Or on Linux/Synology:
   ```bash
   ./scripts/start.sh           # frees ports, starts server + client, opens browser
   ```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/media` | All media with GPS data |
| GET | `/api/media/all` | All media including items without GPS |
| GET | `/api/media/audit` | Disk vs. cache comparison |
| GET | `/api/media/tracks` | All GPS tracks (downsampled) |
| GET | `/api/media/export.kml` | All tracks as KML |
| GET | `/api/media/:id/telemetry` | GPS track for a single video |
| GET | `/api/media/:id/stream` | Stream video or serve photo |
| GET | `/api/media/:id/thumbnail` | Video thumbnail |
| POST | `/api/media/:id/recheck` | Force re-extract GPS |
| GET | `/api/passes/waypoints` | All mountain pass waypoints |

## Project Structure

```
mapa_gopro/
  client/          React + Vite frontend
    src/
      MapView/     Leaflet map with markers and track overlays
      TableView/   Sortable media table
      AuditView/   Disk vs. cache audit
      VideoPanel/  Side panel with video player + track detail
  server/          Express backend
    src/
      routes/      API route handlers
      services/    GPS extraction, thumbnail generation, caching
  passes/          GPX files with mountain pass waypoints (by region)
  tracks/          Recorded BMW Motorrad GPS tracks
  scripts/         Utility and launcher scripts
    start.ps1            Windows launcher (opens server + client in separate windows)
    start.sh             Linux/Synology launcher (starts server + client together)
    clear-cache.ps1/.sh  Clear video cache
    export-gpx.ps1/.sh   Export GPX data
    generate-pdf.ps1/.sh Generate Switzerland trip PDF
    build-installer.ps1/.sh  Build the Windows installer (NSIS .exe)
    generate_map.py      Map generation script
    start-frontend.js    Frontend launcher helper
```

## Changelog (recent commits)

- 2026-07-27 — Change project name and enhance README description
- 2026-07-26 — feat: implement rescan functionality to detect new media files and generate missing thumbnails
- 2026-07-25 — feat: add photo thumbnail generation and enhance thumbnail processing
- 2026-07-25 — Refactor video processing and enhance geocoding
- 2026-07-24 — refactor: update scripts and environment settings for improved functionality and cross-platform support

---

If you'd like, I can also:
- Add instructions for running the rescan operation (if you want a command or API endpoint documented)
- Expand the changelog with full commit messages and links
- Update client/README.md similarly
