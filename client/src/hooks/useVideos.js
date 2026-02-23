import { useState, useEffect } from 'react';
import { fetchMedia } from '../services/api';

export function useVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  }, []);

  return { videos, loading, error };
}
