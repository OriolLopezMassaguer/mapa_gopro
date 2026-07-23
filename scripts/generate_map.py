import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import matplotlib.patches as mpatches
from matplotlib.lines import Line2D
from matplotlib.patches import Polygon as MplPolygon
import math

# ── Viewport ─────────────────────────────────────────────────────────
LON_MIN, LON_MAX = 5.5, 10.5
LAT_MIN, LAT_MAX = 44.6, 48.2

def in_view(lon, lat, margin=0.3):
    return (LON_MIN - margin <= lon <= LON_MAX + margin and
            LAT_MIN - margin <= lat <= LAT_MAX + margin)

# ── Country outlines (lon, lat) ───────────────────────────────────────
COUNTRIES = {
    "France": [
        (-1.8,43.5),(0.0,43.0),(3.3,43.3),(5.0,43.3),(7.4,43.6),
        (7.7,44.3),(6.8,45.1),(7.1,46.5),(7.5,47.6),(8.2,47.6),
        (7.6,48.0),(6.9,49.2),(5.0,49.5),(2.5,51.0),(1.6,50.9),
        (-1.5,48.6),(-4.8,47.5),(-2.2,46.5),(-1.5,46.3),(-1.8,44.2),
        (-1.8,43.5),
    ],
    "Switzerland": [
        (5.9,47.8),(6.7,47.5),(7.5,47.6),(8.2,47.6),(9.5,47.5),
        (10.5,47.3),(10.5,46.8),(10.2,46.0),(9.2,45.8),(7.0,45.9),
        (6.0,46.4),(5.9,47.0),(5.9,47.8),
    ],
    "Italy": [
        (7.0,44.1),(7.6,43.8),(9.0,44.0),(12.0,44.0),(13.8,44.0),
        (15.5,41.0),(17.0,40.5),(18.5,40.8),(15.5,38.0),(15.1,36.6),
        (12.4,37.1),(11.0,37.5),(8.5,38.5),(7.5,43.8),(7.0,44.1),
    ],
    "Germany": [
        (6.9,49.2),(7.5,47.6),(8.2,47.6),(9.5,47.5),(10.5,47.3),
        (13.0,47.7),(13.5,48.5),(15.0,50.5),(13.0,54.0),(10.0,55.0),
        (8.5,55.0),(7.0,53.0),(5.8,51.0),(4.8,50.5),(5.0,49.5),(6.9,49.2),
    ],
    "Austria": [
        (9.5,47.5),(10.5,47.3),(13.0,47.7),(16.9,48.6),(17.2,47.8),
        (15.0,46.7),(13.4,46.4),(12.4,46.7),(10.5,46.8),(10.2,46.0),
        (9.2,45.8),(9.5,47.5),
    ],
}
COUNTRY_COLORS = {
    "France":      "#eef5e0",
    "Switzerland": "#fdf5e0",
    "Italy":       "#e8f0fa",
    "Germany":     "#f0f0e8",
    "Austria":     "#f0ece8",
}
COUNTRY_LABELS = {
    "France":      (6.3,  44.9),
    "Switzerland": (8.1,  47.1),
    "Italy":       (9.5,  45.2),
    "Germany":     (9.5,  47.8),
    "Austria":     (10.2, 47.2),
}

# ── Cities ────────────────────────────────────────────────────────────
# (name, lon, lat, date_label, offset_x, offset_y, type)
CITIES = [
    ("Barcelona",  2.173,  41.385, "Sep 11–18",   0,     0,    "start_end"),
    ("Geneva",     6.143,  46.204, "Sep 11–12",  -0.08,  0.10, "stop"),
    ("Montreux",   6.917,  46.433, "Sep 13",      0.10,  0.10, "stop"),
    ("Luzern",     8.309,  47.050, "Sep 13–15",   0.10,  0.10, "stop"),
    ("Bern",       7.447,  46.948, "Sep 15–16",  -0.08,  0.10, "stop"),
    ("Lugano",     8.951,  46.005, "Sep 16",      0.10, -0.18, "pass"),
    ("Milan",      9.190,  45.465, "Sep 16–17",   0.10, -0.18, "stop"),
    ("Torino",     7.686,  45.070, "Sep 17",     -0.08, -0.18, "stop"),
    ("Lyon",       4.832,  45.748, "",            0,     0,    "waypoint"),
]

