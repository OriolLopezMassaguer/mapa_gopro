import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = process.env.DOTENV_PATH || path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const excludeFile = path.resolve(__dirname, '../../scanner-exclude.json');
const excludedDirs = fs.existsSync(excludeFile)
  ? new Set(JSON.parse(fs.readFileSync(excludeFile, 'utf8')).map(d => d.toLowerCase()))
  : new Set();

const excludePhotoPrefixes = (process.env.EXCLUDE_PHOTO_PREFIXES || 'DSC')
  .split(',')
  .map(p => p.trim().toUpperCase())
  .filter(Boolean);

const videoDir = process.env.VIDEO_DIR || '\\\\babel\\Alpes';
const mediaDir = path.join(videoDir, process.env.MEDIA_SUBDIR || 'media');
const cacheDir = path.join(videoDir, 'video_cache');

export default {
  videoDir,
  mediaDir,
  port: parseInt(process.env.PORT, 10) || 3001,
  cacheDir,
  metadataDir: path.join(cacheDir, 'metadata'),
  thumbnailDir: path.join(cacheDir, 'thumbnails'),
  passesDir: path.resolve(__dirname, '../../passes'),
  excludedDirs,
  excludePhotoPrefixes,
};
