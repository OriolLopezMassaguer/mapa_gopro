import fs from 'fs';
import { createRequire } from 'module';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';
import exifr from 'exifr';

const require = createRequire(import.meta.url);

const CHUNKED_THRESHOLD = 500 * 1024 * 1024; // 500 MB — use chunked reading for large files

/**
 * Extract GPMF data from large files (>500 MB) using mp4box directly in chunks.
 */
function extractGpmfChunked(filePath) {
  const MP4Box = require('mp4box');
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const chunkSize = 64 * 1024 * 1024; // 64 MB chunks — fewer iterations than 2 MB

    const mp4boxFile = MP4Box.createFile();
    let trackId = null;
    let nb_samples = 0;
    const timing = {};
    let offset = 0;
    let done = false;

    mp4boxFile.onError = reject;

    mp4boxFile.onReady = function (videoData) {
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

    // Read file in chunks and feed to mp4box
    const fd = fs.openSync(filePath, 'r');
    function readNextChunk() {
      // Stop immediately if onSamples already resolved the promise
      if (done) {
        try { fs.closeSync(fd); } catch {}
        return;
      }
      if (offset >= fileSize) {
        try { fs.closeSync(fd); } catch {}
        mp4boxFile.flush();
        if (!done) resolveFromAccumulated();
        return;
      }
      const end = Math.min(offset + chunkSize, fileSize);
      const buf = Buffer.alloc(end - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);

      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      ab.fileStart = offset;
      offset = mp4boxFile.appendBuffer(ab);

      // onSamples may have fired synchronously inside appendBuffer
      if (!done) {
        setImmediate(readNextChunk);
      } else {
        try { fs.closeSync(fd); } catch {}
      }
    }

    readNextChunk();
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

  return {
    startPoint: { lat: coordinates[0].lat, lon: coordinates[0].lon },
    endPoint: { lat: coordinates[coordinates.length - 1].lat, lon: coordinates[coordinates.length - 1].lon },
    coordinates,
    duration: coordinates[coordinates.length - 1].cts,
    totalPoints: coordinates.length,
    startDate: coordinates[0].date,
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
