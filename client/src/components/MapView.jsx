import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, Tooltip, useMap } from 'react-leaflet';
import { Fragment } from 'react';
import L from 'leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { getThumbnailUrl } from '../services/api';

// Fix Leaflet default marker icon paths for bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function getItemYear(item) {
  return item.startDate ? new Date(item.startDate).getFullYear() : null;
}

function getColor(item, yearColorMap) {
  const year = getItemYear(item);
  return (year && yearColorMap[year]) || '#6b7280';
}

function createVideoIcon(color, isSelected) {
  const s = isSelected ? 28 : 24;
  const stroke = isSelected ? 'white' : 'rgba(255,255,255,0.85)';
  const sw = isSelected ? 2.5 : 1.5;
  return new L.DivIcon({
    className: '',
    iconSize: [s, s + 12],
    iconAnchor: [s / 2, s + 12],
    popupAnchor: [0, -(s + 14)],
    html: `<svg width="${s}" height="${s + 12}" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1C6.477 1 2 5.477 2 11c0 7.5 10 23 10 23s10-15.5 10-23C22 5.477 17.523 1 12 1z" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <polygon points="9,7 18,11 9,15" fill="white" fill-opacity="0.9"/>
    </svg>`,
  });
}

function createPhotoIcon(color, isSelected) {
  const size = isSelected ? 18 : 14;
  const border = isSelected ? 3 : 2;
  const total = size + border * 2;
  return new L.DivIcon({
    className: '',
    iconSize: [total, total],
    iconAnchor: [total / 2, total / 2],
    popupAnchor: [0, -(total / 2 + 4)],
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:${border}px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  });
}

function createVideoEndIcon(color, isSelected) {
  const s = isSelected ? 26 : 22;
  const stroke = isSelected ? 'white' : 'rgba(255,255,255,0.85)';
  const sw = isSelected ? 2.5 : 1.5;
  return new L.DivIcon({
    className: '',
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    popupAnchor: [0, -(s / 2 + 4)],
    html: `<svg width="${s}" height="${s}" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="20" height="20" rx="4" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <rect x="6" y="6" width="10" height="10" rx="1.5" fill="white" fill-opacity="0.9"/>
    </svg>`,
  });
}

function getIcon(item, isSelected, yearColorMap) {
  const color = getColor(item, yearColorMap);
  if (item.type === 'photo') return createPhotoIcon(color, isSelected);
  return createVideoIcon(color, isSelected);
}

function createPassIcon() {
  return new L.DivIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
    html: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <polygon points="10,1 19,18 1,18" fill="#7c3aed" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
      <line x1="10" y1="7" x2="10" y2="14" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  });
}

const PASS_ICON = createPassIcon();

