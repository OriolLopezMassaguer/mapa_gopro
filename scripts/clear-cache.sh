#!/bin/bash
# Clears the video cache so the server rebuilds it from scratch on next start.
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

node "$ROOT_DIR/scripts/clear-cache.mjs"
