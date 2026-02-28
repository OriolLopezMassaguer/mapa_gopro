import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const fetchMedia = () => api.get('/media').then(r => r.data);
export const fetchAllMedia = () => api.get('/media/all').then(r => r.data);
export const fetchTelemetry = (id) => api.get(`/media/${id}/telemetry`).then(r => r.data);
export const getStreamUrl = (id) => `/api/media/${id}/stream`;
export const getThumbnailUrl = (id) => `/api/media/${id}/thumbnail`;
