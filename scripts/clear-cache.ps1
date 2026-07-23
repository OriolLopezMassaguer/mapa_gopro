# Clears the video cache so the server rebuilds it from scratch on next start.

$root = $PSScriptRoot

# Load .env then .env.local (override)
foreach ($envFile in @("$root\.env", "$root\.env.local")) {
    if (Test-Path $envFile) {
        Get-Content $envFile | Where-Object { $_ -match '^\s*[^#]\w+=.+' } | ForEach-Object {
            $key, $value = $_ -split '=', 2
            [System.Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim())
        }
    }
}

$videoDir = [System.Environment]::GetEnvironmentVariable("VIDEO_DIR")
if (-not $videoDir) {
    Write-Error "VIDEO_DIR is not set. Create a .env.local file with VIDEO_DIR=<path>"
    exit 1
}

$cacheDir = Join-Path $videoDir "video_cache"

if (-not (Test-Path $cacheDir)) {
    Write-Host "Cache directory does not exist: $cacheDir"
    Write-Host "Nothing to clear."
    exit 0
}

$deleted = 0

foreach ($subDir in @("metadata", "thumbnails")) {
    $dir = Join-Path $cacheDir $subDir
    if (Test-Path $dir) {
        $items = Get-ChildItem $dir
        $items | Remove-Item -Recurse -Force
        $deleted += $items.Count
    }
}

foreach ($file in @("cache-index.json", "fingerprint-index.json")) {
    $p = Join-Path $cacheDir $file
    if (Test-Path $p) {
        Remove-Item $p -Force
        $deleted++
    }
}

Write-Host "Cleared $deleted cache files from $cacheDir"
Write-Host "Restart the server to rebuild the cache."
