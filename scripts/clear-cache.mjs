/**
 * Clears the video cache so the server rebuilds it from scratch on next start.
 * Deletes: metadata JSON files, thumbnails, cache-index.json, fingerprint-index.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const videoDir = process.env.VIDEO_DIR;
if (!videoDir) {
  console.error('VIDEO_DIR is not set. Create a .env.local file with VIDEO_DIR=<path>');
  process.exit(1);
}

const cacheDir = path.join(videoDir, 'video_cache');

if (!fs.existsSync(cacheDir)) {
  console.log('Cache directory does not exist:', cacheDir);
  console.log('Nothing to clear.');
  process.exit(0);
}

let deleted = 0;

function clearDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    deleted++;
  }
}

clearDir(path.join(cacheDir, 'metadata'));
clearDir(path.join(cacheDir, 'thumbnails'));

for (const f of ['cache-index.json', 'fingerprint-index.json']) {
  const p = path.join(cacheDir, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    deleted++;
  }
}

console.log(`Cleared ${deleted} cache files from ${cacheDir}`);
console.log('Restart the server to rebuild the cache.');
