import fs from 'fs';
import path from 'path';
import config from '../config.js';

const VIDEO_EXTS = /\.(mp4|mov)$/i;
const PHOTO_EXTS = /\.(jpg|jpeg|png|heic)$/i;

function scanRecursive(dir, results) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    console.error(`Cannot read directory: ${dir} — ${err.message}`);
    return;
  }

  for (const entry of entries) {
    // Skip hidden files and Synology system directories/files
    if (entry.startsWith('.')) continue;

    const filepath = path.join(dir, entry);
    let stat;
    try {
      stat = fs.statSync(filepath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      scanRecursive(filepath, results);
      continue;
    }

    if (!stat.isFile()) continue;

    const isVideo = VIDEO_EXTS.test(entry);
    const isPhoto = PHOTO_EXTS.test(entry);
    if (!isVideo && !isPhoto) continue;

    // Build a unique ID from the relative path (handles same filename in different folders)
    const relPath = path.relative(config.videoDir, filepath);
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

export function scanMediaDirectory() {
  const dir = config.videoDir;

  if (!fs.existsSync(dir)) {
    console.error(`Media directory not found: ${dir}`);
    return [];
  }

  const results = [];
  scanRecursive(dir, results);

  const videos = results.filter(r => r.type === 'video').length;
  const photos = results.filter(r => r.type === 'photo').length;
  console.log(`Found ${videos} videos and ${photos} photos in ${dir} (recursive)`);

  return results;
}
