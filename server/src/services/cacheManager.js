import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { scanMediaDirectory } from './scanner.js';
import { extractVideoTelemetry, extractPhotoGps } from './telemetryExtractor.js';
import { generateThumbnail } from './thumbnailGenerator.js';

const mediaIndex = new Map();

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

async function processVideo(file, prefix) {
  console.log(`${prefix} Extracting GPS from video: ${file.relativePath} (${(file.fileSize / 1e9).toFixed(2)} GB)`);

  const telemetry = await extractVideoTelemetry(file.filepath);

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

    // Check cache
    const cacheEntry = readCache(file.id);
    if (
      cacheEntry &&
      cacheEntry.fileSize === file.fileSize &&
      cacheEntry.lastModified === file.lastModified
    ) {
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
