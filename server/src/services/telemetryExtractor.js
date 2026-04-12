import fs from 'fs';
import { createRequire } from 'module';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';
import exifr from 'exifr';

const require = createRequire(import.meta.url);

const CHUNKED_THRESHOLD = 500 * 1024 * 1024; // 500 MB — use chunked reading for large files
const IMPOSSIBLE_SPEED_MS = 200; // m/s = 720 km/h — impossible for any ground/air GoPro use

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Remove GPS points reachable only via impossible speed (GPS teleport glitch).
 * Splits the track into segments at each impossible jump, then returns the first
 * segment with more than 3 points — which handles both:
 *   - GPS losing lock mid-recording (correct first segment, wrong tail)
 *   - Cold-start stale position (1–3 wrong initial points, correct rest)
 */
function filterGpsOutliers(coordinates) {
  if (coordinates.length <= 3) return coordinates;

  const jumpIndices = [];
  for (let i = 1; i < coordinates.length; i++) {
    const dt = (coordinates[i].cts - coordinates[i - 1].cts) / 1000;
    if (dt < 0.1) continue;
    const dist = haversineDistance(
      coordinates[i - 1].lat, coordinates[i - 1].lon,
      coordinates[i].lat, coordinates[i].lon
    );
    if (dist / dt > IMPOSSIBLE_SPEED_MS) jumpIndices.push(i);
  }

  if (jumpIndices.length === 0) return coordinates;

  // Split into segments at jump boundaries
  const segments = [];
  let start = 0;
  for (const idx of jumpIndices) {
    if (idx > start) segments.push(coordinates.slice(start, idx));
    start = idx;
  }
  segments.push(coordinates.slice(start));

  // Return first segment with > 3 points (skips cold-start stale noise at the beginning)
  for (const seg of segments) {
    if (seg.length > 3) return seg;
  }
  // Fallback: longest segment
  return segments.reduce((best, seg) => seg.length > best.length ? seg : best, segments[0]);
}

/**
 * Extract GPMF data from large files (>500 MB) using mp4box directly in chunks.
 */
function extractGpmfChunked(filePath) {
  const MP4Box = require('mp4box');
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const chunkSize = 64 * 1024 * 1024; // 64 MB chunks — fewer iterations than 2 MB
    const filename = filePath.split(/[\\/]/).pop();

    console.log(`  [chunked] ${filename}: ${(fileSize / 1e9).toFixed(2)} GB, ${Math.ceil(fileSize / chunkSize)} chunks`);

    const mp4boxFile = MP4Box.createFile();
    let trackId = null;
    let nb_samples = 0;
    const timing = {};
    let offset = 0;
    let done = false;
    let chunksRead = 0;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    mp4boxFile.onError = reject;

    mp4boxFile.onReady = function (videoData) {
      const trackSummary = videoData.tracks.map(t => `${t.codec}(${t.nb_samples})`).join(', ');
      console.log(`  [chunked] ${filename}: mp4box ready — tracks: ${trackSummary}`);
      let foundVideo = false;
      for (const track of videoData.tracks) {
        if (track.codec === 'gpmd') {
          trackId = track.id;
          nb_samples = track.nb_samples;
          timing.start = track.created;
          timing.start.setMinutes(timing.start.getMinutes() + timing.start.getTimezoneOffset());
        } else if (
          !foundVideo &&
          (track.type === 'video' || track.name === 'VideoHandler' || track.track_height > 0)
        ) {
          if (track.type === 'video') foundVideo = true;
          timing.videoDuration = track.movie_duration / track.movie_timescale;
          timing.frameDuration = timing.videoDuration / track.nb_samples;
        }
      }
      if (trackId != null) {
        mp4boxFile.setExtractionOptions(trackId, null, { nbSamples: nb_samples });
        mp4boxFile.start();
      } else {
        resolve(null);
      }
    };

    const rawDataArr = [];
    const timingSamples = [];
    mp4boxFile.onSamples = function (id, user, samples) {
      for (const sample of samples) {
        rawDataArr.push(sample.data);
        timingSamples.push({ cts: sample.cts, duration: sample.duration });
      }
      console.log(`  [chunked] ${filename}: samples received ${rawDataArr.length}/${nb_samples}`);
      // Wait until all expected samples have arrived before resolving
      if (nb_samples > 0 && rawDataArr.length < nb_samples) return;

      done = true;
      timing.samples = timingSamples;

      const totalLen = rawDataArr.reduce((s, b) => s + b.byteLength, 0);
      const rawData = new Uint8Array(totalLen);
      let off = 0;
      for (const buf of rawDataArr) {
        rawData.set(new Uint8Array(buf), off);
        off += buf.byteLength;
      }
      resolve({ rawData, timing });
    };

    function resolveFromAccumulated() {
      if (rawDataArr.length > 0) {
        timing.samples = timingSamples;
        const totalLen = rawDataArr.reduce((s, b) => s + b.byteLength, 0);
        const rawData = new Uint8Array(totalLen);
        let off = 0;
        for (const buf of rawDataArr) {
          rawData.set(new Uint8Array(buf), off);
          off += buf.byteLength;
        }
        resolve({ rawData, timing });
      } else {
        resolve(null);
      }
    }

    // Read file in chunks and feed to mp4box (async to avoid blocking the event loop on network shares)
    fs.promises.open(filePath, 'r').then(fh => {
      async function readNextChunk() {
        // Stop immediately if onSamples already resolved the promise
        if (done) {
          await fh.close().catch(() => {});
          return;
        }
        if (offset >= fileSize) {
          await fh.close().catch(() => {});
          mp4boxFile.flush();
          if (!done) resolveFromAccumulated();
          return;
        }
        const end = Math.min(offset + chunkSize, fileSize);
        const buf = Buffer.alloc(end - offset);
        chunksRead++;
        if (chunksRead === 1 || chunksRead % 5 === 0 || chunksRead === totalChunks) {
          console.log(`  [chunked] ${filename}: chunk ${chunksRead}/${totalChunks} (${(offset / 1e9).toFixed(2)} GB)`);
        }
        await fh.read(buf, 0, buf.length, offset);

        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        ab.fileStart = offset;
        mp4boxFile.appendBuffer(ab);
        // Always advance by what we actually read — do NOT use appendBuffer's return value,
        // which can jump over the mdat atom and skip all the sample data.
        offset = end;

        // onSamples may have fired synchronously inside appendBuffer
        if (!done) {
          setImmediate(readNextChunk);
        } else {
          await fh.close().catch(() => {});
        }
      }

      readNextChunk().catch(reject);
    }).catch(reject);
  });
}

