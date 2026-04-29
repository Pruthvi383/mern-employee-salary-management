export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export const getImageUrl = (photo) => `${API_BASE_URL}/images/${photo}`;
