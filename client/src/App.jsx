import { useState } from 'react';
import MapView from './components/MapView';
import VideoPanel from './components/VideoPanel';
import TableView from './components/TableView';
import { useVideos } from './hooks/useVideos';
import { useTelemetry } from './hooks/useTelemetry';
import './App.css';

function App() {
  const { videos, loading, error } = useVideos();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { track, loading: trackLoading } = useTelemetry(selectedVideo?.id);
  const [view, setView] = useState('map'); // 'map' | 'table'

  const handleSelectVideo = (video) => {
    setSelectedVideo(video);
    setView('map');
  };

  const handleClose = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="app">
      <div className="view-toggle">
        <button
          className={`view-btn${view === 'map' ? ' view-btn--active' : ''}`}
          onClick={() => setView('map')}
        >
          Map
        </button>
        <button
          className={`view-btn${view === 'table' ? ' view-btn--active' : ''}`}
          onClick={() => setView('table')}
        >
          Table
        </button>
      </div>

      {view === 'map' && (
        <MapView
          mediaItems={videos}
          selectedItem={selectedVideo}
          track={track}
          onSelectItem={handleSelectVideo}
        />
      )}

      {view === 'table' && (
        <TableView onSelectItem={handleSelectVideo} />
      )}

      {view === 'map' && selectedVideo && (
        <VideoPanel
          item={selectedVideo}
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

      {!loading && videos.length === 0 && !error && view === 'map' && (
        <div className="empty-banner">
          No GoPro videos with GPS data found.
        </div>
      )}
    </div>
  );
}

export default App;
