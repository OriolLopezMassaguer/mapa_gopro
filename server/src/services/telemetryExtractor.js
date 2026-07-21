import fs from 'fs';
import { createRequire } from 'module';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';
import exifr from 'exifr';

const require = createRequire(import.meta.url);

const CHUNKED_THRESHOLD = 500 * 1024 * 1024; // 500 MB — use chunked reading for large files
const IMPOSSIBLE_SPEED_MS = 200; // m/s = 720 km/h — impossible for any ground/air GoPro use
const SPIKE_SPEED_MS = 100;      // m/s = 360 km/h — bilateral threshold for single-point spike removal

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Remove individual GPS spike points from a segment.
 * A spike is a point that requires high speed both to arrive at AND to leave —
 * the classic GPS teleport glitch where a single sample lands far off-track.
 */
function removeSpikePoints(coords) {
  if (coords.length < 3) return coords;

  return coords.filter((point, i) => {
    if (i === 0 || i === coords.length - 1) return true; // always keep endpoints

    const prev = coords[i - 1];
    const next = coords[i + 1];

    const dt_in  = (point.cts - prev.cts) / 1000;
    const dt_out = (next.cts  - point.cts) / 1000;
    if (dt_in < 0.1 || dt_out < 0.1) return true; // too close in time to judge

    const speed_in  = haversineDistance(prev.lat, prev.lon, point.lat, point.lon) / dt_in;
    const speed_out = haversineDistance(point.lat, point.lon, next.lat, next.lon) / dt_out;

    // Both legs fast → isolated spike; remove it
    return !(speed_in > SPIKE_SPEED_MS && speed_out > SPIKE_SPEED_MS);
  });
}

/**
 * Remove GPS points reachable only via impossible speed (GPS teleport glitch).
 * Splits the track into segments at each impossible jump, picks the longest
 * segment (the real recording), then strips any remaining single-point spikes.
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

  let best;
  if (jumpIndices.length === 0) {
    best = coordinates;
  } else {
    // Split into segments at jump boundaries
    const segments = [];
    let start = 0;
    for (const idx of jumpIndices) {
      if (idx > start) segments.push(coordinates.slice(start, idx));
      start = idx;
    }
    segments.push(coordinates.slice(start));

    // Pick the longest segment with > 3 points — the real recording is far longer
    // than GPS glitches or cold-start stale positions regardless of where they appear.
    const valid = segments.filter(seg => seg.length > 3);
    best = valid.length > 0
      ? valid.reduce((a, b) => b.length > a.length ? b : a)
      : segments.reduce((a, b) => b.length > a.length ? b : a);
  }

  // Second pass: remove individual spike points within the chosen segment
  return removeSpikePoints(best);
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

// Matches: Viidure2026/07/18 06:19:31 N:47.239130 E:9.597292 5.3 km/h 5.25 589.20 10 x:...
const VIIDURE_RE = /Viidure(\d{4}\/\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2}) ([NS]):([-\d.]+) ([EW]):([-\d.]+) ([\d.]+) km\/h ([\d.]+) ([\d.]+) (\d+)/;

/**
 * Extract GPS telemetry from an Innov N2 (Viidure) dashcam .ts file.
 * GPS is stored as plain text in a private PES stream (stream_id 0xBF).
 * Format: Viidure{date} {time} N:{lat} E:{lon} {speed_kmh} km/h {speed2} {alt} {sats} x:{ax} y:{ay} z:{az}
 */
async function extractTsDashcamTelemetry(filePath) {
  const buf = await fs.promises.readFile(filePath);
  const samples = [];

  for (let i = 0; i < buf.length - 188; i += 188) {
    if (buf[i] !== 0x47) continue;              // TS sync byte
    if (!(buf[i + 1] & 0x40)) continue;         // payload_unit_start_indicator
    const adaptField = (buf[i + 3] & 0x30) >> 4;
    let offset = 4;
    if (adaptField === 2 || adaptField === 3) offset += buf[i + 4] + 1;
    // Require PES start code + private_stream_2 (0xBF)
    if (buf[i + offset] !== 0x00 || buf[i + offset + 1] !== 0x00 || buf[i + offset + 2] !== 0x01) continue;
    if (buf[i + offset + 3] !== 0xBF) continue;

    const text = buf.slice(i + offset + 6, i + 188).toString('latin1');
    if (!text.startsWith('Viidure')) continue;

    const m = VIIDURE_RE.exec(text);
    if (!m) continue;

    const [, dateStr, timeStr, latHemi, latStr, lonHemi, lonStr, speedKmh, speed2, altStr, sats] = m;
    let lat = parseFloat(latStr);
    let lon = parseFloat(lonStr);
    if (latHemi === 'S') lat = -Math.abs(lat);
    if (lonHemi === 'W') lon = -Math.abs(lon);

    if (lat === 0 && lon === 0) continue; // no GPS lock

    const date = new Date(dateStr.replace(/\//g, '-') + 'T' + timeStr + 'Z');
    samples.push({
      lat,
      lon,
      alt: parseFloat(altStr),
      speed2d: parseFloat(speedKmh) / 3.6,
      speed3d: parseFloat(speed2) / 3.6,
      date,
      dateMs: date.getTime(),
    });
  }

  if (samples.length === 0) return null;

  const startMs = samples[0].dateMs;
  const coordinates = samples.map(s => ({ ...s, cts: s.dateMs - startMs }));
  const filtered = filterGpsOutliers(coordinates);
  if (filtered.length === 0) return null;

  return {
    startPoint: { lat: filtered[0].lat, lon: filtered[0].lon },
    endPoint: { lat: filtered[filtered.length - 1].lat, lon: filtered[filtered.length - 1].lon },
    coordinates: filtered,
    duration: filtered[filtered.length - 1].cts,
    totalPoints: filtered.length,
    startDate: filtered[0].date,
  };
}

/**
 * Extract GPS telemetry from a GoPro video (GPMF format).
 */
export async function extractVideoTelemetry(filePath) {
  if (/\.ts$/i.test(filePath)) return extractTsDashcamTelemetry(filePath);
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

    return {
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
