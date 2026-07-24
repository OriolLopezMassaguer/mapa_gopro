$ErrorActionPreference = "Stop"
$scriptsDir = $PSScriptRoot
$tripDir = Join-Path (Split-Path -Parent $scriptsDir) "switzerland2026"

Push-Location $tripDir
try {
    Write-Host "Generating geographic map..."
    python "$scriptsDir\generate_map.py"

    Write-Host "Rendering flowchart..."
    npx @mermaid-js/mermaid-cli -i "$tripDir\route_flowchart.mmd" -o "$tripDir\route_flowchart.png" -b white --width 900 --height 1400

    Write-Host "Building PDF..."
    pandoc "$tripDir\switzerland-train-trip-sep2026.md" `
        -o "$tripDir\switzerland-train-trip-sep2026.pdf" `
        --pdf-engine=xelatex `
        -V geometry:margin=2cm `
        -V fontsize=11pt `
        -V mainfont="Segoe UI" `
        -V monofont="Consolas" `
        -V colorlinks=true

    Write-Host "Done: $tripDir\switzerland-train-trip-sep2026.pdf"
} finally {
    Pop-Location
}
