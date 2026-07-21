# Exports GPS tracks from all videos in VIDEO_DIR to individual GPX files.
# Usage: .\export-gpx.ps1 [output-dir]
# Output defaults to .\tracks\

$root = $PSScriptRoot
$outputDir = if ($args[0]) { $args[0] } else { Join-Path $root "tracks" }

node "$root\scripts\export-gpx.mjs" $outputDir
