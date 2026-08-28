/**
 * API client with configurable base URL
 * Development: uses Vite proxy (empty base)
 * Production: uses VITE_API_BASE_URL from env
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Build a full API URL from a path
 * @param path - API path like '/api/generate'
 * @returns Full URL
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/**
 * Build a full URL for uploads/assets
 * In production, local paths starting with /uploads/ need the backend base URL
 */
export function assetUrl(url: string): string {
  if (!url) return url;
  // Already absolute URL (external services like DashScope, Kling)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Local path - prepend backend base URL in production
  if (url.startsWith('/uploads/') && API_BASE) {
    return `${API_BASE}${url}`;
  }
  return url;
}
