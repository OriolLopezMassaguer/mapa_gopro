import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { scanMediaDirectory } from './scanner.js';
import { generateThumbnail } from './thumbnailGenerator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, 'extractionWorker.js');

const mediaIndex = new Map();
const allMediaIndex = new Map();
const thumbnailSet = new Set(); // IDs that have a thumbnail on disk

// Invalidation flags — set to true when indexes change, cleared after rebuild
let mediaItemsDirty = true;
let allMediaItemsDirty = true;
let allTracksDirty = true;
let cachedMediaItems = [];
let cachedAllMediaItems = [];
let cachedAllTracks = [];

function invalidate() {
  mediaItemsDirty = true;
  allMediaItemsDirty = true;
  allTracksDirty = true;
}

function ensureDirs() {
  for (const dir of [config.cacheDir, config.metadataDir, config.thumbnailDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  // Pre-load thumbnail IDs into memory so endpoint handlers never hit the filesystem
  try {
    for (const f of fs.readdirSync(config.thumbnailDir)) {
      if (f.endsWith('.jpg')) thumbnailSet.add(f.slice(0, -4));
    }
    console.log(`Thumbnail index: ${thumbnailSet.size} entries`);
  } catch { }
}

// Consolidated index: one file with all metadata (no coordinates).
// Coordinates are large and only needed on-demand — kept in individual files.
const CACHE_INDEX_PATH = path.join(config.cacheDir, 'cache-index.json');

// In-memory map: id -> entry (without coordinates, loaded from cache-index.json)
const diskCache = new Map();

function saveCacheIndex() {
  const obj = Object.fromEntries(diskCache);
  fs.writeFileSync(CACHE_INDEX_PATH, JSON.stringify(obj));
}

async function loadAllCacheEntries() {
  const t0 = Date.now();
  try {
    const raw = await fs.promises.readFile(CACHE_INDEX_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    for (const [id, entry] of Object.entries(obj)) diskCache.set(id, entry);
    console.log(`  [2] Done — ${diskCache.size} entries loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s (from cache-index.json)`);
  } catch {
    // First run or corrupt index — rebuild from individual files
    console.log('  [2] cache-index.json not found, rebuilding from individual files (one-time)…');
    let names;
    try { names = await fs.promises.readdir(config.metadataDir, { recursive: true }); } catch { return; }
    const jsonFiles = names.filter(n => typeof n === 'string' && n.endsWith('.json'));
    console.log(`  [2] ${jsonFiles.length} files to read…`);
    let done = 0;
    await runPool(jsonFiles, async (name) => {
      try {
        const raw = await fs.promises.readFile(path.join(config.metadataDir, name), 'utf-8');
        const entry = JSON.parse(raw);
        if (entry?.id) diskCache.set(entry.id, { ...entry, coordinates: undefined, coordinatesSampled: downsample(entry.coordinates) });
      } catch { }
      done++;
      if (done % 200 === 0 || done === jsonFiles.length)
        console.log(`  [2] … ${done}/${jsonFiles.length} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }, 32);
    saveCacheIndex();
    console.log(`  [2] Done — ${diskCache.size} entries, index saved. Next startup will be fast.`);
  }
}

function getCachePath(id) {
  return path.join(config.metadataDir, `${id}.json`);
}

function readCache(id) {
  return diskCache.get(id) ?? null;
}

function downsample(coordinates) {
  if (!coordinates?.length) return undefined;
  const step = Math.max(1, Math.floor(coordinates.length / 200));
  return coordinates
    .filter((_, i) => i % step === 0 || i === coordinates.length - 1)
    .map(c => ({ lat: c.lat, lon: c.lon }));
}

let batchMode = false; // when true, index saves are deferred

function writeCache(id, data) {
  const cachePath = getCachePath(id);
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  diskCache.set(id, { ...data, coordinates: undefined, coordinatesSampled: downsample(data.coordinates) });
  if (!batchMode) saveCacheIndex();
}

const FINGERPRINT_INDEX_PATH = path.join(config.cacheDir, 'fingerprint-index.json');

// In-memory fingerprint index: "filename|size|mtime" -> { id, filename, fileSize, lastModified }
let fingerprintIndex = new Map();

function fingerprintKey(entry) {
  return `${entry.filename}|${entry.fileSize}|${new Date(entry.lastModified).getTime()}`;
}

function saveFingerprintIndex() {
  const obj = Object.fromEntries(fingerprintIndex);
  fs.writeFileSync(FINGERPRINT_INDEX_PATH, JSON.stringify(obj));
}

function loadFingerprintIndex() {
  try {
    const raw = JSON.parse(fs.readFileSync(FINGERPRINT_INDEX_PATH, 'utf-8'));
    fingerprintIndex = new Map(Object.entries(raw));
    console.log(`Fingerprint index loaded: ${fingerprintIndex.size} entries (from index file)`);
  } catch {
    // Index missing or corrupt — rebuild from individual cache files (one-time cost)
    console.log('Fingerprint index not found — rebuilding from individual cache files (one-time cost)…');
    fingerprintIndex = new Map();
    let dir;
    try { dir = fs.readdirSync(config.metadataDir, { recursive: true }); } catch { return; }
    const jsonFiles = dir.filter(n => n.endsWith('.json'));
    console.log(`  Reading ${jsonFiles.length} cache files…`);
    let done = 0;
    for (const name of jsonFiles) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(config.metadataDir, name), 'utf-8'));
        fingerprintIndex.set(fingerprintKey(entry), { id: entry.id, filename: entry.filename, fileSize: entry.fileSize, lastModified: entry.lastModified });
      } catch { continue; }
      done++;
      if (done % 200 === 0) console.log(`  … ${done}/${jsonFiles.length}`);
    }
    saveFingerprintIndex();
    console.log(`Fingerprint index rebuilt: ${fingerprintIndex.size} entries — saved to disk, next startup will be fast.`);
  }
}

function deleteCache(id) {
  const cachePath = getCachePath(id);
  try { if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); } catch { }
  diskCache.delete(id);
  for (const [key, val] of fingerprintIndex) {
    if (val.id === id) { fingerprintIndex.delete(key); break; }
  }
  if (!batchMode) { saveCacheIndex(); saveFingerprintIndex(); }
}

function findCacheByFingerprint(file) {
  const key = fingerprintKey(file);
  const match = fingerprintIndex.get(key);
  if (!match) return null;
  // Load the full entry from disk
  const entry = readCache(match.id);
  return entry ? { entry, oldId: match.id } : null;
}

function runInWorker(file, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_PATH, { workerData: { file } });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error(`Timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
    worker.on('message', (msg) => {
      clearTimeout(timer);
      worker.terminate();
      if (msg.ok) resolve(msg.result);
      else reject(new Error(msg.error));
    });
    worker.on('error', (err) => { clearTimeout(timer); reject(err); });
    worker.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

async function processVideo(file, prefix) {
  const sizeGb = (file.fileSize / 1e9).toFixed(2);
  // Fixed 10-minute timeout per file (network share needs generous headroom)
  const timeoutMs = 600_000;
  console.log(`${prefix} Extracting GPS from video: ${file.relativePath} (${sizeGb} GB, timeout: ${timeoutMs / 1000}s)`);

  const startMs = Date.now();
  const heartbeat = setInterval(() => {
    console.log(`${prefix}   ... still extracting ${file.filename} (${Math.round((Date.now() - startMs) / 1000)}s elapsed)`);
  }, 15_000);

  let telemetry;
  try {
    telemetry = await runInWorker(file, timeoutMs);
  } finally {
    clearInterval(heartbeat);
  }
  console.log(`${prefix} Extraction done in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);

  if (telemetry) {
    const entry = {
      id: file.id,
      filename: file.filename,
      filepath: file.filepath,
      relativePath: file.relativePath,
      subfolder: file.subfolder,
      fileSize: file.fileSize,
      lastModified: file.lastModified,
      type: 'video',
      ...telemetry,
    };
    writeCache(file.id, entry);
    mediaIndex.set(file.id, entry);
    allMediaIndex.set(file.id, entry);

    try {
      await generateThumbnail(file.filepath, file.id);
      thumbnailSet.add(file.id);
    } catch (err) {
      console.log(`  Thumbnail failed: ${err.message}${err.stderr ? '\n' + err.stderr : ''}`);
    }

    invalidate();
    console.log(`  -> ${telemetry.totalPoints} GPS points`);
    return 'extracted';
  } else {
    const entry = {
      id: file.id,
      filename: file.filename,
      filepath: file.filepath,
      relativePath: file.relativePath,
      subfolder: file.subfolder,
      fileSize: file.fileSize,
      lastModified: file.lastModified,
      type: 'video',
      noGps: true,
    };
    writeCache(file.id, entry);
    allMediaIndex.set(file.id, entry);
    console.log(`  -> No GPS data`);
    return 'noGps';
  }
}

async function processPhoto(file, prefix) {
  console.log(`${prefix} Reading EXIF from photo: ${file.relativePath}`);

  const gps = await runInWorker(file, 30_000);

  if (gps) {
    const entry = {
      id: file.id,
      filename: file.filename,
      filepath: file.filepath,
      relativePath: file.relativePath,
      subfolder: file.subfolder,
      fileSize: file.fileSize,
      lastModified: file.lastModified,
      type: 'photo',
      ...gps,
    };
    writeCache(file.id, entry);
    mediaIndex.set(file.id, entry);
    allMediaIndex.set(file.id, entry);
    invalidate();
    console.log(`  -> GPS: ${gps.startPoint.lat.toFixed(5)}, ${gps.startPoint.lon.toFixed(5)}`);
    return 'extracted';
  } else {
    const entry = {
      id: file.id,
      filename: file.filename,
      filepath: file.filepath,
      relativePath: file.relativePath,
      subfolder: file.subfolder,
      fileSize: file.fileSize,
      lastModified: file.lastModified,
      type: 'photo',
      noGps: true,
    };
    writeCache(file.id, entry);
    allMediaIndex.set(file.id, entry);
    invalidate();
    return 'noGps';
  }
}

// Run up to `concurrency` async tasks at once.
async function runPool(items, fn, concurrency) {
  const iter = items[Symbol.iterator]();
  async function worker() {
    for (let next = iter.next(); !next.done; next = iter.next()) {
      await fn(next.value);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
}

// How many files to process in parallel.
// Videos each spawn an ffmpeg process, so keep this modest.
const CACHE_CONCURRENCY = parseInt(process.env.CACHE_CONCURRENCY, 10) || 4;

// Phase 1: load existing cache entries into memory — fast, runs before server is ready.
export async function loadCache() {
  ensureDirs();
  const t0 = Date.now();
  const ts = () => `[+${((Date.now() - t0) / 1000).toFixed(1)}s]`;

  console.log(`${ts()} Loading fingerprint index…`);
  loadFingerprintIndex();

  console.log(`${ts()} Starting in parallel:`);
  console.log(`  [1] Scanning: ${config.mediaDir}`);
  console.log(`  [2] Loading cache: ${config.metadataDir}`);

  const [mediaFiles] = await Promise.all([
    scanMediaDirectory().then(files => {
      console.log(`${ts()} [1] Scan done — ${files.filter(f => f.type === 'video').length} videos, ${files.filter(f => f.type === 'photo').length} photos`);
      return files;
    }),
    loadAllCacheEntries(),
  ]);
  console.log(`${ts()} Both complete — ${mediaFiles.length} media files on disk, ${diskCache.size} cache entries in memory`);

  if (mediaFiles.length === 0) {
    console.log('No media files found.');
    return [];
  }

  console.log(`${ts()} Matching files against cache…`);
  let cached = 0, relocated = 0;
  const toProcess = [];

  batchMode = true; // defer index saves until all relocations are done
  try {
    for (const file of mediaFiles) {
      let cacheEntry = readCache(file.id);
      const mtimeMatch = cacheEntry && Math.abs(
        new Date(cacheEntry.lastModified).getTime() - new Date(file.lastModified).getTime()
      ) < 1000;

      if (cacheEntry && cacheEntry.fileSize === file.fileSize && mtimeMatch) {
        cacheEntry.filepath = file.filepath;
        allMediaIndex.set(file.id, cacheEntry);
        if (!cacheEntry.noGps) mediaIndex.set(file.id, cacheEntry);
        cached++;
        continue;
      }

      const found = findCacheByFingerprint(file);
      if (found && found.entry.type === file.type) {
        const { entry: oldEntry, oldId } = found;
        console.log(`  Relocated: ${oldEntry.relativePath} → ${file.relativePath}`);
        const updatedEntry = {
          ...oldEntry,
          id: file.id,
          filepath: file.filepath,
          relativePath: file.relativePath,
          subfolder: file.subfolder,
        };
        writeCache(file.id, updatedEntry);
        if (oldId !== file.id) deleteCache(oldId);
        allMediaIndex.set(file.id, updatedEntry);
        if (!updatedEntry.noGps) mediaIndex.set(file.id, updatedEntry);
        cached++;
        relocated++;
        continue;
      }

      toProcess.push(file);
    }
  } finally {
    batchMode = false;
    if (relocated > 0) {
      console.log(`${ts()} Saving indexes after ${relocated} relocations…`);
      saveCacheIndex();
      saveFingerprintIndex();
    }
  }

  const videos = toProcess.filter(f => f.type === 'video').length;
  const photos = toProcess.filter(f => f.type === 'photo').length;
  console.log(`${ts()} Cache load complete:`);
  console.log(`  ${cached} cached (${relocated} relocated), ${toProcess.length} new (${videos} videos, ${photos} photos)`);
  console.log(`  ${mediaIndex.size} items with GPS ready to serve`);
  console.log(`  ${thumbnailSet.size} thumbnails indexed`);
  return toProcess;
}

// Phase 2: extract GPS from new files — slow, runs in background after server is ready.
export async function processNewFiles(toProcess) {
  if (toProcess.length === 0) return;

  console.log(`\nBackground cache update: processing ${toProcess.length} new files (concurrency: ${CACHE_CONCURRENCY})…`);
  let extracted = 0, noGps = 0, errors = 0, done = 0;

  await runPool(toProcess, async (file) => {
    const idx = ++done;
    const prefix = `[${idx}/${toProcess.length}]`;
    try {
      const result = file.type === 'video'
        ? await processVideo(file, prefix)
        : await processPhoto(file, prefix);
      if (result === 'extracted') extracted++;
      else noGps++;
    } catch (err) {
      console.error(`${prefix} Error processing ${file.relativePath}: ${err.message}`);
      const entry = {
        id: file.id, filename: file.filename, filepath: file.filepath,
        relativePath: file.relativePath, subfolder: file.subfolder,
        fileSize: file.fileSize, lastModified: file.lastModified,
        type: file.type, noGps: true, error: err.message,
      };
      writeCache(file.id, entry);
      allMediaIndex.set(file.id, entry);
      errors++;
    }
  }, CACHE_CONCURRENCY);

  console.log(`\nBackground cache update complete:`);
  console.log(`  ${extracted} extracted, ${noGps} no GPS, ${errors} errors`);
  console.log(`  ${mediaIndex.size} total items with GPS on map`);
}

export async function generateMissingThumbnails() {
  const missing = Array.from(allMediaIndex.values()).filter(
    e => e.type === 'video' && !e.noGps && !thumbnailSet.has(e.id)
  );
  if (missing.length === 0) return;
  console.log(`\nThumbnail backfill: ${missing.length} videos missing thumbnails…`);
  let done = 0, failed = 0;
  await runPool(missing, async (entry) => {
    try {
      await generateThumbnail(entry.filepath, entry.id);
      thumbnailSet.add(entry.id);
      invalidate();
      done++;
    } catch {
      failed++;
    }
  }, CACHE_CONCURRENCY);
  console.log(`Thumbnail backfill complete: ${done} generated, ${failed} failed`);
}

export function getMediaItems() {
  if (!mediaItemsDirty) return cachedMediaItems;
  cachedMediaItems = Array.from(mediaIndex.values())
    .filter(v => !v.noGps && v.startPoint)
    .map(v => ({
      id: v.id,
      filename: v.filename,
      subfolder: v.subfolder,
      type: v.type,
      camera: v.camera || null,
      startPoint: v.startPoint,
      endPoint: v.endPoint || null,
      duration: v.duration || null,
      totalPoints: v.totalPoints || null,
      startDate: v.startDate || null,
      altitude: v.altitude || null,
      hasThumbnail: v.type === 'video' ? thumbnailSet.has(v.id) : true,
    }));
  mediaItemsDirty = false;
  return cachedMediaItems;
}

export function getMediaItemsForExport() {
  // Returns full entries including coordinates, for KML/GPX export
  return Array.from(allMediaIndex.values())
    .filter(v => !v.noGps && v.startPoint)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function getAllMediaItems() {
  if (!allMediaItemsDirty) return cachedAllMediaItems;
  cachedAllMediaItems = Array.from(allMediaIndex.values())
    .map(v => ({
      id: v.id,
      filename: v.filename,
      subfolder: v.subfolder,
      relativePath: v.relativePath,
      type: v.type,
      camera: v.camera || null,
      fileSize: v.fileSize,
      lastModified: v.lastModified,
      noGps: v.noGps || false,
      error: v.error || null,
      startPoint: v.startPoint || null,
      endPoint: v.endPoint || null,
      startDate: v.startDate || null,
      duration: v.duration || null,
      totalPoints: v.totalPoints || null,
      altitude: v.altitude || null,
      hasThumbnail: v.type === 'video' ? thumbnailSet.has(v.id) : !v.noGps,
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  allMediaItemsDirty = false;
  return cachedAllMediaItems;
}

export function getAllVideoTracks() {
  if (!allTracksDirty) return cachedAllTracks;
  cachedAllTracks = Array.from(mediaIndex.values())
    .filter(v => !v.noGps && v.type === 'video' && v.coordinatesSampled?.length > 0)
    .map(v => ({ id: v.id, coordinates: v.coordinatesSampled }));
  allTracksDirty = false;
  return cachedAllTracks;
}

export function getVideoTelemetry(id) {
  const entry = mediaIndex.get(id);
  if (!entry || entry.noGps || entry.type !== 'video') return null;
  // Load full coordinates from individual cache file on demand
  let coordinates = null;
  try {
    const full = JSON.parse(fs.readFileSync(getCachePath(id), 'utf-8'));
    coordinates = full.coordinates ?? null;
  } catch { }
  return {
    id: entry.id,
    coordinates,
    duration: entry.duration,
    totalPoints: entry.totalPoints,
    startDate: entry.startDate,
  };
}

/**
 * Force re-extraction of GPS for a single media item, bypassing the cache.
 * Useful when the cached GPS coordinates are wrong and need to be reprocessed
 * with the latest filtering logic.
 */
export async function recheckMediaItem(id) {
  const entry = allMediaIndex.get(id);
  if (!entry) return null;

  if (!fs.existsSync(entry.filepath)) {
    return { error: `File not found: ${entry.filepath}` };
  }

  // Rebuild a file descriptor with current disk metadata
  const stat = fs.statSync(entry.filepath);
  const file = {
    id: entry.id,
    filename: entry.filename,
    filepath: entry.filepath,
    relativePath: entry.relativePath,
    subfolder: entry.subfolder,
    fileSize: stat.size,
    lastModified: stat.mtime.toISOString(),
    type: entry.type,
  };

  // Remove stale entries before re-processing
  allMediaIndex.delete(id);
  mediaIndex.delete(id);
  deleteCache(id);

  try {
    const result = file.type === 'video'
      ? await processVideo(file, '[recheck]')
      : await processPhoto(file, '[recheck]');
    const updated = allMediaIndex.get(id);
    return { result, entry: updated };
  } catch (err) {
    const errEntry = { ...file, noGps: true, error: err.message };
    writeCache(id, errEntry);
    allMediaIndex.set(id, errEntry);
    return { error: err.message };
  }
}

export async function auditCache() {
  const mediaFiles = await scanMediaDirectory();
  const missing = [];
  const cached = [];

  for (const file of mediaFiles) {
    if (allMediaIndex.has(file.id)) {
      cached.push(file.id);
    } else {
      missing.push({ id: file.id, relativePath: file.relativePath, type: file.type });
    }
  }

  return {
    totalOnDisk: mediaFiles.length,
    totalCached: cached.length,
    totalMissing: missing.length,
    missing,
  };
}

export function getMediaFilePath(id) {
  const entry = mediaIndex.get(id);
  return entry?.filepath || null;
}

export function getMediaType(id) {
  const entry = mediaIndex.get(id);
  return entry?.type || null;
}

export function getThumbnailPath(id) {
  const entry = mediaIndex.get(id);
  if (!entry) return null;

  // For photos, serve the photo itself as thumbnail
  if (entry.type === 'photo') {
    return entry.filepath;
  }

  return thumbnailSet.has(id) ? path.join(config.thumbnailDir, `${id}.jpg`) : null;
}
