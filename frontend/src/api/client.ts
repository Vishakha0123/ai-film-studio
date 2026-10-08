/**
 * HTTP client for the CineAI backend (FastAPI, /api/v1).
 *
 * Modes (from frontend/.env):
 *  - Demo:     VITE_API_URL empty → every screen runs on the sample film, no backend needed.
 *  - Live:     VITE_API_URL=http://localhost:8000
 *      · with VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → Supabase Auth (Google, Apple)
 *      · without them → dev login (backend must run with AUTH_MODE=dev)
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const API_BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const DEMO_MODE = API_BASE === ''

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const AUTH_PROVIDER: 'demo' | 'supabase' | 'dev' = DEMO_MODE ? 'demo' : SUPABASE_URL && SUPABASE_ANON_KEY ? 'supabase' : 'dev'

/** Supabase is loaded on demand so demo/dev builds don't ship it on first paint. */
let supabasePromise: Promise<SupabaseClient> | null = null
export function getSupabase(): Promise<SupabaseClient> | null {
  if (AUTH_PROVIDER !== 'supabase') return null
  supabasePromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    // Keep the guard marker in sync with Supabase (token refresh, sign-out in another tab).
    client.auth.onAuthStateChange((_event, session) => setToken(session ? 'supabase' : null))
    return client
  })
  return supabasePromise
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Marks "signed in" for synchronous route guards; the real token lives in Supabase's session. */
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

async function authHeader(): Promise<string | null> {
  const sb = getSupabase()
  if (sb) {
    const { data } = await (await sb).auth.getSession()
    return data.session ? `Bearer ${data.session.access_token}` : null
  }
  const token = getToken()
  return token ? `Bearer ${token}` : null
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  // FormData (file uploads) sets its own multipart Content-Type with the boundary.
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const auth = await authHeader()
  if (auth) headers.set('Authorization', auth)

  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Cannot reach the studio server. Is the backend running?', 0)
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401) setToken(null)
    throw new ApiError(typeof detail === 'string' ? detail : 'Request failed', res.status)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
