import { useState } from 'react';
import MapView from './components/MapView';
import VideoPanel from './components/VideoPanel';
import { useVideos } from './hooks/useVideos';
import { useTelemetry } from './hooks/useTelemetry';
import './App.css';

function App() {
  const { videos, loading, error } = useVideos();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { track, loading: trackLoading } = useTelemetry(selectedVideo?.id);

  const handleSelectVideo = (video) => {
    setSelectedVideo(video);
  };

  const handleClose = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="app">
      <MapView
        videos={videos}
        selectedVideo={selectedVideo}
        track={track}
        onSelectVideo={handleSelectVideo}
      />

      {selectedVideo && (
        <VideoPanel
          video={selectedVideo}
          track={track}
          trackLoading={trackLoading}
          onClose={handleClose}
        />
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading videos...</div>
        </div>
      )}

      {error && (
        <div className="error-banner">
          Error loading videos: {error}
        </div>
      )}

      {!loading && videos.length === 0 && !error && (
        <div className="empty-banner">
          No GoPro videos with GPS data found.
        </div>
      )}
    </div>
  );
}

export default App;
