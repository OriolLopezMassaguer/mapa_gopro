#!/bin/bash
# Generates the Switzerland trip map, flowchart, and PDF.
set -e

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
TRIP_DIR="$(cd "$SCRIPTS_DIR/../switzerland2026" && pwd)"

cd "$TRIP_DIR"

echo "Generating geographic map..."
python3 "$SCRIPTS_DIR/generate_map.py"

echo "Rendering flowchart..."
npx @mermaid-js/mermaid-cli -i "$TRIP_DIR/route_flowchart.mmd" -o "$TRIP_DIR/route_flowchart.png" -b white --width 900 --height 1400

echo "Building PDF..."
pandoc "$TRIP_DIR/switzerland-train-trip-sep2026.md" \
    -o "$TRIP_DIR/switzerland-train-trip-sep2026.pdf" \
    --pdf-engine=xelatex \
    -V geometry:margin=2cm \
    -V fontsize=11pt \
    -V mainfont="DejaVu Sans" \
    -V monofont="DejaVu Sans Mono" \
    -V colorlinks=true

echo "Done: $TRIP_DIR/switzerland-train-trip-sep2026.pdf"
