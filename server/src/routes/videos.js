import { Router } from 'express';
import path from 'path';
import { getMediaItems, getAllMediaItems, getMediaItemsForExport, getVideoTelemetry, getMediaFilePath, getMediaType, getThumbnailPath } from '../services/cacheManager.js';
import { generateKml } from '../services/kmlExporter.js';
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