/**
 * Extract GPS telemetry from a GoPro video (GPMF format).
 */
export async function extractVideoTelemetry(filePath) {
  const stat = fs.statSync(filePath);
  let extracted;

  if (stat.size >= CHUNKED_THRESHOLD) {
    // Use chunked reading for large files
    extracted = await extractGpmfChunked(filePath);
  } else {
    const fileBuffer = await fs.promises.readFile(filePath);
    extracted = await gpmfExtract(fileBuffer);
  }

  if (!extracted || !extracted.rawData) {
    return null;
  }

  const telemetry = await goproTelemetry(extracted, {
    stream: ['GPS5', 'GPS9'],
    repeatHeaders: true,
    GPSPrecision: 500,
    groupTimes: 1000,
  });

  const deviceId = Object.keys(telemetry)[0];
  if (!deviceId) return null;

  const camera = deviceId || null;
  const streams = telemetry[deviceId]?.streams;
  if (!streams) return null;

  const gpsStream = streams.GPS5 || streams.GPS9 || streams[Object.keys(streams).find(k => k.includes('GPS'))];
  if (!gpsStream?.samples?.length) return null;

  const coordinates = gpsStream.samples
    .filter(s => {
      // Support both named properties (repeatHeaders: true) and value arrays
      if (s.value && s.value.length >= 2) return true;
      if (s['GPS (Lat.) [deg]'] != null && s['GPS (Long.) [deg]'] != null) return true;
      return false;
    })
    .map(sample => {
      // Named properties format (repeatHeaders: true)
      if (sample['GPS (Lat.) [deg]'] != null) {
        return {
          lat: sample['GPS (Lat.) [deg]'],
          lon: sample['GPS (Long.) [deg]'],
          alt: sample['GPS (Alt.) [m]'] || 0,
          speed2d: sample['GPS (2D speed) [m/s]'] || 0,
          speed3d: sample['GPS (3D speed) [m/s]'] || 0,
          cts: sample.cts || 0,
          date: sample.date || null,
        };
      }
      // Value array format
      return {
        lat: sample.value[0],
        lon: sample.value[1],
        alt: sample.value[2] || 0,
        speed2d: sample.value[3] || 0,
        speed3d: sample.value[4] || 0,
        cts: sample.cts || 0,
        date: sample.date || null,
      };
    });

  if (coordinates.length === 0) return null;

  const filtered = filterGpsOutliers(coordinates);

  return {
    camera,
    startPoint: { lat: filtered[0].lat, lon: filtered[0].lon },
    endPoint: { lat: filtered[filtered.length - 1].lat, lon: filtered[filtered.length - 1].lon },
    coordinates: filtered,
    duration: filtered[filtered.length - 1].cts,
    totalPoints: filtered.length,
    startDate: filtered[0].date,
  };
}

/**
 * Extract GPS location from a photo's EXIF data.
 */
export async function extractPhotoGps(filePath) {
  try {
    const exif = await exifr.parse(filePath, {
      gps: true,
      tiff: true,
      exif: true,
    });

    if (!exif || exif.latitude == null || exif.longitude == null) {
      return null;
    }

    const make = exif.Make?.trim() || '';
    const model = exif.Model?.trim() || '';
    const camera = [make, model].filter(Boolean).join(' ') || null;

    return {
      camera,
      startPoint: { lat: exif.latitude, lon: exif.longitude },
      altitude: exif.GPSAltitude || null,
      startDate: exif.DateTimeOriginal || exif.CreateDate || null,
      width: exif.ImageWidth || null,
      height: exif.ImageHeight || null,
    };
  } catch {
    return null;
  }
}
