/**
 * Generate a KML document from cached media items.
 * Videos produce a LineString track; photos produce a Point placemark.
 */
// type: 'all' | 'video' | 'photo'
export function generateKml(mediaItems, type = 'all') {
  const placemarks = mediaItems
    .filter(item => !item.noGps && item.startPoint)
    .filter(item => type === 'all' || item.type === type)
    .map(item => {
      if (item.type === 'video' && item.coordinates?.length) {
        const coords = item.coordinates
          .map(c => `${c.lon},${c.lat},${c.alt ?? 0}`)
          .join('\n          ');
        const date = item.startDate ? new Date(item.startDate).toISOString() : '';
        return `
  <Placemark>
    <name>${escapeXml(item.filename)}</name>
    <description>${escapeXml(item.subfolder || '')}${date ? `\nDate: ${date}` : ''}${item.totalPoints ? `\nGPS points: ${item.totalPoints}` : ''}</description>
    <styleUrl>#videoTrack</styleUrl>
    <LineString>
      <tessellate>1</tessellate>
      <altitudeMode>clampToGround</altitudeMode>
      <coordinates>
          ${coords}
      </coordinates>
    </LineString>
  </Placemark>`;
      } else {
        // Photo or video with only startPoint
        const { lat, lon } = item.startPoint;
        const alt = item.altitude ?? 0;
        const date = item.startDate ? new Date(item.startDate).toISOString() : '';
        return `
  <Placemark>
    <name>${escapeXml(item.filename)}</name>
    <description>${escapeXml(item.subfolder || '')}${date ? `\nDate: ${date}` : ''}</description>
    <styleUrl>#photoPin</styleUrl>
    <Point>
      <altitudeMode>clampToGround</altitudeMode>
      <coordinates>${lon},${lat},${alt}</coordinates>
    </Point>
  </Placemark>`;
      }
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>GoPro GPS Export</name>
  <Style id="videoTrack">
    <LineStyle>
      <color>ff0000ff</color>
      <width>3</width>
    </LineStyle>
  </Style>
  <Style id="photoPin">
    <IconStyle>
      <color>ff0088ff</color>
      <scale>0.8</scale>
    </IconStyle>
  </Style>
${placemarks.join('\n')}
</Document>
</kml>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
