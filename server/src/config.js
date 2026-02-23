import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default {
  videoDir: process.env.VIDEO_DIR || '\\\\babel\\GoPro\\alpes2025',
  port: parseInt(process.env.PORT, 10) || 3001,
  cacheDir: path.resolve(__dirname, '../cache-data'),
  metadataDir: path.resolve(__dirname, '../cache-data/metadata'),
  thumbnailDir: path.resolve(__dirname, '../cache-data/thumbnails'),
};
