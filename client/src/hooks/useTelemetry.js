import { useState, useEffect } from 'react';
import { fetchTelemetry } from '../services/api';

export function useTelemetry(videoId) {
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!videoId) {
      setTrack(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchTelemetry(videoId)
      .then(data => {
        if (!cancelled) {
          setTrack(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrack(null);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [videoId]);

  return { track, loading };
}
