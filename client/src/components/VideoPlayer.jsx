import { useState } from 'react';
import { getStreamUrl } from '../services/api';

export default function VideoPlayer({ videoId }) {
  const [unsupported, setUnsupported] = useState(false);

  if (!videoId) return null;

  const src = getStreamUrl(videoId);

  if (unsupported) {
    return (
      <div className="video-player">
        <div className="video-unsupported">
          <p>Your browser cannot play this video (likely H.265/HEVC).</p>
          <p>Use Safari, or download and play locally.</p>
          <a href={src} download className="video-download-btn">
            Download video
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="video-player">
      <video
        key={videoId}
        controls
        preload="metadata"
        style={{ width: '100%', borderRadius: 6 }}
        onError={() => setUnsupported(true)}
      >
        <source src={src} type="video/mp4" onError={() => setUnsupported(true)} />
      </video>
    </div>
  );
}
