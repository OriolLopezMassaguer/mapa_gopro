import { useState, useEffect, useMemo } from 'react';
import MapView from './components/MapView';
import VideoPanel from './components/VideoPanel';
import TableView from './components/TableView';
import { useVideos } from './hooks/useVideos';
import { useTelemetry } from './hooks/useTelemetry';
import { fetchAllTracks } from './services/api';
import './App.css';
import { YEAR_PALETTE, MONTH_NAMES, REGIONS, inRegion } from './constants';

function App() {
  const { videos, loading, error } = useVideos();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const { track, loading: trackLoading } = useTelemetry(selectedVideo?.id);
  const [allTracks, setAllTracks] = useState([]);
  const [filterYear, setFilterYear] = useState(null);
  const [filterMonth, setFilterMonth] = useState(null);
  const [filterDay, setFilterDay] = useState(null);
  const [filterRegion, setFilterRegion] = useState(null);

  useEffect(() => {
    fetchAllTracks().then(setAllTracks).catch(() => {});
  }, []);
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
    if (!filterYear) return [];
    const months = new Set(
      videos.filter(v => v.startDate && new Date(v.startDate).getFullYear() === filterYear)
        .map(v => new Date(v.startDate).getMonth() + 1)
    );
    return [...months].sort((a, b) => a - b);
  }, [videos, filterYear]);

  const availableDays = useMemo(() => {
    if (!filterYear || !filterMonth) return [];
    const days = new Set(
      videos.filter(v => {
        if (!v.startDate) return false;
        const d = new Date(v.startDate);
        return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth;
      }).map(v => new Date(v.startDate).getDate())
    );
    return [...days].sort((a, b) => a - b);
  }, [videos, filterYear, filterMonth]);

  const activeRegion = filterRegion ? REGIONS.find(r => r.id === filterRegion) : null;

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      if (activeRegion && !inRegion(v, activeRegion)) return false;
      if (!v.startDate) return !filterYear;
      const d = new Date(v.startDate);
      if (filterYear && d.getFullYear() !== filterYear) return false;
      if (filterMonth && d.getMonth() + 1 !== filterMonth) return false;
      if (filterDay && d.getDate() !== filterDay) return false;
      return true;
    });
  }, [videos, filterYear, filterMonth, filterDay, activeRegion]);

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
