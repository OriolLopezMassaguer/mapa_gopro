import VideoPlayer from './VideoPlayer';
import { getThumbnailUrl, getStreamUrl } from '../services/api';

function formatDuration(ms) {
  if (!ms) return '--';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MediaPanel({ item, track, trackLoading, onClose }) {
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
        <button className="close-btn" onClick={onClose}>&times;</button>
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
      </div>
    </div>
  );
}
