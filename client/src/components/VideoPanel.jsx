import { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import { getThumbnailUrl, getStreamUrl, getKmlUrl, getGpxUrl, recheckMedia, fetchPlaces, clearPlacesCache } from '../services/api';


function formatDuration(ms) {
  if (!ms) return '--';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPlaceTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return null;
  }
}

function formatPlaceDate(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return null;
  }
}

export default function MediaPanel({ item, track, trackLoading, onClose, onRecheckDone }) {
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckError, setRecheckError] = useState(null);
  const [places, setPlaces] = useState(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState(null);

  useEffect(() => {
    if (item.type !== 'video' || item.noGps) {
      setPlaces(null);
      return;
    }
    setPlaces(null);
    setPlacesError(null);
    setPlacesLoading(true);
    fetchPlaces(item.id)
      .then(data => { setPlaces(data); setPlacesLoading(false); })
      .catch(err => { setPlacesError(err.message || 'Failed to load places'); setPlacesLoading(false); });
  }, [item.id, item.type, item.noGps]);

  async function handleRecheck() {
    setRecheckLoading(true);
    setRecheckError(null);
    try {
      const data = await recheckMedia(item.id);
      onRecheckDone?.(data.entry);
    } catch (err) {
      setRecheckError(err.response?.data?.error || err.message || 'Recheck failed');
    } finally {
      setRecheckLoading(false);
    }
  }

  async function handleRefreshPlaces() {
    setPlacesLoading(true);
    setPlacesError(null);
    try {
      await clearPlacesCache(item.id);
      const data = await fetchPlaces(item.id);
      setPlaces(data);
    } catch (err) {
      setPlacesError(err.message || 'Failed to refresh places');
    } finally {
      setPlacesLoading(false);
    }
  }

  const isVideo = item.type === 'video';
  const isPhoto = item.type === 'photo';

  return (
    <div className="video-panel">
      <div className="panel-header">
        <div>
          <h3>{item.filename}</h3>
          {item.subfolder && (
            <span className="panel-subfolder">{item.subfolder}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!item.noGps && (
            <>
              <a
                href={getGpxUrl(item.id)}
                download
                className="panel-download-btn"
                title="Download GPX"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                GPX
              </a>
              <a
                href={getKmlUrl(item.id)}
                download
                className="panel-download-btn"
                title="Download KML"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                KML
              </a>
            </>
          )}
          {isVideo && (
            <a
              href={getStreamUrl(item.id)}
              download={item.filename}
              className="panel-download-btn"
              title="Download video"
            >
              ↓
            </a>
          )}
          <button
            className="panel-download-btn"
            onClick={handleRecheck}
            disabled={recheckLoading}
            title="Re-extract GPS coordinates from source file"
            style={{ fontSize: 14, cursor: recheckLoading ? 'wait' : 'pointer' }}
          >
            {recheckLoading ? '…' : '↺'}
          </button>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
      </div>

      {isVideo && <VideoPlayer videoId={item.id} />}

      {isPhoto && (
        <div className="photo-viewer">
          <img
            src={getStreamUrl(item.id)}
            alt={item.filename}
            className="photo-full"
          />
        </div>
      )}

      <div className="panel-info">
        <div className="info-row">
          <span className="info-label">Type</span>
          <span>{isVideo ? '🎬 Video' : '📷 Photo'}</span>
        </div>

        {item.startDate && (
          <div className="info-row">
            <span className="info-label">Date</span>
            <span>{new Date(item.startDate).toLocaleString()}</span>
          </div>
        )}

        {isVideo && item.duration && (
          <div className="info-row">
            <span className="info-label">Duration</span>
            <span>{formatDuration(item.duration)}</span>
          </div>
        )}

        {item.altitude != null && (
          <div className="info-row">
            <span className="info-label">Altitude</span>
            <span>{Math.round(item.altitude)} m</span>
          </div>
        )}

        <div className="info-row">
          <span className="info-label">Location</span>
          <span>{item.startPoint.lat.toFixed(5)}, {item.startPoint.lon.toFixed(5)}</span>
        </div>

        {isVideo && track && (
          <>
            <div className="info-row">
              <span className="info-label">GPS Points</span>
              <span>{track.totalPoints}</span>
            </div>
            {item.endPoint && (
              <div className="info-row">
                <span className="info-label">End</span>
                <span>{item.endPoint.lat.toFixed(5)}, {item.endPoint.lon.toFixed(5)}</span>
              </div>
            )}
          </>
        )}

        {trackLoading && <div className="loading-track">Loading GPS track...</div>}
        {recheckLoading && <div className="loading-track">Re-extracting GPS from source file…</div>}
        {recheckError && <div className="loading-track" style={{ color: '#c00' }}>{recheckError}</div>}

        {isVideo && !item.noGps && (
          <div className="places-section">
            <div className="places-header">
              <span className="info-label">Places visited</span>
              <button
                className="panel-download-btn"
                onClick={handleRefreshPlaces}
                disabled={placesLoading}
                title="Re-geocode places from GPS track"
                style={{ fontSize: 11, cursor: placesLoading ? 'wait' : 'pointer', padding: '2px 6px' }}
              >
                {placesLoading ? '…' : '↺'}
              </button>
            </div>
            {placesLoading && <div className="loading-track">Geocoding places…</div>}
            {placesError && <div className="loading-track" style={{ color: '#c00' }}>{placesError}</div>}
            {!placesLoading && places && places.length === 0 && (
              <div className="loading-track" style={{ color: '#888' }}>No places found</div>
            )}
            {!placesLoading && places && places.length > 0 && (
              <ol className="places-list">
                {places.map((p, i) => (
                  <li key={i} className="places-item">
                    <span className="places-name">{p.name}</span>
                    {p.time && (
                      <span className="places-time">
                        {formatPlaceDate(p.time)} {formatPlaceTime(p.time)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
