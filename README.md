# mapa_gopro

Local web app for visualizing GoPro footage and photos on an interactive map. It scans a NAS or local directory for GoPro videos and photos, extracts embedded GPS telemetry, generates thumbnails, and displays everything on a Leaflet map with rich filtering and KML export.

## Features

- Extracts GPS telemetry from GoPro `.mp4` files (GPMF format)
- Extracts GPS from photo EXIF data (`.jpg`, `.heic`, etc.)
- Generates video thumbnails via FFmpeg
- Interactive Leaflet map with track overlays and media markers
- Table view with sortable columns
- Filters by year, month, day, camera, and geographic region
- Mountain pass waypoint overlays (43 GPX files, Europe-wide)
- Export tracks and media locations to KML (Google Earth)
- Audit view to compare disk contents vs. cache

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

2. Configure the media directory by creating a `.env.local` file in `server/`:
   ```bash
   # Windows NAS share
   VIDEO_DIR=\\Babel\GoPro
   MEDIA_SUBDIR=media
   ```
   Or for Linux/Synology:
   ```bash
   VIDEO_DIR=/volume1/GoPro
   MEDIA_SUBDIR=media
   ```

3. Start both server and client:
   ```bash
   npm run dev          # concurrently runs server + client
   ```
   Or on Windows:
   ```powershell
   .\start.ps1          # opens separate PS windows for server and client
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
  passes/          43 GPX files with mountain pass waypoints
  start.ps1        Windows launcher (opens server + client in separate windows)
  start-babel.sh   Linux/Synology launcher
```
