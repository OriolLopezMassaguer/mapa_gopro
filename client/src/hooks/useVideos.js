import { useState, useEffect, useCallback } from 'react';
import { fetchMedia } from '../services/api';

export function useVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    fetchMedia()
      .then(data => {
        if (!cancelled) {
          setVideos(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [refreshKey]);

  return { videos, loading, error, refresh };
}
