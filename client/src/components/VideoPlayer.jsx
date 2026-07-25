import { useState, useEffect, useRef } from 'react';
import { getStreamUrl, fetchPlaybackInfo, startTranscode } from '../services/api';

const POLL_INTERVAL_MS = 3000;

export default function VideoPlayer({ videoId }) {
  const [unsupported, setUnsupported] = useState(false);
  // null while checking, then { needsTranscode, ready }
  const [playbackInfo, setPlaybackInfo] = useState(null);
  const pollRef = useRef(null);

  // VideoPlayer is remounted (via key={videoId} in VideoPanel) whenever the selected
  // video changes, so state naturally resets — no manual reset needed here.
  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;

    async function check() {
      try {
        const info = await fetchPlaybackInfo(videoId);
        if (cancelled) return;
        setPlaybackInfo(info);
        if (info.needsTranscode && !info.ready) {
          await startTranscode(videoId).catch(() => {});
          if (!cancelled) pollRef.current = setTimeout(check, POLL_INTERVAL_MS);
        }
      } catch {
        if (!cancelled) setPlaybackInfo({ needsTranscode: false, ready: true }); // fail open — let <video> try directly
      }
    }
    check();

    return () => { cancelled = true; clearTimeout(pollRef.current); };
  }, [videoId]);

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

  if (!playbackInfo || (playbackInfo.needsTranscode && !playbackInfo.ready)) {
    return (
      <div className="video-player">
        <div className="video-unsupported">
          <p>{!playbackInfo ? 'Checking playback compatibility…' : 'Converting video for browser playback…'}</p>
          {playbackInfo && <p style={{ fontSize: 12, color: '#888' }}>This can take a while for large videos. It only happens once — the converted copy is cached.</p>}
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
