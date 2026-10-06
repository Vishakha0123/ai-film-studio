/**
 * API client for the CineAI backend (FastAPI, mounted at /api/v1).
 *
 * The frontend runs in two modes:
 *  - Demo mode (default): VITE_API_URL is not set. Calls resolve with the
 *    sample film data in src/types.ts so every screen is usable without a backend.
 *  - Live mode: set VITE_API_URL (e.g. http://localhost:8000) in frontend/.env.
 *    Calls go to `${VITE_API_URL}/api/v1/...`.
 */

export const API_BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const DEMO_MODE = API_BASE === ''

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = 'cineai.token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable — session lives in memory only */
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(typeof detail === 'string' ? detail : 'Request failed', res.status)
  }
  return (await res.json()) as T
}

export const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
