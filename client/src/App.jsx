import { useState, useEffect, useMemo } from 'react';
import MapView from './components/MapView';
import VideoPanel from './components/VideoPanel';
import TableView from './components/TableView';
import { useVideos } from './hooks/useVideos';
import { useTelemetry } from './hooks/useTelemetry';
import { fetchAllTracks, fetchAllPassWaypoints } from './services/api';
import './App.css';
import { YEAR_PALETTE, MONTH_NAMES, REGIONS, inRegion } from './constants';

function App() {
  const { videos, loading, error } = useVideos();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { track, loading: trackLoading } = useTelemetry(selectedVideo?.id);
  const [allTracks, setAllTracks] = useState([]);
  const [allPassIndex, setAllPassIndex] = useState([]); // [{name,lat,lon,ele,source,sourceName}]
  const [activePassFiles, setActivePassFiles] = useState(new Set());
  const [passWaypoints, setPassWaypoints] = useState([]); // waypoints for selected files only
  const [showVideos, setShowVideos] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [showPassMarkers, setShowPassMarkers] = useState(true);
  const [filterCamera, setFilterCamera] = useState(null);
  const [filterYear, setFilterYear] = useState(null);
  const [filterMonth, setFilterMonth] = useState(null);
  const [filterDay, setFilterDay] = useState(null);
  const [filterRegion, setFilterRegion] = useState(null);

  useEffect(() => {
    fetchAllTracks().then(setAllTracks).catch(() => {});
    fetchAllPassWaypoints().then(setAllPassIndex).catch(() => {});
  }, []);

  // Bounding box of all media with GPS, expanded by 1° (~100 km) to avoid being too restrictive
  const mediaBounds = useMemo(() => {
    const pts = videos.filter(v => v.startPoint);
    if (pts.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const v of pts) {
      minLat = Math.min(minLat, v.startPoint.lat);
      maxLat = Math.max(maxLat, v.startPoint.lat);
      minLon = Math.min(minLon, v.startPoint.lon);
      maxLon = Math.max(maxLon, v.startPoint.lon);
    }
    const pad = 1;
    return { minLat: minLat - pad, maxLat: maxLat + pad, minLon: minLon - pad, maxLon: maxLon + pad };
  }, [videos]);

  // Pass files whose waypoints fall within the media bounding box
  const passFiles = useMemo(() => {
    const byFile = new Map();
    for (const w of allPassIndex) {
      if (!byFile.has(w.source)) byFile.set(w.source, { id: w.source, name: w.sourceName, waypoints: [] });
      byFile.get(w.source).waypoints.push(w);
    }
    return [...byFile.values()]
      .filter(f => {
        if (!mediaBounds) return true;
        return f.waypoints.some(w =>
          w.lat >= mediaBounds.minLat && w.lat <= mediaBounds.maxLat &&
          w.lon >= mediaBounds.minLon && w.lon <= mediaBounds.maxLon
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPassIndex, mediaBounds]);

  const togglePassFile = (id) => {
    setActivePassFiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPassWaypoints(all => all.filter(w => w.source !== id));
      } else {
        next.add(id);
        const wpts = allPassIndex.filter(w => w.source === id);
        setPassWaypoints(all => [...all.filter(w => w.source !== id), ...wpts]);
      }
      return next;
    });
  };

  const visiblePassWaypoints = showPassMarkers
    ? passWaypoints.filter(w => activePassFiles.has(w.source))
    : [];
  const [view, setView] = useState('map'); // 'map' | 'table'

  const availableYears = useMemo(() => {
    const years = new Set(videos.filter(v => v.startDate).map(v => new Date(v.startDate).getFullYear()));
    return [...years].sort();
  }, [videos]);

  const yearColorMap = useMemo(() => {
    const map = {};
    availableYears.forEach((y, i) => { map[y] = YEAR_PALETTE[i % YEAR_PALETTE.length]; });
    return map;
  }, [availableYears]);

  const availableMonths = useMemo(() => {
    const months = new Set(
      videos.filter(v => {
        if (!v.startDate) return false;
        if (filterYear && new Date(v.startDate).getFullYear() !== filterYear) return false;
        return true;
      }).map(v => new Date(v.startDate).getMonth() + 1)
    );
    return [...months].sort((a, b) => a - b);
  }, [videos, filterYear]);

  const availableDays = useMemo(() => {
    if (!filterMonth) return [];
    const days = new Set(
      videos.filter(v => {
        if (!v.startDate) return false;
        const d = new Date(v.startDate);
        if (filterYear && d.getFullYear() !== filterYear) return false;
        return d.getMonth() + 1 === filterMonth;
      }).map(v => new Date(v.startDate).getDate())
    );
    return [...days].sort((a, b) => a - b);
  }, [videos, filterYear, filterMonth]);

  const activeRegion = filterRegion ? REGIONS.find(r => r.id === filterRegion) : null;

  const availableCameras = useMemo(() => {
    const cameras = new Set(videos.map(v => v.camera).filter(Boolean));
    return [...cameras].sort();
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      if (v.type === 'video' && !showVideos) return false;
      if (v.type === 'photo' && !showPhotos) return false;
      if (filterCamera && v.camera !== filterCamera) return false;
      if (activeRegion && !inRegion(v, activeRegion)) return false;
      if (!v.startDate) return !filterYear;
      const d = new Date(v.startDate);
      if (filterYear && d.getFullYear() !== filterYear) return false;
      if (filterMonth && d.getMonth() + 1 !== filterMonth) return false;
      if (filterDay && d.getDate() !== filterDay) return false;
      return true;
    });
  }, [videos, showVideos, showPhotos, filterCamera, filterYear, filterMonth, filterDay, activeRegion]);

  const handleFilterYear = (year) => {
    if (filterYear === year) { setFilterYear(null); setFilterMonth(null); setFilterDay(null); }
    else { setFilterYear(year); setFilterMonth(null); setFilterDay(null); }
  };

  const handleFilterMonth = (month) => {
    if (filterMonth === month) { setFilterMonth(null); setFilterDay(null); }
    else { setFilterMonth(month); setFilterDay(null); }
  };

  const handleFilterDay = (day) => {
    setFilterDay(filterDay === day ? null : day);
  };

  const handleFilterRegion = (id) => {
    setFilterRegion(filterRegion === id ? null : id);
  };

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
        <div className="year-filter-bar">
          <div className="year-filter-years">
            <button
              className={`type-toggle${showVideos ? ' type-toggle--active' : ''}`}
              onClick={() => setShowVideos(v => !v)}
            >
              &#9654; Videos
            </button>
            <button
              className={`type-toggle${showPhotos ? ' type-toggle--active' : ''}`}
              onClick={() => setShowPhotos(v => !v)}
            >
              &#9679; Photos
            </button>
            {passFiles.length > 0 && (
              <button
                className={`type-toggle${showPassMarkers ? ' type-toggle--active' : ''}`}
                onClick={() => setShowPassMarkers(v => !v)}
              >
                &#9650; Passes
              </button>
            )}
          </div>
          {availableCameras.length > 1 && (
            <div className="year-filter-years">
              <button
                className={`camera-pill${filterCamera === null ? ' camera-pill--active' : ''}`}
                onClick={() => setFilterCamera(null)}
              >
                All cameras
              </button>
              {availableCameras.map(cam => (
                <button
                  key={cam}
                  className={`camera-pill${filterCamera === cam ? ' camera-pill--active' : ''}`}
                  onClick={() => setFilterCamera(filterCamera === cam ? null : cam)}
                >
                  {cam}
                </button>
              ))}
            </div>
          )}
          <div className="year-filter-years">
            <button
              className={`region-pill${filterRegion === null ? ' region-pill--active' : ''}`}
              onClick={() => setFilterRegion(null)}
            >
              All
            </button>
            {REGIONS.map(r => (
              <button
                key={r.id}
                className={`region-pill${filterRegion === r.id ? ' region-pill--active' : ''}`}
                onClick={() => handleFilterRegion(r.id)}
              >
                {r.name}
              </button>
            ))}
          </div>
          {availableYears.length > 0 && (
            <div className="year-filter-years">
              <button
                className={`year-pill${filterYear === null ? ' year-pill--active' : ''}`}
                style={filterYear === null ? { background: '#374151', borderColor: '#374151' } : {}}
                onClick={() => { setFilterYear(null); setFilterMonth(null); setFilterDay(null); }}
              >
                All
              </button>
              {availableYears.map(year => (
                <button
                  key={year}
                  className={`year-pill${filterYear === year ? ' year-pill--active' : ''}`}
                  style={filterYear === year ? { background: yearColorMap[year], borderColor: yearColorMap[year] } : { borderColor: yearColorMap[year] }}
                  onClick={() => handleFilterYear(year)}
                >
                  <span className="year-pill-dot" style={{ background: yearColorMap[year] }}></span>
                  {year}
                </button>
              ))}
            </div>
          )}
          {passFiles.length > 0 && showPassMarkers && (
            <div className="year-filter-years">
              {passFiles.map(f => (
                <button
                  key={f.id}
                  className={`month-pill${activePassFiles.has(f.id) ? ' month-pill--active' : ''}`}
                  style={activePassFiles.has(f.id) ? { background: '#7c3aed', borderColor: '#7c3aed' } : {}}
                  onClick={() => togglePassFile(f.id)}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
          {filterYear && availableMonths.length > 1 && (
            <div className="year-filter-months">
              {availableMonths.map(m => (
                <button
                  key={m}
                  className={`month-pill${filterMonth === m ? ' month-pill--active' : ''}`}
                  style={filterMonth === m ? { background: yearColorMap[filterYear], borderColor: yearColorMap[filterYear] } : {}}
                  onClick={() => handleFilterMonth(m)}
                >
                  {MONTH_NAMES[m - 1]}
                </button>
              ))}
            </div>
          )}
          {filterMonth && availableDays.length > 1 && (
            <div className="year-filter-months">
              {availableDays.map(d => (
                <button
                  key={d}
                  className={`month-pill${filterDay === d ? ' month-pill--active' : ''}`}
                  style={filterDay === d ? { background: yearColorMap[filterYear], borderColor: yearColorMap[filterYear] } : {}}
                  onClick={() => handleFilterDay(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'map' && (
        <MapView
          mediaItems={filteredVideos}
          selectedItem={selectedVideo}
          track={track}
          allTracks={allTracks}
          onSelectItem={handleSelectVideo}
          yearColorMap={yearColorMap}
          regions={REGIONS}
          filterRegion={filterRegion}
          passWaypoints={visiblePassWaypoints}
        />
      )}

      {view === 'table' && (
        <TableView
          onSelectItem={handleSelectVideo}
          filterYear={filterYear}
          filterMonth={filterMonth}
          filterDay={filterDay}
          filterRegion={filterRegion}
          onFilterYear={handleFilterYear}
          onFilterMonth={handleFilterMonth}
          onFilterDay={handleFilterDay}
          onFilterRegion={handleFilterRegion}
          yearColorMap={yearColorMap}
        />
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
