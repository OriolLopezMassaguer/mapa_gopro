import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = process.env.DOTENV_PATH || path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });
// .env.local overrides .env (same convention as Vite/Next.js), never committed
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

const excludeFile = path.resolve(__dirname, '../../scanner-exclude.json');
const excludedDirs = fs.existsSync(excludeFile)
  ? new Set(JSON.parse(fs.readFileSync(excludeFile, 'utf8')).map(d => d.toLowerCase()))
  : new Set();

const excludePhotoPrefixes = (process.env.EXCLUDE_PHOTO_PREFIXES || 'DSC')
  .split(',')
  .map(p => p.trim().toUpperCase())
  .filter(Boolean);

const dataDir = process.env.DATA_DIR || '\\\\babel\\Alpes';
const mediaDir = path.join(dataDir, 'media');
const cacheDir = path.join(dataDir, 'video_cache');

export default {
  dataDir,
  mediaDir,
  port: parseInt(process.env.PORT, 10) || 3001,
  cacheDir,
  metadataDir: path.join(cacheDir, 'metadata'),
  thumbnailDir: path.join(cacheDir, 'thumbnails'),
  gpxDir: path.join(cacheDir, 'gpx'),
  kmlDir: path.join(cacheDir, 'kml'),
  placesDir: path.join(cacheDir, 'places'),
  passesDir: path.join(dataDir, 'passes'),
  tracksDir: path.join(dataDir, 'tracks'),
  excludedDirs,
  excludePhotoPrefixes,
  ffmpegPath: process.env.FFMPEG_PATH || null,
};
