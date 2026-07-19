import { useState } from 'react';
import VideoPlayer from './VideoPlayer';
import { getThumbnailUrl, getStreamUrl, getKmlUrl, recheckMedia } from '../services/api';


function formatDuration(ms) {
  if (!ms) return '--';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaPanel({ item, track, trackLoading, onClose, onRecheckDone }) {
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [recheckError, setRecheckError] = useState(null);

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
            <a
              href={getKmlUrl(item.id)}
              download
              className="panel-download-btn"
              title="Download KML"
              style={{ fontSize: 12, fontWeight: 700 }}
            >
              KML
            </a>
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
      </div>
    </div>
  );
}
