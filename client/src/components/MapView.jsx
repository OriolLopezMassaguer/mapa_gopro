import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, Tooltip, useMap } from 'react-leaflet';
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
      <circle cx="12" cy="11" r="4.5" fill="white" fill-opacity="0.55"/>
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
  const op = isSelected ? 1 : 0.85;
  const sw = isSelected ? 3 : 2.5;
  return new L.DivIcon({
    className: '',
    iconSize: [16, 22],
    iconAnchor: [3, 21],
    popupAnchor: [7, -22],
    html: `<svg width="16" height="22" viewBox="0 0 16 22" xmlns="http://www.w3.org/2000/svg">
      <line x1="3" y1="1" x2="3" y2="21" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"/>
      <path d="M3 2 L14 6 L3 13 Z" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round" opacity="${op}"/>
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

function FitBounds({ track, selectedItem, mediaItems }) {
  const map = useMap();

  useEffect(() => {
    if (track?.coordinates?.length > 1) {
      const bounds = track.coordinates.map(c => [c.lat, c.lon]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (selectedItem) {
      map.setView([selectedItem.startPoint.lat, selectedItem.startPoint.lon], 15);
    }
  }, [track, selectedItem, map]);

  useEffect(() => {
    if (mediaItems.length > 0 && !selectedItem) {
      const bounds = mediaItems.map(v => [v.startPoint.lat, v.startPoint.lon]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [mediaItems, selectedItem, map]);

  return null;
}

export default function MapView({ mediaItems, selectedItem, track, allTracks, onSelectItem, yearColorMap = {}, regions = [], filterRegion = null, passWaypoints = [] }) {
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

        <FitBounds track={track} selectedItem={selectedItem} mediaItems={mediaItems} />

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

        {filteredTracks.map(t => (
          <Polyline
            key={t.id}
            positions={t.coordinates.map(c => [c.lat, c.lon])}
            pathOptions={
              selectedItem?.id === t.id
                ? { color: '#e74c3c', weight: 4, opacity: 0.9 }
                : (() => {
                    const item = mediaItems.find(v => v.id === t.id);
                    const color = item ? getColor(item, yearColorMap) : '#2563eb';
                    return { color, weight: 2.5, opacity: 0.55 };
                  })()
            }
            eventHandlers={{
              click: () => {
                const item = mediaItems.find(v => v.id === t.id);
                if (item) onSelectItem(item);
              }
            }}
          />
        ))}

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
