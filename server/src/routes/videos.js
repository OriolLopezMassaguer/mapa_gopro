import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import config from '../config.js';
import { getMediaItems, getAllMediaItems, getMediaItemsForExport, getAllVideoTracks, getVideoTelemetry, getFullMediaEntry, getMediaFilePath, getMediaType, getThumbnailPath, recheckMediaItem, auditCache } from '../services/cacheManager.js';
import { generateKml } from '../services/kmlExporter.js';
import { writeGpxFile } from '../services/gpxExporter.js';
import { streamVideo } from '../services/videoStreamer.js';

const router = Router();

// GET /api/media — list all media with GPS coordinates
router.get('/', (req, res) => {
  const items = getMediaItems();
  res.json(items);
});

// GET /api/media/all — all media including items without GPS
router.get('/all', (req, res) => {
  res.json(getAllMediaItems());
});

// GET /api/media/audit — compare disk vs cache, report missing entries
router.get('/audit', async (req, res) => {
  res.json(await auditCache());
});

// GET /api/media/export.kml — download all GPS tracks as KML
router.get('/export.kml', (req, res) => {
  const items = getMediaItemsForExport();
  const kml = generateKml(items, 'all');
  res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
  res.setHeader('Content-Disposition', 'attachment; filename="gopro-tracks.kml"');
  res.send(kml);
});

// GET /api/media/export-videos.kml — videos only
router.get('/export-videos.kml', (req, res) => {
  const items = getMediaItemsForExport();
  const kml = generateKml(items, 'video');
  res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
  res.setHeader('Content-Disposition', 'attachment; filename="gopro-video-tracks.kml"');
  res.send(kml);
});

// GET /api/media/export-photos.kml — photos only
router.get('/export-photos.kml', (req, res) => {
  const items = getMediaItemsForExport();
  const kml = generateKml(items, 'photo');
  res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
  res.setHeader('Content-Disposition', 'attachment; filename="gopro-photos.kml"');
  res.send(kml);
});

// GET /api/media/export.gpx — all GPS tracks as a combined GPX file
router.get('/export.gpx', (req, res) => {
  const type = req.query.type || 'all'; // all | video | photo
  const items = getMediaItemsForExport().filter(i => type === 'all' || i.type === type);
  const escapeXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tracks = items.filter(i => i.type === 'video' && i.coordinates?.length).map(i => {
    const pts = i.coordinates.map(c => {
      const lines = [`    <trkpt lat="${c.lat}" lon="${c.lon}">`];
      if (c.alt != null) lines.push(`      <ele>${c.alt.toFixed(2)}</ele>`);
      if (c.date) { try { lines.push(`      <time>${new Date(c.date).toISOString()}</time>`); } catch { } }
      lines.push(`    </trkpt>`);
      return lines.join('\n');
    }).join('\n');
    return `  <trk>\n    <name>${escapeXml(i.filename)}</name>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>`;
  });
  const waypoints = items.filter(i => i.type === 'photo' && i.startPoint).map(i => {
    const { lat, lon } = i.startPoint;
    const alt = i.altitude != null ? `\n  <ele>${i.altitude.toFixed(2)}</ele>` : '';
    return `  <wpt lat="${lat}" lon="${lon}">${alt}\n    <name>${escapeXml(i.filename)}</name>\n  </wpt>`;
  });
  const gpx = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="mapa-gopro" xmlns="http://www.topografix.com/GPX/1/1">`,
    `  <metadata><name>GoPro GPS Export</name></metadata>`,
    ...waypoints,
    ...tracks,
    `</gpx>`,
  ].join('\n');
  const filename = type === 'video' ? 'gopro-video-tracks.gpx' : type === 'photo' ? 'gopro-photos.gpx' : 'gopro-tracks.gpx';
  res.setHeader('Content-Type', 'application/gpx+xml');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(gpx);
});

// GET /api/media/tracks — all video GPS tracks (downsampled for map overview)
router.get('/tracks', (req, res) => {
  res.json(getAllVideoTracks());
});

// GET /api/media/:id/export.kml — KML for a single media item
router.get('/:id/export.kml', (req, res) => {
  const cached = path.join(config.kmlDir, `${req.params.id}.kml`);
  if (fs.existsSync(cached)) {
    const entry = getFullMediaEntry(req.params.id);
    const name = entry ? entry.filename.replace(/\.[^.]+$/, '') + '.kml' : `${req.params.id}.kml`;
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    return res.sendFile(cached);
  }
  // Fallback: generate on-the-fly (items cached before this feature was added)
  const entry = getFullMediaEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Item not found or has no GPS' });
  const kml = generateKml([entry]);
  const name = entry.filename.replace(/\.[^.]+$/, '') + '.kml';
  res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(kml);
});

// GET /api/media/:id/export.gpx — GPX for a single media item
router.get('/:id/export.gpx', (req, res) => {
  const cached = path.join(config.gpxDir, `${req.params.id}.gpx`);
  if (fs.existsSync(cached)) {
    const entry = getFullMediaEntry(req.params.id);
    const name = entry ? entry.filename.replace(/\.[^.]+$/, '') + '.gpx' : `${req.params.id}.gpx`;
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    return res.sendFile(cached);
  }
  // Fallback: generate on-the-fly and cache for next time
  const entry = getFullMediaEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Item not found or has no GPS' });
  try { writeGpxFile(entry); } catch { }
  if (fs.existsSync(cached)) {
    const name = entry.filename.replace(/\.[^.]+$/, '') + '.gpx';
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    return res.sendFile(cached);
  }
  res.status(500).json({ error: 'GPX generation failed' });
});

// POST /api/media/:id/recheck — force re-extraction of GPS, bypassing the cache.
// Use when cached GPS coordinates are wrong (e.g. GPS spike or cold-start stale position).
router.post('/:id/recheck', async (req, res) => {
  const outcome = await recheckMediaItem(req.params.id);
  if (!outcome) return res.status(404).json({ error: 'Media item not found' });
  if (outcome.error) return res.status(500).json({ error: outcome.error });
  res.json({ ok: true, result: outcome.result, entry: outcome.entry });
});

// GET /api/media/:id/telemetry — GPS track for a video
router.get('/:id/telemetry', (req, res) => {
  const telemetry = getVideoTelemetry(req.params.id);
  if (!telemetry) {
    return res.status(404).json({ error: 'Telemetry not found' });
  }
  res.json(telemetry);
});

// GET /api/media/:id/stream — stream video or serve photo
router.get('/:id/stream', (req, res) => {
  const filePath = getMediaFilePath(req.params.id);
  if (!filePath) {
    return res.status(404).json({ error: 'Media not found' });
  }

  const type = getMediaType(req.params.id);
  if (type === 'photo') {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.heic': 'image/heic',
    };
    res.type(mimeTypes[ext] || 'image/jpeg').sendFile(filePath);
  } else {
    streamVideo(req, res, filePath);
  }
});

// GET /api/media/:id/thumbnail — thumbnail for videos, full image for photos
router.get('/:id/thumbnail', (req, res) => {
  const thumbPath = getThumbnailPath(req.params.id);
  if (!thumbPath) {
    return res.status(404).json({ error: 'Thumbnail not found' });
  }
  const ext = path.extname(thumbPath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.heic': 'image/heic',
  };
  res.type(mimeTypes[ext] || 'image/jpeg').sendFile(thumbPath);
});

export default router;
