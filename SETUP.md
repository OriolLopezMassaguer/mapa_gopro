# mapa_gopro — Setup Guide

## Overview

`mapa_gopro` is a two-process web app for browsing GoPro footage on an interactive map.

| Process | Stack | Default port |
|---------|-------|-------------|
| Server  | Node.js + Express | 3001 |
| Client  | React + Vite | 5173 |

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| Node.js ≥ 18 | Both server and client |
| ffmpeg (on PATH) | Thumbnail generation and video metadata extraction |

---

## Installation

```bash
# Root dependencies (concurrently)
npm install

# Server dependencies
npm install --prefix server

# Client dependencies
npm install --prefix client
```

---

## Environment configuration

The server reads a `.env` file from the repository root. Copy one of the included templates:

| Template | Target environment |
|----------|--------------------|
| `.env.local` | Local Windows machine (UNC path) |
| `.env.babel` | Synology NAS / Babel server (Linux path) |

```bash
# Local example
copy .env.local .env

# Babel / NAS example
copy .env.babel .env
```

### Available variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `\\babel\Alpes` | Root directory containing all GoPro data |
| `PORT` | `3001` | HTTP port the server listens on |
| `EXCLUDE_PHOTO_PREFIXES` | `DSC` | Comma-separated filename prefixes to skip (e.g. non-GoPro photos) |
| `CACHE_CONCURRENCY` | `4` | Parallel workers for background cache processing |
| `DOTENV_PATH` | `../../.env` (relative to server/src) | Override path to the `.env` file |

### Directory layout expected under `DATA_DIR`

```
DATA_DIR/
├── media/          ← photos and videos indexed by the server
├── passes/         ← GPX files with mountain pass waypoints (by region)
├── tracks/         ← Recorded GPS tracks
└── video_cache/    ← created automatically
    ├── metadata/   ← JSON telemetry cache per file
    └── thumbnails/ ← generated thumbnails
```

---

## Running

### Development (both processes, with hot-reload)

```bash
npm run dev
```

This uses `concurrently` to start the server (`node --watch`) and the Vite dev server simultaneously.

Alternatively, use the platform launcher scripts, which also free leftover ports on 3001/5173 and open the browser once both are ready:

```bash
./scripts/start.sh      # Linux/Synology
```
```powershell
.\scripts\start.ps1      # Windows (opens server + client in separate windows)
```

### Server only

```bash
npm run dev:server
```

### Client only

```bash
npm run dev:client
```

### Production

```bash
# 1. Build the React app
npm run build --prefix client

# 2. Start the server (it will serve the built client from client/dist)
NODE_ENV=production npm run start --prefix server
```

---

## Utility scripts

Each script below has a `.sh` (Linux) and `.ps1` (Windows) version with identical behavior, in `scripts/`.

| Script | Purpose |
|--------|---------|
| `clear-cache` | Deletes `video_cache/` metadata + thumbnails so the server rebuilds them from scratch |
| `export-gpx [output-dir]` | Exports GPS tracks from all videos in `DATA_DIR` to individual `.gpx` files (defaults to `scripts/tracks-videos/`) |

```bash
./scripts/clear-cache.sh
./scripts/export-gpx.sh ./my-tracks
```
```powershell
.\scripts\clear-cache.ps1
.\scripts\export-gpx.ps1 .\my-tracks
```

---

## Scanner exclusions

`scanner-exclude.json` at the repository root is a JSON array of directory names (case-insensitive) that the server will skip when scanning `DATA_DIR`. Edit it to prevent the indexer from entering irrelevant or slow directories:

```json
["jdowloader", "mapa_gopro", "scripts", "synoscheduler"]
```

---

## Mountain passes (GPX data)

