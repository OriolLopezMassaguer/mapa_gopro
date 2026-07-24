#!/bin/bash
# Starts the server (API) and client (Vite dev server) together.
# Frees ports 3001/5173 if leftover processes hold them, waits for both
# to be ready, then opens the browser. Ctrl+C stops both.
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Free port 3001 (server) and 5173 (client) if leftover processes are holding them
for port in 3001 5173; do
  pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Freeing port $port (PID $pid)..."
    kill -9 $pid 2>/dev/null || true
    sleep 0.5
  fi
done

cleanup() {
  echo "Stopping server and client..."
  kill 0
}
trap cleanup EXIT INT TERM

(cd "$ROOT_DIR/server" && npm run dev) &
(cd "$ROOT_DIR/client" && npm run dev) &

# Wait for both servers to be ready, then open the browser
(
  for url in "http://localhost:3001/api/media" "http://localhost:5173"; do
    until curl --output /dev/null --silent --fail --max-time 1 "$url"; do
      sleep 0.5
    done
  done
  xdg-open "http://localhost:5173" >/dev/null 2>&1 || true
) &

wait
