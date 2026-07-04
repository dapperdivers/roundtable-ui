/**
 * Typed JSON API client. Authentication happens upstream — forward auth at
 * the ingress injects the bearer token — so the browser never handles
 * credentials. The backend still enforces DASHBOARD_API_KEY for direct
 * (non-proxied) API access.
 */

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  // The Go API mixes JSON {"error": ...} bodies with plain-text http.Error
  // messages (e.g. "TTL must be 60-604800 seconds") — surface both.
  let message = `${res.status} ${res.statusText}`
  try {
    const body = (await res.text()).trim()
    if (body) {
      try {
        const parsed = JSON.parse(body)
        message = typeof parsed?.error === 'string' ? parsed.error : body.slice(0, 300)
      } catch {
        message = body.slice(0, 300)
      }
    }
  } catch {
    // unreadable body — keep the status line
  }
  return new ApiError(res.status, message)
}

/** Low-level fetch wrapper: sets JSON Content-Type when a body is present,
 *  returns the raw Response. Prefer apiGet/apiPost/apiDelete. */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = new Headers(options?.headers)
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...options, headers })
}

/** GET url and parse JSON. Throws ApiError on non-2xx. */
export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init)
  if (!res.ok) throw await toApiError(res)
  return res.json() as Promise<T>
}

/** GET url and return the body as text. Throws ApiError on non-2xx. */
export async function apiGetText(url: string): Promise<string> {
  const res = await apiFetch(url)
  if (!res.ok) throw await toApiError(res)
  return res.text()
}

/** POST a JSON body and parse the JSON response. Throws ApiError on non-2xx. */
export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw await toApiError(res)
  return res.json() as Promise<T>
}
