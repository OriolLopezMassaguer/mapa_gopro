export const YEAR_PALETTE = ['#2563eb', '#e74c3c', '#0ea5e9', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#ea580c'];
export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const REGIONS = [
  { id: 'alps-french',   name: 'French Alps',   minLat: 43.5, maxLat: 46.5, minLon: 5.5,  maxLon: 7.5   },
  { id: 'alps-swiss',    name: 'Swiss Alps',    minLat: 46.0, maxLat: 47.5, minLon: 6.0,  maxLon: 10.5  },
  { id: 'alps-italian',  name: 'Italian Alps',  minLat: 44.0, maxLat: 46.5, minLon: 6.5,  maxLon: 13.5  },
  { id: 'alps-austrian', name: 'Austrian Alps', minLat: 46.5, maxLat: 48.5, minLon: 9.5,  maxLon: 17.0  },
  { id: 'dolomites',     name: 'Dolomites',     minLat: 46.0, maxLat: 47.0, minLon: 10.8, maxLon: 12.6  },
  { id: 'pyrenees',    name: 'Pyrenees',    minLat: 42.0, maxLat: 43.6, minLon: -2.0,  maxLon: 3.5   },
  { id: 'maestrazgo',  name: 'Maestrazgo',  minLat: 39.8, maxLat: 41.2, minLon: -1.0,  maxLon: 0.6   },
  { id: 'scotland',    name: 'Scotland',    minLat: 54.6, maxLat: 60.9, minLon: -7.6,  maxLon: -0.7  },
  { id: 'london',      name: 'London',      minLat: 51.28,maxLat: 51.69,minLon: -0.51, maxLon: 0.33  },
  { id: 'barcelona',   name: 'Barcelona',   minLat: 41.3, maxLat: 41.5, minLon: 1.9,   maxLon: 2.3   },
  { id: 'costa-brava', name: 'Costa Brava', minLat: 41.6, maxLat: 42.4, minLon: 2.5,   maxLon: 3.3   },
  { id: 'emporda',     name: 'Empordà',     minLat: 42.0, maxLat: 42.5, minLon: 2.7,   maxLon: 3.3   },
];

export function inRegion(item, region) {
  const p = item.startPoint;
  if (!p) return false;
  return p.lat >= region.minLat && p.lat <= region.maxLat &&
         p.lon >= region.minLon && p.lon <= region.maxLon;
}

// Ordered list: countries first (checked via "all waypoints inside"), then broader regions (centroid-based)
export const PASS_GROUPS = [
  // Countries
  { id: 'andorra',     name: 'Andorra',              minLat: 42.43, maxLat: 42.66, minLon:  1.41, maxLon:  1.79, country: true },
  { id: 'switzerland', name: 'Switzerland',           minLat: 45.82, maxLat: 47.81, minLon:  5.96, maxLon: 10.50, country: true },
  { id: 'austria',     name: 'Austria',               minLat: 46.37, maxLat: 49.02, minLon:  9.53, maxLon: 17.17, country: true },
  { id: 'france',      name: 'France',                minLat: 42.33, maxLat: 51.12, minLon: -5.14, maxLon:  9.00, country: true },
  { id: 'italy',       name: 'Italy',                 minLat: 35.49, maxLat: 47.10, minLon:  6.62, maxLon: 18.52, country: true },
  { id: 'spain',       name: 'Spain',                 minLat: 35.95, maxLat: 43.90, minLon: -9.30, maxLon:  4.33, country: true },
  { id: 'portugal',    name: 'Portugal',              minLat: 36.84, maxLat: 42.15, minLon: -9.55, maxLon: -6.19, country: true },
  { id: 'norway',      name: 'Norway',                minLat: 57.96, maxLat: 71.19, minLon:  4.50, maxLon: 31.17, country: true },
  { id: 'morocco',     name: 'Morocco',               minLat: 27.66, maxLat: 35.93, minLon:-13.17, maxLon: -0.99, country: true },
  { id: 'croatia',     name: 'Croatia',               minLat: 42.39, maxLat: 46.56, minLon: 13.50, maxLon: 19.45, country: true },
  { id: 'slovenia',    name: 'Slovenia',              minLat: 45.42, maxLat: 47.00, minLon: 13.38, maxLon: 16.61, country: true },
  { id: 'albania',     name: 'Albania',               minLat: 39.64, maxLat: 42.66, minLon: 19.27, maxLon: 21.07, country: true },
  { id: 'bih',         name: 'Bosnia-Herzegovina',    minLat: 42.56, maxLat: 45.28, minLon: 15.74, maxLon: 19.62, country: true },
  { id: 'czech',       name: 'Czech Republic',        minLat: 48.55, maxLat: 51.06, minLon: 12.09, maxLon: 18.87, country: true },
  { id: 'slovakia',    name: 'Slovakia',              minLat: 47.73, maxLat: 49.61, minLon: 16.83, maxLon: 22.57, country: true },
  { id: 'poland',      name: 'Poland',                minLat: 49.00, maxLat: 54.84, minLon: 14.12, maxLon: 24.15, country: true },
  { id: 'romania',     name: 'Romania',               minLat: 43.62, maxLat: 48.27, minLon: 20.26, maxLon: 29.76, country: true },
  // Broader geographical regions (centroid-based fallback, most specific first)
  { id: 'pyrenees',    name: 'Pyrenees',              minLat: 41.80, maxLat: 43.90, minLon: -2.50, maxLon:  3.50 },
  { id: 'iberia',      name: 'Spain',                 minLat: 35.50, maxLat: 44.50, minLon:-10.00, maxLon:  4.50 },
  { id: 'balkans',     name: 'Balkans',               minLat: 35.00, maxLat: 47.50, minLon: 13.00, maxLon: 30.00 },
  { id: 'caucasus',    name: 'Caucasus',              minLat: 35.00, maxLat: 48.00, minLon: 30.00, maxLon: 55.00 },
  { id: 'alps',        name: 'Alps',                  minLat: 43.50, maxLat: 48.50, minLon:  4.50, maxLon: 17.00 },
  { id: 'scandinavia', name: 'Scandinavia',           minLat: 54.00, maxLat: 72.00, minLon:-10.00, maxLon: 32.00 },
  { id: 'africa',      name: 'Africa',                minLat: 20.00, maxLat: 37.50, minLon:-20.00, maxLon: 40.00 },
  { id: 'other',       name: 'Other',                 minLat:-90.00, maxLat: 90.00, minLon:-180.0, maxLon:180.00 },
];

function inBox(lat, lon, g) {
  return lat >= g.minLat && lat <= g.maxLat && lon >= g.minLon && lon <= g.maxLon;
}

export function classifyPassFile(file) {
  const wpts = file.waypoints;
  if (!wpts.length) return PASS_GROUPS.find(g => g.id === 'other');

  const countries = PASS_GROUPS.filter(g => g.country);
  for (const country of countries) {
    if (wpts.every(w => inBox(w.lat, w.lon, country))) return country;
  }

  const centLat = wpts.reduce((s, w) => s + w.lat, 0) / wpts.length;
  const centLon = wpts.reduce((s, w) => s + w.lon, 0) / wpts.length;
  const regions = PASS_GROUPS.filter(g => !g.country);
  return regions.find(g => inBox(centLat, centLon, g)) || regions[regions.length - 1];
}
