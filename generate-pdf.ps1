$ErrorActionPreference = "Stop"
$dir = $PSScriptRoot

Write-Host "Generating geographic map..."
python "$dir\generate_map.py"

Write-Host "Rendering flowchart..."
npx @mermaid-js/mermaid-cli -i "$dir\route_flowchart.mmd" -o "$dir\route_flowchart.png" -b white --width 900 --height 1400

Write-Host "Building PDF..."
pandoc "$dir\switzerland-train-trip-sep2026.md" `
    -o "$dir\switzerland-train-trip-sep2026.pdf" `
    --pdf-engine=xelatex `
    -V geometry:margin=2cm `
    -V fontsize=11pt `
    -V mainfont="Segoe UI" `
    -V monofont="Consolas" `
    -V colorlinks=true

Write-Host "Done: $dir\switzerland-train-trip-sep2026.pdf"
