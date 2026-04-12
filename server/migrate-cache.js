/**
 * Cache migration script.
 *
 * Scans the new VIDEO_DIR, matches files to existing cache entries by
 * (filename + fileSize + lastModified), then rewrites cache JSON files and
 * thumbnails with the new IDs/paths — no GPS re-extraction needed.
 *
 * Usage:
 *   node server/migrate-cache.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const VIDEO_DIR   = process.env.VIDEO_DIR || '\\\\babel\\Alpes';
const CACHE_DIR   = path.resolve(__dirname, 'cache-data');
const META_DIR    = path.join(CACHE_DIR, 'metadata');
const THUMB_DIR   = path.join(CACHE_DIR, 'thumbnails');

const VIDEO_EXTS = /\.(mp4|mov)$/i;
const PHOTO_EXTS = /\.(jpg|jpeg|png|heic)$/i;

// ── helpers ──────────────────────────────────────────────────────────────────

function scanRecursive(dir, results) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return; }

  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const filepath = path.join(dir, entry);
    let stat;
    try { stat = fs.statSync(filepath); } catch { continue; }

    if (stat.isDirectory()) { scanRecursive(filepath, results); continue; }
    if (!stat.isFile()) continue;

    const isVideo = VIDEO_EXTS.test(entry);
    const isPhoto = PHOTO_EXTS.test(entry);
    if (!isVideo && !isPhoto) continue;

    const relPath = path.relative(VIDEO_DIR, filepath);
    const id = relPath.replace(/[\\/]/g, '_').replace(/\.[^.]+$/, '');

    results.push({
      id,
      filename: entry,
      filepath,
      relativePath: relPath,
      subfolder: path.dirname(relPath) === '.' ? '' : path.dirname(relPath),
      fileSize: stat.size,
      lastModified: stat.mtime.toISOString(),
      type: isVideo ? 'video' : 'photo',
    });
  }
}

function loadAllCacheEntries() {
  // Returns a lookup: "filename|fileSize|roundedMtime" -> entry
  const lookup = new Map();

  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (!f.endsWith('.json')) continue;
      try {
        const entry = JSON.parse(fs.readFileSync(full, 'utf-8'));
        const key = makeKey(entry.filename, entry.fileSize, entry.lastModified);
        lookup.set(key, { entry, cachePath: full });
      } catch { /* skip corrupt */ }
    }
  };

  walk(META_DIR);
  return lookup;
}

function makeKey(filename, fileSize, lastModified) {
  // Round to nearest second to tolerate copy/move timestamp precision loss
  const ts = Math.round(new Date(lastModified).getTime() / 1000);
  return `${filename}|${fileSize}|${ts}`;
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`Scanning: ${VIDEO_DIR}`);
const newFiles = [];
scanRecursive(VIDEO_DIR, newFiles);
console.log(`Found ${newFiles.length} media files\n`);

console.log(`Loading existing cache from: ${META_DIR}`);
const cacheByKey = loadAllCacheEntries();
console.log(`Loaded ${cacheByKey.size} cache entries\n`);

let migrated = 0;
let alreadyOk = 0;
let noMatch = 0;

for (const file of newFiles) {
  const key = makeKey(file.filename, file.fileSize, file.lastModified);
  const hit = cacheByKey.get(key);

  if (!hit) {
    console.log(`  NO MATCH: ${file.relativePath}`);
    noMatch++;
    continue;
  }

  const { entry, cachePath } = hit;

  // Nothing to do if ID already matches
  if (entry.id === file.id) {
    alreadyOk++;
    continue;
  }

  // Build updated entry
  const updated = {
    ...entry,
    id:           file.id,
    filepath:     file.filepath,
    relativePath: file.relativePath,
    subfolder:    file.subfolder,
  };

  // Write new cache JSON
  const newCachePath = path.join(META_DIR, `${file.id}.json`);
  const newCacheDir  = path.dirname(newCachePath);
  if (!fs.existsSync(newCacheDir)) fs.mkdirSync(newCacheDir, { recursive: true });
  fs.writeFileSync(newCachePath, JSON.stringify(updated, null, 2));

  // Migrate thumbnail (videos only)
  if (file.type === 'video') {
    const oldThumb = path.join(THUMB_DIR, `${entry.id}.jpg`);
    const newThumb = path.join(THUMB_DIR, `${file.id}.jpg`);
    if (fs.existsSync(oldThumb) && !fs.existsSync(newThumb)) {
      fs.copyFileSync(oldThumb, newThumb);
    }
  }

  // Remove old cache file (only if path changed)
  if (cachePath !== newCachePath && fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }

  console.log(`  ${entry.id}`);
  console.log(`    -> ${file.id}`);
  migrated++;
}

console.log(`\nDone.`);
console.log(`  ${migrated} migrated, ${alreadyOk} already up-to-date, ${noMatch} unmatched`);
