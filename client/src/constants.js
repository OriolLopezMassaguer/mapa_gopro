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
