#!/bin/bash
# Exports GPS tracks from all videos in DATA_DIR to individual GPX files.
# Usage: ./export-gpx.sh [output-dir]
# Output defaults to ./tracks-videos/
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/tracks-videos}"

node "$ROOT_DIR/export-gpx.mjs" "$OUTPUT_DIR"
