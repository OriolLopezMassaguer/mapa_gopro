import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

// Video marker (blue)
const videoIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Photo marker (orange circle)
const photoIcon = new L.DivIcon({
  className: 'photo-marker',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
  html: '<div class="photo-marker-dot"></div>',
});

// Selected marker (green)
const selectedVideoIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'marker-selected',
});

const selectedPhotoIcon = new L.DivIcon({
  className: 'photo-marker photo-marker--selected',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
  html: '<div class="photo-marker-dot photo-marker-dot--selected"></div>',
});

function getIcon(item, isSelected) {
  if (item.type === 'photo') {
    return isSelected ? selectedPhotoIcon : photoIcon;
  }
  return isSelected ? selectedVideoIcon : videoIcon;
}

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

export default function MapView({ mediaItems, selectedItem, track, onSelectItem }) {
  const defaultCenter = [45.9, 6.9];

  return (
    <MapContainer center={defaultCenter} zoom={10} className="map-container">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds track={track} selectedItem={selectedItem} mediaItems={mediaItems} />

      {mediaItems.map(item => (
        <Marker
          key={item.id}
          position={[item.startPoint.lat, item.startPoint.lon]}
          icon={getIcon(item, selectedItem?.id === item.id)}
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

      {track?.coordinates && (
        <Polyline
          positions={track.coordinates.map(c => [c.lat, c.lon])}
          pathOptions={{ color: '#e74c3c', weight: 4, opacity: 0.85 }}
        />
      )}
    </MapContainer>
  );
}
