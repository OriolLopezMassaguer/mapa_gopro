#!/bin/bash
# Builds the Windows installer (NSIS .exe) for Mapa GoPro.
# Cross-building a Windows target from Linux requires Wine (used by electron-builder).
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "cygwin" && "$(uname -s)" != "Darwin"* ]]; then
  if ! command -v wine >/dev/null 2>&1; then
    echo "ERROR: wine is required to build the Windows installer from Linux." >&2
    echo "Install it (e.g. 'sudo apt install wine') and re-run this script." >&2
    exit 1
  fi
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "WARNING: ffmpeg not found on PATH. Place ffmpeg.exe in build-resources/ manually," >&2
  echo "or install ffmpeg so scripts/prepare-build.mjs can copy it." >&2
fi

npm run electron:build

echo "Done: dist-electron/"
