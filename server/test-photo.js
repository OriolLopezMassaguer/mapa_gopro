import exifr from 'exifr';

const photoPath = '\\\\babel\\GoPro\\alpes2025\\GoPro 2025-07-01\\GoPro 2025-07-01\\GOPR3424.JPG';

// Test 1: Full GPS parse (no pick restriction)
console.log('=== Test 1: Full GPS parse ===');
const gps = await exifr.gps(photoPath);
console.log('GPS:', JSON.stringify(gps));

// Test 2: Parse without pick
console.log('\n=== Test 2: Parse without pick, gps enabled ===');
const full = await exifr.parse(photoPath, { gps: true });
const gpsKeys = Object.keys(full || {}).filter(k => k.toLowerCase().includes('gps') || k === 'latitude' || k === 'longitude');
console.log('GPS-related keys:', gpsKeys);
for (const k of gpsKeys) {
  console.log(`  ${k}:`, full[k]);
}

// Test 3: Parse with only gps: true
console.log('\n=== Test 3: exifr.parse with translateValues/reviveValues ===');
const result3 = await exifr.parse(photoPath, {
  gps: true,
  translateValues: true,
  reviveValues: true,
});
console.log('latitude:', result3?.latitude);
console.log('longitude:', result3?.longitude);
