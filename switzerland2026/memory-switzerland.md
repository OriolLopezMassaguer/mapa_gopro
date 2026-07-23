---
name: switzerland-train-trip-sep2026
description: "Switzerland train trip itinerary planned in session — route, stops, scenic trains, generated PDF and map"
metadata: 
  node_type: memory
  type: project
  originSessionId: 127c5ea3-2812-4a99-bb6e-59ae88c7927d
  modified: 2026-07-21T11:11:28.056Z
---

## Switzerland Train Trip — September 2026

**File:** `c:\proyectos\mapa_gopro\switzerland-train-trip-sep2026.md`
**PDF:** `c:\proyectos\mapa_gopro\switzerland-train-trip-sep2026.pdf`
**PDF script:** `c:\proyectos\mapa_gopro\generate-pdf.ps1`

### Route
Barcelona → Geneva → Montreux → Luzern → Bern → Lugano → Milan → Torino → Barcelona

### Itinerary

| Day | Date | Weekday | Leg | Transport |
|-----|------|---------|-----|-----------|
| 1 | Sep 11 | Thursday | Barcelona → Geneva | TGV/AVE via Lyon (~5.5h) |
| 2 | Sep 12 | Friday | Geneva | CERN visit |
| 3 | Sep 13 | Saturday | Geneva → Montreux → Luzern | Regional + GoldenPass (~5h) |
| 4 | Sep 14 | Sunday | Luzern | Free day |
| 5 | Sep 15 | Monday | Luzern → Bern | Regional (~1h) |
| 6 | Sep 16 | Tuesday | Bern → Luzern → Lugano → Milan | Gotthard Panorama (~5.5h) |
| 7 | Sep 17 | Wednesday | Milan → Torino | Regional (~1h) |
| 8 | Sep 18 | Thursday | Torino → Barcelona | Via Lyon (~8h) |

### Scenic Trains
- **GoldenPass**: Montreux → Luzern (~5h), via Zweisimmen and Interlaken
- **Gotthard Panorama Express**: Luzern → Lugano (~5.5h), boat on Lake Luzern + mountain train

### Key Bookings
- CERN tours: home.cern/visits (book weeks ahead)
- GoldenPass panoramic seats: ~CHF 12 reservation
- Gotthard Panorama seats: popular in September
- Barcelona → Geneva TGV: book early for best price

### Generated Files
- `route_map.png` — geographic map (matplotlib, hardcoded country polygons, no external tiles)
- `route_flowchart.mmd` — Mermaid source for journey flowchart
- `route_flowchart.png` — rendered flowchart (via `npx @mermaid-js/mermaid-cli`)
- `generate_map.py` — Python script to regenerate the geographic map
- `generate-pdf.ps1` — PowerShell script: runs map → flowchart → pandoc PDF

### PDF Generation Stack
- **pandoc** + **xelatex** (MiKTeX) for PDF
- Font: Segoe UI (main), Consolas (mono)
- Map image: Python + matplotlib (no network needed — country polygons hardcoded)
- Flowchart: `npx @mermaid-js/mermaid-cli` with `--width 900 --height 1400`
- Map viewport: lon 5.5–10.5, lat 44.6–48.2 (Switzerland + Northern Italy focus)

**Why:** User planned a personal train trip and wanted a full itinerary with geographic map and flowchart, all exportable as a PDF.
**How to apply:** If user asks to update the trip, edit the markdown and run `.\generate-pdf.ps1`. If map needs adjusting, edit `LON_MIN/LON_MAX/LAT_MIN/LAT_MAX` in `generate_map.py`.