The `passes/` directory under `DATA_DIR` contains GPX files with mountain pass waypoints rendered on the map. Each file is named by region. To add a new region, drop a `.gpx` file into that directory — no server restart needed, the passes API reads the directory at request time.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/media` | List all indexed media items |
| GET | `/api/passes` | List all GPX pass waypoints |

---

## Troubleshooting

**Server starts but no videos appear**
- Check that `DATA_DIR` in `.env` points to the correct path and is accessible.
- Verify that a `media/` sub-directory exists inside `DATA_DIR`.

**Thumbnails are not generated**
- Confirm `ffmpeg` is installed and available on `PATH` (`ffmpeg -version`).
- Check the `video_cache/thumbnails/` directory for partial output and server logs for ffmpeg errors.

**High memory / slow startup**
- Lower `CACHE_CONCURRENCY` in `.env` (e.g. `CACHE_CONCURRENCY=2`).

**Wrong files being scanned**
- Add the unwanted directory name to `scanner-exclude.json`.

---

## Electron desktop installer (Windows)

Packages the app as a self-contained Windows installer (NSIS). ffmpeg is bundled automatically — no separate installation required.

### Prerequisites

- Node.js ≥ 18
- Windows x64 build machine (or CI runner)

### Install root dependencies

```bash
npm install
```

### Build the installer

```bash
npm run electron:build
```

Or use the wrapper script (same steps, plus preflight checks for `ffmpeg`/Wine):

```powershell
.\scripts\build-installer.ps1
```
```bash
./scripts/build-installer.sh    # cross-builds from Linux/macOS; requires Wine for the NSIS step
```

This runs three steps automatically:

1. `scripts/prepare-build.mjs` — finds `ffmpeg` on your `PATH` and copies it to `build-resources/`. You can also skip this by placing `ffmpeg.exe` in `build-resources/` manually before building.
2. `npm run build --prefix client` — compiles the React app into `client/dist/`
3. `electron-builder` — produces `dist-electron/Mapa GoPro Setup x.x.x.exe`

> **Note:** ffmpeg must be on your `PATH` at build time (or pre-placed in `build-resources/`). It is bundled into the installer so end users do not need to install it separately.
>
> The installer target is Windows-only (NSIS). Building it from Linux/macOS cross-compiles via Wine, which `electron-builder` requires for the NSIS step (`sudo apt install wine` on Debian/Ubuntu).

### Unpackaged test (no installer)

```bash
npm run electron:pack
```

Outputs an unpacked directory in `dist-electron/win-unpacked/` for quick testing without running the installer.

### Development with Electron

```bash
npm run electron:dev
```

Starts the Vite dev server (port 5173) and Electron simultaneously. The Electron window loads from Vite so React hot-reload works. The Express server (port 3001) starts inside the Electron process; Vite proxies `/api` requests to it automatically.

### First run

On first launch the app shows a folder picker. Select the root directory where your GoPro videos are stored. The choice is saved to the OS user-data directory (`%APPDATA%\Mapa GoPro\settings.json` on Windows). To change it later: **File → Change video folder…**

### Installer output

| File | Description |
|------|-------------|
| `dist-electron/Mapa GoPro Setup x.x.x.exe` | NSIS installer — prompts for install directory, creates desktop and Start Menu shortcuts |
| `dist-electron/win-unpacked/` | Unpacked build for testing |

---

## Docker

Runs the full app (server + pre-built client) in a single container. Useful for NAS / home-server deployment.

### Prerequisites

- Docker Engine ≥ 24
- Docker Compose v2

### Configure

```bash
cp .env.docker.example .env
# Edit .env and set DATA_DIR to the path of your GoPro data on the host
```

### Start

```bash
docker compose up -d
```

The app is available at `http://<host>:3001`.

### Synology NAS (Babel) example

```env
DATA_DIR=/volume1/GoPro
```

### Rebuild after code changes

```bash
docker compose build
docker compose up -d
```

### Logs

```bash
docker compose logs -f
```

### Notes

- The data directory is mounted **read-only** (`ro`). The cache (`video_cache/`) is written inside `DATA_DIR` on the host, so thumbnails and metadata persist across container restarts.
- Lower `CACHE_CONCURRENCY` for slow NAS disks (e.g. `CACHE_CONCURRENCY=2` in `.env`).
