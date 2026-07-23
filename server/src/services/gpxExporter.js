import fs from 'fs';
import path from 'path';
import config from '../config.js';

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toIso(date) {
  if (!date) return null;
  try { return new Date(date).toISOString(); } catch { return null; }
}

function gpxHeader(name) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="mapa-gopro"`,
    `     xmlns="http://www.topografix.com/GPX/1/1"`,
    `     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    `  <metadata><name>${escapeXml(name)}</name></metadata>`,
  ].join('\n');
}

function buildVideoGpx(entry) {
  if (!entry.coordinates?.length) return null;
  const pts = entry.coordinates.map(c => {
    const time = toIso(c.date);
    const lines = [`    <trkpt lat="${c.lat}" lon="${c.lon}">`];
    if (c.alt != null) lines.push(`      <ele>${c.alt.toFixed(2)}</ele>`);
    if (time) lines.push(`      <time>${time}</time>`);
    if (c.speed2d != null) lines.push(`      <extensions><speed>${c.speed2d.toFixed(3)}</speed></extensions>`);
    lines.push(`    </trkpt>`);
    return lines.join('\n');
  }).join('\n');

  return [
    gpxHeader(entry.filename),
    `  <trk>`,
    `    <name>${escapeXml(entry.filename)}</name>`,
    `    <trkseg>`,
    pts,
    `    </trkseg>`,
    `  </trk>`,
    `</gpx>`,
  ].join('\n');
}

function buildPhotoGpx(entry) {
  if (!entry.startPoint) return null;
  const { lat, lon } = entry.startPoint;
  const alt = entry.altitude ?? null;
  const time = toIso(entry.startDate);
  const lines = [`  <wpt lat="${lat}" lon="${lon}">`];
  if (alt != null) lines.push(`    <ele>${alt.toFixed(2)}</ele>`);
  if (time) lines.push(`    <time>${time}</time>`);
  lines.push(`    <name>${escapeXml(entry.filename)}</name>`);
  lines.push(`  </wpt>`);
  return [gpxHeader(entry.filename), lines.join('\n'), `</gpx>`].join('\n');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function writeGpxFile(entry) {
  const gpx = entry.type === 'video' ? buildVideoGpx(entry) : buildPhotoGpx(entry);
  if (!gpx) return;
  ensureDir(config.gpxDir);
  fs.writeFileSync(path.join(config.gpxDir, `${entry.id}.gpx`), gpx, 'utf-8');
}

export function deleteGpxFile(id) {
  try { fs.unlinkSync(path.join(config.gpxDir, `${id}.gpx`)); } catch { }
}
