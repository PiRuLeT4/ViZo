/**
 * Lee el token CSRF de la cookie de Django.
 */
export function getCSRFToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Devuelve los headers necesarios para un fetch POST con CSRF.
 */
export function csrfHeaders(extra = {}) {
  return {
    'X-CSRFToken': getCSRFToken(),
    'X-Requested-With': 'XMLHttpRequest',
    ...extra,
  };
}
