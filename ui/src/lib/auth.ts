const AUTH_KEY = 'roundtable_api_key'

export function getApiKey(): string | null {
  return localStorage.getItem(AUTH_KEY)
}

export function setApiKey(key: string): void {
  localStorage.setItem(AUTH_KEY, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(AUTH_KEY)
}

export function isAuthenticated(): boolean {
  return !!getApiKey()
}

/** Build headers with Authorization for API calls */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  const key = getApiKey()
  if (key) {
    headers['Authorization'] = `Bearer ${key}`
  }
  return headers
}

/** Wrapper around fetch that adds auth headers and handles 401 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const key = getApiKey()
  const headers = new Headers(options?.headers)
  if (key) {
    headers.set('Authorization', `Bearer ${key}`)
  }
  if (!headers.has('Content-Type') && options?.body) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    clearApiKey()
    window.dispatchEvent(new Event('auth:logout'))
  }

  return res
}
