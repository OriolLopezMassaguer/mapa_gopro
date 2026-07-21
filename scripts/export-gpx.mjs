/**
 * Scans VIDEO_DIR for all videos, extracts GPS telemetry, and writes one GPX
 * file per video into a tracks-videos/ folder.
 * Usage: node scripts/export-gpx.mjs [output-dir]
 * Output defaults to ./tracks-videos/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { extractVideoTelemetry } from '../server/src/services/telemetryExtractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const videoDir  = process.env.VIDEO_DIR;
const mediaSubdir = process.env.MEDIA_SUBDIR || 'media';
if (!videoDir) {
  console.error('VIDEO_DIR is not set. Create a .env.local file with VIDEO_DIR=<path>');
  process.exit(1);
}

const mediaDir  = path.join(videoDir, mediaSubdir);
const outputDir = process.argv[2] || path.join(root, 'tracks-videos');
const VIDEO_EXTS = /\.(mp4|mov|ts)$/i;

fs.mkdirSync(outputDir, { recursive: true });

// Recursively collect all video files
function collectVideos(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectVideos(full));
    else if (entry.isFile() && VIDEO_EXTS.test(entry.name)) results.push(full);
  }
  return results;
}

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

function buildTrack(name, coords) {
  const pts = coords.map(c => {
    const time = toIso(c.date);
    return [
      `      <trkpt lat="${c.lat}" lon="${c.lon}">`,
      c.alt != null ? `        <ele>${c.alt.toFixed(2)}</ele>` : null,
      time       ? `        <time>${time}</time>`              : null,
      c.speed2d != null ? `        <extensions><speed>${c.speed2d.toFixed(3)}</speed></extensions>` : null,
      `      </trkpt>`,
    ].filter(Boolean).join('\n');
  }).join('\n');

  return [
    `  <trk>`,
    `    <name>${escapeXml(name)}</name>`,
    `    <trkseg>`,
    pts,
    `    </trkseg>`,
    `  </trk>`,
  ].join('\n');
}

// --- main ---

const videos = collectVideos(mediaDir);
console.log(`Found ${videos.length} video(s) in ${mediaDir}`);
console.log(`Output directory: ${outputDir}\n`);

let ok = 0, skipped = 0;

for (const filePath of videos) {
  const name = path.basename(filePath);
  process.stdout.write(`  ${name} … `);
  try {
    const result = await extractVideoTelemetry(filePath);
    if (!result || result.coordinates.length === 0) {
      console.log('no GPS');
      skipped++;
    } else {
      console.log(`${result.coordinates.length} points`);
      const gpx = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<gpx version="1.1" creator="mapa-gopro"`,
        `     xmlns="http://www.topografix.com/GPX/1/1"`,
        `     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
        `     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
        buildTrack(name, result.coordinates),
        `</gpx>`,
      ].join('\n');
      const gpxName = name.replace(/\.[^.]+$/, '.gpx');
      fs.writeFileSync(path.join(outputDir, gpxName), gpx, 'utf8');
      ok++;
    }
  } catch (err) {
    console.log(`error: ${err.message}`);
    skipped++;
  }
}

console.log(`\nWrote ${ok} GPX file(s) to ${outputDir}/  (${skipped} skipped)`);
