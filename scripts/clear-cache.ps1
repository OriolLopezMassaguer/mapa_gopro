# Clears the video cache so the server rebuilds it from scratch on next start.

$root = $PSScriptRoot

node "$root\clear-cache.mjs"
