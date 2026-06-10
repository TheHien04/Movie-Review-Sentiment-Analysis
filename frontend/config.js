/**
 * API base URL — same origin in production; override via window.API_BASE if needed.
 */
(function () {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
  window.API_BASE = window.API_BASE || origin || '';
  window.apiUrl = function (path) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${window.API_BASE}${p}`;
  };
})();
