import { useState, useEffect } from 'react';
import { fetchAllMedia, getThumbnailUrl } from '../services/api';

const COLUMNS = [
  { key: 'filename',    label: 'File' },
  { key: 'subfolder',   label: 'Folder' },
  { key: 'type',        label: 'Type' },
  { key: 'fileSize',    label: 'Size' },
  { key: 'startDate',   label: 'Date' },
  { key: 'startPoint',  label: 'GPS Start' },
  { key: 'endPoint',    label: 'GPS End' },
  { key: 'duration',    label: 'Duration' },
  { key: 'totalPoints', label: 'Points' },
];

function fmtCoord(pt) {
  if (!pt) return '—';
  return `${pt.lat.toFixed(5)}, ${pt.lon.toFixed(5)}`;
}

function fmtSize(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  return (bytes / 1e6).toFixed(1) + ' MB';
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d;
  }
}

function fmtDuration(ms) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function cellValue(item, key) {
  switch (key) {
    case 'fileSize':    return fmtSize(item.fileSize);
    case 'startDate':   return fmtDate(item.startDate || item.lastModified);
    case 'startPoint':  return fmtCoord(item.startPoint);
    case 'endPoint':    return item.type === 'video' ? fmtCoord(item.endPoint) : null;
    case 'duration':    return item.type === 'video' ? fmtDuration(item.duration) : null;
    case 'totalPoints': return item.type === 'video' ? (item.totalPoints ?? '—') : null;
    default:            return item[key] || '—';
  }
}

function sortValue(item, key) {
  switch (key) {
    case 'fileSize':    return item.fileSize ?? 0;
    case 'startDate':   return new Date(item.startDate || item.lastModified || 0).getTime();
    case 'startPoint':  return item.startPoint?.lat ?? -Infinity;
    case 'endPoint':    return item.endPoint?.lat ?? -Infinity;
    case 'duration':    return item.duration ?? -1;
    case 'totalPoints': return item.totalPoints ?? -1;
    default:            return (item[key] || '').toLowerCase();
  }
}

export default function TableView({ onSelectItem }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('startDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('all'); // all | video | photo | nogps

  useEffect(() => {
    fetchAllMedia()
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleSort(key) {
    if (key === sortKey) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = items.filter(item => {
    if (filter === 'video') return item.type === 'video';
    if (filter === 'photo') return item.type === 'photo';
    if (filter === 'nogps') return item.noGps;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });

  const counts = {
    all: items.length,
    video: items.filter(i => i.type === 'video').length,
    photo: items.filter(i => i.type === 'photo').length,
    nogps: items.filter(i => i.noGps).length,
  };

  return (
    <div className="table-view">
      <div className="table-toolbar">
        <div className="table-filters">
          {['all', 'video', 'photo', 'nogps'].map(f => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' filter-btn--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'nogps' ? 'No GPS' : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="filter-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="export-btns">
          <a href="/api/media/export.kml" download="gopro-tracks.kml" className="export-btn">
            All KML
          </a>
          <a href="/api/media/export-videos.kml" download="gopro-video-tracks.kml" className="export-btn export-btn--video">
            Videos KML
          </a>
          <a href="/api/media/export-photos.kml" download="gopro-photos.kml" className="export-btn export-btn--photo">
            Photos KML
          </a>
        </div>
      </div>

      {loading ? (
        <div className="table-empty">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="table-empty">No items found.</div>
      ) : (
        <div className="table-scroll">
          <table className="media-table">
            <thead>
              <tr>
                <th className="col-thumb" />
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={sortKey === col.key ? 'sorted' : ''}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="sort-arrow">{sortAsc ? ' ↑' : ' ↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(item => (
                <tr
                  key={item.id}
                  className={item.noGps ? 'row--nogps' : ''}
                  onClick={() => !item.noGps && onSelectItem && onSelectItem(item)}
                  style={{ cursor: item.noGps ? 'default' : 'pointer' }}
                >
                  <td className="col-thumb">
                    {item.hasThumbnail && (
                      <img
                        src={getThumbnailUrl(item.id)}
                        alt=""
                        className="thumb"
                        loading="lazy"
                      />
                    )}
                  </td>
                  {COLUMNS.map(col => {
                    const val = cellValue(item, col.key);
                    return (
                      <td key={col.key} className={val == null ? 'cell--na' : ''}>
                        {val == null ? <span className="na">—</span> : val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