# ── Route segments ────────────────────────────────────────────────────
# (from_idx, to_idx, label, style)
ROUTE = [
    (0, 8,  "",               "normal"),   # Barcelona -> Lyon
    (8, 1,  "TGV 5.5h",      "normal"),   # Lyon -> Geneva
    (1, 2,  "1h",             "normal"),   # Geneva -> Montreux
    (2, 3,  "GoldenPass 5h", "scenic"),   # Montreux -> Luzern
    (3, 4,  "1h",             "normal"),   # Luzern -> Bern
    (4, 3,  "1h",             "normal"),   # Bern -> Luzern
    (3, 5,  "Gotthard 5.5h", "scenic"),   # Luzern -> Lugano
    (5, 6,  "1h",             "normal"),   # Lugano -> Milan
    (6, 7,  "1h",             "normal"),   # Milan -> Torino
    (7, 8,  "",               "return"),  # Torino -> Lyon
    (8, 0,  "Via Lyon 8h",   "return"),   # Lyon -> Barcelona
]
STYLE = {
    "normal": dict(color="#1a6bb5", lw=2.2, ls="-",  zorder=4, ms=14),
    "scenic": dict(color="#e05c00", lw=3.0, ls="-",  zorder=5, ms=14),
    "return": dict(color="#888888", lw=1.6, ls="--", zorder=3, ms=10),
}

# ── Figure ────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 8))
fig.patch.set_facecolor("#dce8f5")
ax.set_facecolor("#dce8f5")

# Country fills
for name, pts in COUNTRIES.items():
    patch = MplPolygon(pts, closed=True,
                       facecolor=COUNTRY_COLORS[name],
                       edgecolor="#aaaaaa", linewidth=0.6, zorder=1)
    ax.add_patch(patch)
    lx, ly = COUNTRY_LABELS[name]
    if in_view(lx, ly):
        ax.text(lx, ly, name, fontsize=8.5, color="#666666",
                ha="center", va="center", style="italic",
                path_effects=[pe.withStroke(linewidth=2, foreground="white")])

# Route segments
for i_from, i_to, label, style in ROUTE:
    c_from = CITIES[i_from]
    c_to   = CITIES[i_to]
    x1, y1 = c_from[1], c_from[2]
    x2, y2 = c_to[1],   c_to[2]
    s = STYLE[style]
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color=s["color"], lw=s["lw"],
                                linestyle=s["ls"], mutation_scale=s["ms"]),
                zorder=s["zorder"],
                annotation_clip=True)
    if label and in_view((x1+x2)/2, (y1+y2)/2, margin=0.5):
        mx, my = (x1+x2)/2, (y1+y2)/2
        dx, dy = x2-x1, y2-y1
        length = math.sqrt(dx*dx + dy*dy) or 1
        ox, oy = -dy/length*0.18, dx/length*0.18
        ax.text(mx+ox, my+oy, label, fontsize=7.5, color=s["color"],
                ha="center", va="center", fontweight="bold",
                path_effects=[pe.withStroke(linewidth=2.5, foreground="white")],
                zorder=7)

# City markers — only within viewport
for name, lon, lat, date_label, ox, oy, ctype in CITIES:
    if ctype == "waypoint" or not in_view(lon, lat):
        continue
    color  = "#cc2200" if ctype == "start_end" else "#1a6bb5" if ctype == "stop" else "#888888"
    marker = "s" if ctype == "start_end" else "o"
    size   = 10 if ctype in ("start_end", "stop") else 7
    ax.plot(lon, lat, marker=marker, color=color, markersize=size,
            markeredgecolor="white", markeredgewidth=1.5, zorder=8, clip_on=True)
    if date_label:
        ax.text(lon+ox, lat+oy, f"{name}\n{date_label}",
                fontsize=8, ha="left" if ox >= 0 else "right",
                va="bottom" if oy >= 0 else "top", fontweight="bold",
                path_effects=[pe.withStroke(linewidth=2.5, foreground="white")],
                zorder=9, clip_on=True)

# Arrow indicating Barcelona is off the left edge
ax.annotate("← via Lyon · to/from Barcelona",
            xy=(LON_MIN, 45.75), xytext=(LON_MIN + 0.15, 45.75),
            fontsize=8, color="#888888", va="center",
            arrowprops=dict(arrowstyle="<-", color="#888888", lw=1.2))

# Legend
legend_elements = [
    Line2D([0],[0], color="#1a6bb5", lw=2.2,  label="Train route"),
    Line2D([0],[0], color="#e05c00", lw=3.0,  label="Scenic (GoldenPass / Gotthard)"),
    Line2D([0],[0], color="#888888", lw=1.6, ls="--", label="Return to Barcelona"),
    Line2D([0],[0], marker="o", color="w", markerfacecolor="#1a6bb5",  markersize=9, label="City stop"),
]
ax.legend(handles=legend_elements, loc="lower right", fontsize=9,
          framealpha=0.95, edgecolor="#cccccc")

ax.set_xlim(LON_MIN, LON_MAX)
ax.set_ylim(LAT_MIN, LAT_MAX)
ax.set_title("Switzerland & Northern Italy — September 2026",
             fontsize=14, fontweight="bold", pad=10)
ax.set_xlabel("Longitude", fontsize=9)
ax.set_ylabel("Latitude",  fontsize=9)
ax.grid(True, ls="--", lw=0.3, alpha=0.5, color="#999999", zorder=0)
ax.tick_params(labelsize=8)

fig.savefig("route_map.png", dpi=180, facecolor=fig.get_facecolor())
print("Saved route_map.png")
