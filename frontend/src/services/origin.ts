/**
 * Origen de la API.
 * NEXT_PUBLIC_API_ORIGIN=same usa el mismo host que la página (proxy CWP en 443).
 * Una URL explícita apunta a ese origen.
 * Sin variable, el navegador sigue usando el puerto 8000.
 */
export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (configured === 'same') return '';
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '127.0.0.1';
    return `http://${host}:8000`;
  }
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return 'http://127.0.0.1:8000';
}

export function getLiveWsUrl(query: string): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return `${explicit.replace(/\/$/, '')}${query}`;
  if (process.env.NEXT_PUBLIC_API_ORIGIN === 'same' && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/live${query}`;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '127.0.0.1';
    return `ws://${host}:8000/ws/live${query}`;
  }
  return `ws://127.0.0.1:8000/ws/live${query}`;
}
