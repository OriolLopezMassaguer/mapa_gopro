import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { scanMediaDirectory } from './scanner.js';
import { extractVideoTelemetry, extractPhotoGps } from './telemetryExtractor.js';
import { generateThumbnail } from './thumbnailGenerator.js';

const mediaIndex = new Map();
const allMediaIndex = new Map();

function ensureDirs() {
  for (const dir of [config.cacheDir, config.metadataDir, config.thumbnailDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function getCachePath(id) {
  return path.join(config.metadataDir, `${id}.json`);
}

function readCache(id) {
  const cachePath = getCachePath(id);
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeCache(id, data) {
  // Ensure subdirectory exists for nested IDs
  const cachePath = getCachePath(id);
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)),
  ]);
}

async function processVideo(file, prefix) {
  console.log(`${prefix} Extracting GPS from video: ${file.relativePath} (${(file.fileSize / 1e9).toFixed(2)} GB)`);

  // Scale timeout with file size: 120s base + 30s per GB
  const timeoutMs = Math.max(120_000, 120_000 + Math.ceil(file.fileSize / 1e9) * 30_000);
  const telemetry = await withTimeout(extractVideoTelemetry(file.filepath), timeoutMs);

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
    } catch (err) {
      console.log(`  Thumbnail failed: ${err.message}`);
    }

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

  const gps = await extractPhotoGps(file.filepath);

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
    console.log(`  -> No GPS data`);
    return 'noGps';
  }
}

export async function initializeCache() {
  ensureDirs();
  const mediaFiles = scanMediaDirectory();

  if (mediaFiles.length === 0) {
    console.log('No media files found. The server will start with no data.');
    return;
  }

  let processed = 0;
  let cached = 0;
  let extracted = 0;
  let noGps = 0;
  let errors = 0;

  for (const file of mediaFiles) {
    processed++;
    const prefix = `[${processed}/${mediaFiles.length}]`;

    // Check cache (compare timestamps within 1s tolerance for copy/move precision loss)
    const cacheEntry = readCache(file.id);
    const mtimeMatch = cacheEntry && Math.abs(
      new Date(cacheEntry.lastModified).getTime() - new Date(file.lastModified).getTime()
    ) < 1000;
    if (
      cacheEntry &&
      cacheEntry.fileSize === file.fileSize &&
      mtimeMatch
    ) {
      // Update filepath in case VIDEO_DIR changed
      cacheEntry.filepath = file.filepath;
      allMediaIndex.set(file.id, cacheEntry);
      if (!cacheEntry.noGps) {
        mediaIndex.set(file.id, cacheEntry);
      }
      cached++;
      continue;
    }

    try {
      let result;
      if (file.type === 'video') {
        result = await processVideo(file, prefix);
      } else {
        result = await processPhoto(file, prefix);
      }
      if (result === 'extracted') extracted++;
      else noGps++;
    } catch (err) {
      console.error(`${prefix} Error processing ${file.relativePath}: ${err.message}`);
      // Cache the error so we don't retry on next restart
      const entry = {
        id: file.id,
        filename: file.filename,
        filepath: file.filepath,
        relativePath: file.relativePath,
        subfolder: file.subfolder,
        fileSize: file.fileSize,
        lastModified: file.lastModified,
        type: file.type,
        noGps: true,
        error: err.message,
      };
      writeCache(file.id, entry);
      allMediaIndex.set(file.id, entry);
      errors++;
    }
  }

  console.log(`\nCache initialization complete:`);
  console.log(`  Total: ${mediaFiles.length} files`);
  console.log(`  ${cached} cached, ${extracted} extracted, ${noGps} no GPS, ${errors} errors`);
  console.log(`  ${mediaIndex.size} items with GPS on map`);
}

export function getMediaItems() {
  return Array.from(mediaIndex.values())
    .filter(v => !v.noGps && v.startPoint)
    .map(v => ({
      id: v.id,
      filename: v.filename,
      subfolder: v.subfolder,
      type: v.type,
      startPoint: v.startPoint,
      endPoint: v.endPoint || null,
      duration: v.duration || null,
      totalPoints: v.totalPoints || null,
      startDate: v.startDate || null,
      altitude: v.altitude || null,
      hasThumbnail: v.type === 'video'
        ? fs.existsSync(path.join(config.thumbnailDir, `${v.id}.jpg`))
        : true, // Photos are their own thumbnails
    }));
}

export function getMediaItemsForExport() {
  // Returns full entries including coordinates, for KML/GPX export
  return Array.from(allMediaIndex.values())
    .filter(v => !v.noGps && v.startPoint)
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function getAllMediaItems() {
  return Array.from(allMediaIndex.values())
    .map(v => ({
      id: v.id,
      filename: v.filename,
      subfolder: v.subfolder,
      relativePath: v.relativePath,
      type: v.type,
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
      hasThumbnail: v.type === 'video'
        ? fs.existsSync(path.join(config.thumbnailDir, `${v.id}.jpg`))
        : !v.noGps,
    }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function getVideoTelemetry(id) {
  const entry = mediaIndex.get(id);
  if (!entry || entry.noGps || entry.type !== 'video') return null;
  return {
    id: entry.id,
    coordinates: entry.coordinates,
    duration: entry.duration,
    totalPoints: entry.totalPoints,
    startDate: entry.startDate,
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

  const thumbPath = path.join(config.thumbnailDir, `${id}.jpg`);
  return fs.existsSync(thumbPath) ? thumbPath : null;
}
