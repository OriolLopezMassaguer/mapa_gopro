# Builds the Windows installer (NSIS .exe) for Mapa GoPro.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
        Write-Warning "ffmpeg not found on PATH. Place ffmpeg.exe in build-resources/ manually, or install ffmpeg so scripts/prepare-build.mjs can copy it."
    }

    npm run electron:build

    Write-Host "Done: dist-electron\"
} finally {
    Pop-Location
}
