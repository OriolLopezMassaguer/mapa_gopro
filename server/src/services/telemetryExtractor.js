import fs from 'fs';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';
import exifr from 'exifr';

/**
 * Extract GPS telemetry from a GoPro video (GPMF format).
 */
export async function extractVideoTelemetry(filePath) {
  const fileBuffer = fs.readFileSync(filePath);

  const extracted = await gpmfExtract(fileBuffer);

  if (!extracted || !extracted.rawData) {
    return null;
  }

  const telemetry = await goproTelemetry(extracted, {
    stream: ['GPS5'],
    repeatHeaders: true,
    GPSFix: 2,
    GPSPrecision: 500,
    groupTimes: 1000,
  });

  const deviceId = Object.keys(telemetry)[0];
  if (!deviceId) return null;

  const streams = telemetry[deviceId]?.streams;
  if (!streams) return null;

  const gpsStream = streams.GPS5 || streams[Object.keys(streams).find(k => k.includes('GPS'))];
  if (!gpsStream?.samples?.length) return null;

  const coordinates = gpsStream.samples
    .filter(s => s.value && s.value.length >= 2)
    .map(sample => ({
      lat: sample.value[0],
      lon: sample.value[1],
      alt: sample.value[2] || 0,
      speed2d: sample.value[3] || 0,
      speed3d: sample.value[4] || 0,
      cts: sample.cts || 0,
      date: sample.date || null,
    }));

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
      pick: ['latitude', 'longitude', 'GPSAltitude', 'DateTimeOriginal', 'CreateDate', 'ImageWidth', 'ImageHeight'],
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
