import fs from 'fs';
import path from 'path';
import config from '../config.js';

const VIDEO_EXTS = /\.(mp4|mov)$/i;
const PHOTO_EXTS = /\.(jpg|jpeg|png|heic)$/i;

// Max concurrent readdir calls — keeps network share from being overwhelmed
const SCAN_CONCURRENCY = parseInt(process.env.SCAN_CONCURRENCY, 10) || 16;

async function scanRecursive(dir, results, isTopLevel = false, semaphore) {
  await semaphore.acquire();
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Cannot read directory: ${dir} — ${err.message}`);
    return;
  } finally {
    semaphore.release();
  }

  const subdirs = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (isTopLevel && config.excludedDirs.has(entry.name.toLowerCase())) continue;

    const filepath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      subdirs.push(filepath);
      continue;
    }

    if (!entry.isFile()) continue;

    const isVideo = VIDEO_EXTS.test(entry.name);
    const isPhoto = PHOTO_EXTS.test(entry.name);
    if (!isVideo && !isPhoto) continue;

    if (isPhoto && config.excludePhotoPrefixes.some(p => entry.name.toUpperCase().startsWith(p))) continue;

    // stat needed for size + mtime — batch within the directory to reduce round-trips
    let stat;
    try {
      stat = await fs.promises.stat(filepath);
    } catch {
      continue;
    }

    const relPath = path.relative(config.mediaDir, filepath);
    const id = relPath.replace(/[\\/]/g, '_').replace(/\.[^.]+$/, '');

    results.push({
      id,
      filename: entry.name,
      filepath,
      relativePath: relPath,
      subfolder: path.dirname(relPath) === '.' ? '' : path.dirname(relPath),
      fileSize: stat.size,
      lastModified: stat.mtime.toISOString(),
      type: isVideo ? 'video' : 'photo',
    });
  }

  // Recurse into subdirectories in parallel
  await Promise.all(subdirs.map(sub => scanRecursive(sub, results, false, semaphore)));
}

function makeSemaphore(max) {
  let active = 0;
  const queue = [];
  return {
    acquire() {
      if (active < max) { active++; return Promise.resolve(); }
      return new Promise(resolve => queue.push(resolve));
    },
    release() {
      if (queue.length > 0) { queue.shift()(); }
      else active--;
    },
  };
}

export async function scanMediaDirectory() {
  const dir = config.mediaDir;

  if (!fs.existsSync(dir)) {
    console.error(`Media directory not found: ${dir}`);
    return [];
  }

  const results = [];
  const semaphore = makeSemaphore(SCAN_CONCURRENCY);
  await scanRecursive(dir, results, true, semaphore);

  const videos = results.filter(r => r.type === 'video').length;
  const photos = results.filter(r => r.type === 'photo').length;
  console.log(`Found ${videos} videos and ${photos} photos in ${dir} (parallel scan, concurrency ${SCAN_CONCURRENCY})`);

  return results;
}
