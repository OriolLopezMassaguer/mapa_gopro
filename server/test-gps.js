import exifr from 'exifr';
import fs from 'fs';

const photoPath = '\\\\babel\\GoPro\\alpes2025\\GoPro 2025-07-01\\GoPro 2025-07-01\\GOPR3424.JPG';

console.log('Testing photo GPS extraction...');
console.log('Path:', photoPath);
console.log('Exists:', fs.existsSync(photoPath));

try {
  const result = await exifr.parse(photoPath, {
    gps: true,
    pick: ['latitude', 'longitude', 'GPSAltitude', 'DateTimeOriginal', 'CreateDate'],
  });
  console.log('EXIF result:', JSON.stringify(result, null, 2));
} catch (e) {
  console.error('EXIF error:', e.message);
}

// Also test a small video
const videoDir = '\\\\babel\\GoPro\\alpes2025';
const entries = fs.readdirSync(videoDir, { recursive: true });
const smallVideo = entries.find(e => /\.mp4$/i.test(e));
if (smallVideo) {
  const videoPath = videoDir + '\\' + smallVideo;
  const stat = fs.statSync(videoPath);
  console.log(`\nTesting video: ${smallVideo} (${(stat.size / 1e6).toFixed(1)} MB)`);
  
  if (stat.size < 2 * 1024 * 1024 * 1024) {
    try {
      const { default: gpmfExtract } = await import('gpmf-extract');
      const { default: goproTelemetry } = await import('gopro-telemetry');
      
      const buf = fs.readFileSync(videoPath);
      console.log('Buffer size:', buf.length);
      
      const extracted = await gpmfExtract(buf);
      console.log('GPMF extracted:', !!extracted, 'rawData:', !!extracted?.rawData);
      
      // Try without stream filter first
      const telemetry = await goproTelemetry(extracted, {
        repeatHeaders: true,
        GPSFix: 2,
        GPSPrecision: 500,
        groupTimes: 1000,
      });
      
      const deviceId = Object.keys(telemetry)[0];
      console.log('Device ID:', deviceId);
      
      if (deviceId) {
        const streams = telemetry[deviceId]?.streams;
        console.log('Available streams:', Object.keys(streams || {}));
        
        for (const [key, stream] of Object.entries(streams || {})) {
          if (key.includes('GPS')) {
            console.log(`  ${key}: ${stream?.samples?.length || 0} samples`);
            if (stream?.samples?.length > 0) {
              console.log(`  First sample:`, JSON.stringify(stream.samples[0]));
            }
          }
        }
      }
    } catch (e) {
      console.error('Video error:', e.message);
    }
  } else {
    console.log('  Skipping (> 2 GiB)');
  }
}
