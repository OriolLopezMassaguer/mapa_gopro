import { getStreamUrl } from '../services/api';

export default function VideoPlayer({ videoId }) {
  if (!videoId) return null;

  return (
    <div className="video-player">
      <video key={videoId} controls preload="metadata" style={{ width: '100%', borderRadius: 6 }}>
        <source src={getStreamUrl(videoId)} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
