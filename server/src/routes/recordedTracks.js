import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

const router = Router();

function listGpxFiles() {
  try {
    return fs.readdirSync(config.tracksGrabadosDir)
      .filter(f => f.toLowerCase().endsWith('.gpx'))
      .sort();
  } catch {
    return [];
  }
}

function parseTrackPoints(gpxContent) {
  const points = [];
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>(?:[\s\S]*?<ele>([^<]*)<\/ele>)?(?:[\s\S]*?<time>([^<]*)<\/time>)?[\s\S]*?<\/trkpt>/g;
  let match;
  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    points.push({
      lat: parseFloat(match[1]),
      lon: parseFloat(match[2]),
    });
  }
  return points;
}

function downsample(points, maxPoints = 300) {
  if (points.length <= maxPoints) return points;
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

function extractDate(filename) {
  const m = filename.match(/(\d{8})_(\d{6})/);
  if (!m) return null;
  const d = m[1], t = m[2];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`;
}

// GET /api/recorded-tracks — all tracks downsampled for map overview
router.get('/', (req, res) => {
  const files = listGpxFiles();
  const result = [];
  for (const filename of files) {
    const filepath = path.join(config.tracksGrabadosDir, filename);
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const points = parseTrackPoints(content);
      if (points.length < 2) continue;
      result.push({
        id: encodeURIComponent(filename),
        name: filename.replace(/\.gpx$/i, ''),
        date: extractDate(filename),
        coordinates: downsample(points),
      });
    } catch {
      // skip unreadable files
    }
  }
  res.json(result);
});

export default router;
