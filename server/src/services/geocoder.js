import fs from 'fs';
import path from 'path';
import config from '../config.js';

let lastCallTime = 0;
const MIN_INTERVAL = 1200; // Nominatim: max 1 req/sec, use 1.2s to be safe

// Serialize every Nominatim call through a single chain, process-wide. A plain
// "check lastCallTime, then act" pacer races when two videos are geocoded
// concurrently (e.g. clicking to a new video before the previous /places request
// finishes): both read the same stale lastCallTime before either updates it, so
// both fire together — bursting past the 1 req/sec limit and triggering 429s.
// Chaining onto `queue` guarantees true one-at-a-time pacing regardless of how
// many callers are in flight.
let queue = Promise.resolve();

function fetchOnce(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&zoom=13&format=json&accept-language=en`;
  return fetch(url, {
    headers: { 'User-Agent': 'mapa-gopro/1.0 (private GPS viewer)' },
    signal: AbortSignal.timeout(10_000),
  });
}

async function throttle() {
  const wait = Math.max(0, MIN_INTERVAL - (Date.now() - lastCallTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();
}

async function reverseGeocode(lat, lon) {
  const run = queue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      await throttle();
      const res = await fetchOnce(lat, lon);
      if (res.ok) return res.json();
      if (res.status === 429 && attempt < 3) {
        const retryAfter = parseInt(res.headers.get('retry-after'), 10);
        const backoff = Number.isFinite(retryAfter) ? retryAfter * 1000 : MIN_INTERVAL * 2 ** (attempt + 1);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw new Error(`Nominatim HTTP ${res.status}`);
    }
  });
  // Chain unconditionally so a failed/throwing call doesn't stall later callers,
  // but callers of reverseGeocode still see the original rejection via `run`.
  queue = run.catch(() => {});
  return run;
}

function extractPlaceName(data) {
  if (!data || data.error) return null;
  const a = data.address;
  if (!a) return data.display_name?.split(',')[0]?.trim() || null;
  return (
    a.village ||
    a.hamlet ||
    a.town ||
    a.suburb ||
    a.city_district ||
    a.city ||
    a.municipality ||
    a.county ||
    null
  );
}

function getPlacesCachePath(id) {
  return path.join(config.placesDir, `${id}.json`);
}

function loadCachedPlaces(id) {
  try {
    const raw = fs.readFileSync(getPlacesCachePath(id), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePlacesCache(id, places) {
  try {
    if (!fs.existsSync(config.placesDir)) fs.mkdirSync(config.placesDir, { recursive: true });
    fs.writeFileSync(getPlacesCachePath(id), JSON.stringify(places));
  } catch { }
}

// Sample coordinates evenly up to maxSamples points.
function sampleCoordinates(coordinates, maxSamples = 60) {
  if (!coordinates?.length) return [];
  if (coordinates.length <= maxSamples) return coordinates;
  const step = coordinates.length / maxSamples;
  const result = [];
  for (let i = 0; i < maxSamples; i++) {
    result.push(coordinates[Math.round(i * step)]);
  }
  return result;
}

// Reverse-geocodes a track's coordinates into a deduped list of place names.
// A photo is just a one-point "track", so this works unchanged for both.
export async function getPlacesForMedia(id, coordinates) {
  const cached = loadCachedPlaces(id);
  if (cached) return cached;

  if (!coordinates?.length) return [];

  const sampled = sampleCoordinates(coordinates, 60);
  const places = [];
  let lastName = null;

  for (const pt of sampled) {
    let name = null;
    try {
      const data = await reverseGeocode(pt.lat, pt.lon);
      name = extractPlaceName(data);
    } catch (err) {
      console.warn(`[geocoder] Failed for ${pt.lat},${pt.lon}: ${err.message}`);
    }
    if (name && name !== lastName) {
      places.push({ name, lat: pt.lat, lon: pt.lon, time: pt.date || null });
      lastName = name;
    }
  }

  savePlacesCache(id, places);
  return places;
}

export function deletePlacesCache(id) {
  try { fs.unlinkSync(getPlacesCachePath(id)); } catch { }
}
