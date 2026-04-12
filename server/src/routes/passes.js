import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

const router = Router();

function listGpxFiles() {
  try {
    return fs.readdirSync(config.passesDir)
      .filter(f => f.toLowerCase().endsWith('.gpx'))
      .map(f => ({
        id: encodeURIComponent(f),
        name: f.replace(/\.gpx$/i, ''),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function parseWaypoints(gpxContent) {
  const waypoints = [];
  const wptRegex = /<wpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/wpt>/g;
  const nameRegex = /<name>([^<]*)<\/name>/;
  const eleRegex = /<ele>([^<]*)<\/ele>/;

  let match;
  while ((match = wptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];
    const nameMatch = nameRegex.exec(inner);
    const eleMatch = eleRegex.exec(inner);
    if (!nameMatch) continue;
    waypoints.push({
      name: nameMatch[1].trim(),
      lat,
      lon,
      ele: eleMatch ? Math.round(parseFloat(eleMatch[1])) : null,
    });
  }
  return waypoints;
}

// GET /api/passes — list available GPX files
router.get('/', (req, res) => {
  res.json(listGpxFiles());
});

// GET /api/passes/all — all waypoints from all GPX files
router.get('/all', (req, res) => {
  const files = listGpxFiles();
  const result = [];
  for (const file of files) {
    const filename = decodeURIComponent(file.id);
    const filepath = path.join(config.passesDir, filename);
    try {
      const content = fs.readFileSync(filepath, 'utf-8');
      const waypoints = parseWaypoints(content);
      for (const wpt of waypoints) {
        result.push({ ...wpt, source: file.id, sourceName: file.name });
      }
    } catch {
      // skip unreadable files
    }
  }
  res.json(result);
});

// GET /api/passes/:id — waypoints from a specific GPX file
router.get('/:id', (req, res) => {
  const filename = decodeURIComponent(req.params.id);
  // Prevent path traversal
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filepath = path.join(config.passesDir, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    const content = fs.readFileSync(filepath, 'utf-8');
    res.json(parseWaypoints(content));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
