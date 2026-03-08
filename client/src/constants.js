export const YEAR_PALETTE = ['#2563eb', '#e74c3c', '#0ea5e9', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#ea580c'];
export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const REGIONS = [
  { id: 'alps',       name: 'Alps',       minLat: 43.5, maxLat: 48.5, minLon: 5.0,  maxLon: 17.0 },
  { id: 'dolomites',  name: 'Dolomites',  minLat: 46.0, maxLat: 47.0, minLon: 10.8, maxLon: 12.6 },
  { id: 'pyrenees',   name: 'Pyrenees',   minLat: 42.0, maxLat: 43.6, minLon: -2.0, maxLon: 3.5  },
  { id: 'maestrazgo', name: 'Maestrazgo', minLat: 39.8, maxLat: 41.2, minLon: -1.0, maxLon: 0.6  },
];

export function inRegion(item, region) {
  const p = item.startPoint;
  if (!p) return false;
  return p.lat >= region.minLat && p.lat <= region.maxLat &&
         p.lon >= region.minLon && p.lon <= region.maxLon;
}
