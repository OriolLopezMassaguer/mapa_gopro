import { useState, useEffect } from 'react';
import { fetchAudit } from '../services/api';

function fmtSize(bytes) {
  if (bytes == null) return '—';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  return (bytes / 1e6).toFixed(1) + ' MB';
}

export default function AuditView() {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('relativePath');
  const [sortDir, setSortDir] = useState(1);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    setLoading(true);
    fetchAudit()
      .then(data => { setAudit(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const rows = audit
    ? [...audit.missing]
        .filter(r => filterType === 'all' || r.type === filterType)
        .sort((a, b) => {
          const av = a[sortKey] ?? '';
          const bv = b[sortKey] ?? '';
          return av < bv ? -sortDir : av > bv ? sortDir : 0;
        })
    : [];

  const arrow = (key) => sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '';

  return (
    <div className="table-view">
      <div className="table-toolbar">
        <span className="table-count">
          {loading ? 'Loading…' : audit
            ? <>
                <strong>{audit.totalOnDisk}</strong> on disk &nbsp;·&nbsp;
                <strong>{audit.totalCached}</strong> cached &nbsp;·&nbsp;
                <strong style={{ color: audit.totalMissing > 0 ? '#f87171' : '#4ade80' }}>
                  {audit.totalMissing} missing
                </strong>
              </>
            : null}
        </span>
        <div className="table-filters">
          {['all', 'video', 'photo'].map(t => (
            <button
              key={t}
              className={`month-pill${filterType === t ? ' month-pill--active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">Error: {error}</div>}

      {!loading && audit?.totalMissing === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#4ade80', fontSize: '1.1rem' }}>
          All media files are cached.
        </div>
      )}

      {rows.length > 0 && (
        <div className="table-scroll">
          <table className="media-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('relativePath')} style={{ cursor: 'pointer' }}>Path{arrow('relativePath')}</th>
                <th onClick={() => handleSort('type')} style={{ cursor: 'pointer' }}>Type{arrow('type')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.relativePath}</td>
                  <td>{r.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
