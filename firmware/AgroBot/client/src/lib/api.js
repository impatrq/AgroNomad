const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

// Empty means use the current origin. This is the usual production setup when
// the web server proxies /api to the backend.
const apiBaseUrl = configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, '') : ''

export function apiUrl(path) {
  return `${apiBaseUrl}${path}`
}
export function getAnimalsWsUrl() {
  const url = new URL(apiUrl('/ws/animals'), window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}