function FitBounds({ track, selectedItem, mediaItems, passWaypoints, recordedTracks, recordedTrackDate }) {
  const map = useMap();

  useEffect(() => {
    if (track?.coordinates?.length > 1) {
      const bounds = track.coordinates.map(c => [c.lat, c.lon]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (selectedItem?.startPoint) {
      map.setView([selectedItem.startPoint.lat, selectedItem.startPoint.lon], 15);
    }
  }, [track, selectedItem, map]);

  useEffect(() => {
    if (selectedItem) return;
    const pts = [
      ...mediaItems.filter(v => v.startPoint).map(v => [v.startPoint.lat, v.startPoint.lon]),
      ...passWaypoints.map(w => [w.lat, w.lon]),
    ];
    if (pts.length > 0) map.fitBounds(pts, { padding: [50, 50] });
  }, [mediaItems, passWaypoints, selectedItem, map]);

  // Zoom to recorded tracks when the date filter changes (including "All")
  useEffect(() => {
    if (!recordedTracks?.length) return;
    const pts = recordedTracks.flatMap(t => t.coordinates.map(c => [c.lat, c.lon]));
    if (pts.length > 0) map.fitBounds(pts, { padding: [40, 40] });
  }, [recordedTrackDate, recordedTracks, map]);

  return null;
}

export default function MapView({ mediaItems, selectedItem, track, allTracks, onSelectItem, yearColorMap = {}, regions = [], filterRegion = null, passWaypoints = [], recordedTracks = [], recordedTrackDate = null }) {
  const defaultCenter = [45.9, 6.9];

  // Only show tracks for items currently visible
  const visibleIds = new Set(mediaItems.map(i => i.id));
  const filteredTracks = allTracks.filter(t => visibleIds.has(t.id));

  // Unique years in current mediaItems for legend
  const legendYears = [...new Set(
    mediaItems.filter(i => i.startDate).map(i => new Date(i.startDate).getFullYear())
  )].sort();

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer center={defaultCenter} zoom={10} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds track={track} selectedItem={selectedItem} mediaItems={mediaItems} passWaypoints={passWaypoints} recordedTracks={recordedTracks} recordedTrackDate={recordedTrackDate} />

        {regions.map(r => {
          const isActive = filterRegion === r.id;
          return (
            <Rectangle
              key={r.id}
              bounds={[[r.minLat, r.minLon], [r.maxLat, r.maxLon]]}
              pathOptions={isActive
                ? { color: '#374151', weight: 2, fillColor: '#374151', fillOpacity: 0.08, dashArray: null }
                : { color: '#9ca3af', weight: 1.5, fillColor: '#6b7280', fillOpacity: 0.04, dashArray: '6 4' }
              }
            >
              <Tooltip sticky>{r.name}</Tooltip>
            </Rectangle>
          );
        })}

        {(() => {
          const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          const allSameDay = recordedTrackDate != null;
          return recordedTracks.map(t => {
            const positions = t.coordinates.map(c => [c.lat, c.lon]);
            if (!t.date || positions.length === 0) return null;
            const d = new Date(t.date);
            const dateLabel = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
            const timeLabel = t.date.slice(11, 16);
            const pinLabel = allSameDay ? timeLabel : dateLabel;
            return (
              <Fragment key={`rec-${t.id}`}>
                <Polyline
                  positions={positions}
                  pathOptions={{ color: '#f97316', weight: 3, opacity: 0.75, dashArray: '8 5' }}
                >
                  <Tooltip sticky>{dateLabel} {timeLabel}</Tooltip>
                </Polyline>
                <Marker
                  position={positions[0]}
                  icon={new L.DivIcon({
                    className: '',
                    iconSize: [0, 0],
                    iconAnchor: [0, 8],
                    html: `<div style="background:#f97316;color:#fff;font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px;white-space:nowrap;opacity:0.9;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${pinLabel}</div>`,
                  })}
                />
              </Fragment>
            );
          });
        })()}

        {filteredTracks.map(t => {
          const positions = t.coordinates.map(c => [c.lat, c.lon]);
          const isSelected = selectedItem?.id === t.id;
          const item = mediaItems.find(v => v.id === t.id);
          const color = item ? getColor(item, yearColorMap) : '#2563eb';
          const handleClick = () => { if (item) onSelectItem(item); };
          return (
            <Fragment key={t.id}>
              <Polyline
                positions={positions}
                pathOptions={isSelected ? { color: '#e74c3c', weight: 4, opacity: 0.9 } : { color, weight: 2.5, opacity: 0.55 }}
              />
              <Polyline
                positions={positions}
                pathOptions={{ color: '#000', weight: 12, opacity: 0.001 }}
                eventHandlers={{ click: handleClick }}
              />
            </Fragment>
          );
        })}

        {mediaItems.map(item => (
          <Marker
            key={item.id}
            position={[item.startPoint.lat, item.startPoint.lon]}
            icon={getIcon(item, selectedItem?.id === item.id, yearColorMap)}
            eventHandlers={{ click: () => onSelectItem(item) }}
          >
            <Popup>
              <div style={{ textAlign: 'center', maxWidth: 220 }}>
                {item.hasThumbnail && (
                  <img
                    src={getThumbnailUrl(item.id)}
                    alt={item.filename}
                    style={{ width: 200, borderRadius: 4, marginBottom: 4 }}
                    loading="lazy"
                  />
                )}
                <div><strong>{item.filename}</strong></div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {item.type === 'video' ? '🎬 Video' : '📷 Photo'}
                  {item.subfolder ? ` — ${item.subfolder}` : ''}
                </div>
                {item.startDate && (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {new Date(item.startDate).toLocaleString()}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {mediaItems.filter(item => item.type === 'video' && item.endPoint).map(item => (
          <Marker
            key={`end-${item.id}`}
            position={[item.endPoint.lat, item.endPoint.lon]}
            icon={createVideoEndIcon(getColor(item, yearColorMap), selectedItem?.id === item.id)}
            eventHandlers={{ click: () => onSelectItem(item) }}
          >
            <Popup>
              <div style={{ textAlign: 'center', maxWidth: 200 }}>
                <div><strong>{item.filename}</strong></div>
                <div style={{ fontSize: 11, color: '#888' }}>🏁 End point</div>
                {item.startDate && (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {new Date(item.startDate).toLocaleString()}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {track?.coordinates && !filteredTracks.some(t => t.id === selectedItem?.id) && (
          <Polyline
            positions={track.coordinates.map(c => [c.lat, c.lon])}
            pathOptions={{ color: '#e74c3c', weight: 4, opacity: 0.9 }}
          />
        )}

        {passWaypoints.map((w, i) => (
          <Marker
            key={`pass-${w.source}-${i}`}
            position={[w.lat, w.lon]}
            icon={PASS_ICON}
          >
            <Popup>
              <div style={{ textAlign: 'center' }}>
                <strong>{w.name}</strong>
                {w.ele != null && <div style={{ fontSize: 12, color: '#666' }}>{w.ele} m</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {legendYears.length > 1 && (
        <div className="map-year-legend">
          {legendYears.map(year => (
            <div key={year} className="legend-item">
              <svg width="12" height="17" viewBox="0 0 24 36" style={{ flexShrink: 0 }}>
                <path d="M12 1C6.477 1 2 5.477 2 11c0 7.5 10 23 10 23s10-15.5 10-23C22 5.477 17.523 1 12 1z"
                  fill={yearColorMap[year] || '#6b7280'} stroke="white" strokeWidth="1.5" />
              </svg>
              <span>{year}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
