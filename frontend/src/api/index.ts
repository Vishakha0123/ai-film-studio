import { AUTH_PROVIDER, DEMO_MODE, delay, getSupabase, request, setToken, ApiError } from './client'
import { FILM_PROJECT } from '../types'
import type { CostEstimate, Job, ProjectData } from '../types'

export { DEMO_MODE, AUTH_PROVIDER, ApiError, getToken } from './client'

/* ---------- Auth ---------- */

export interface Session {
  email: string
}

export async function signIn(email: string, password: string, mode: 'login' | 'signup' = 'login'): Promise<Session> {
  if (AUTH_PROVIDER === 'demo') {
    await delay(1200)
    setToken('demo-token')
    return { email }
  }
  if (AUTH_PROVIDER === 'dev') {
    // Backend AUTH_MODE=dev accepts "dev:<email>" tokens (local development only).
    setToken(`dev:${email.trim().toLowerCase()}`)
    await request('/me')
    return { email }
  }
  const supabase = await getSupabase()!
  const { data, error } =
    mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
  if (error) throw new ApiError(error.message, error.status ?? 400)
  if (!data.session) throw new ApiError('Check your email to confirm your account, then sign in.', 400)
  setToken('supabase')
  return { email: data.user?.email ?? email }
}

export async function signInWithGoogle(): Promise<Session> {
  if (AUTH_PROVIDER === 'demo') {
    await delay(1000)
    setToken('demo-token')
    return { email: 'director@cinema.ai' }
  }
  if (AUTH_PROVIDER === 'dev') throw new ApiError('Google sign-in needs Supabase. Use email in dev mode.', 400)
  const supabase = await getSupabase()!
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/onboarding` },
  })
  if (error) throw new ApiError(error.message, 400)
  return new Promise(() => {}) // browser redirects to Google
}

export async function signOut() {
  setToken(null)
  const supabase = getSupabase()
  if (supabase) await (await supabase).auth.signOut()
}

/* ---------- Projects ---------- */

const demoProject = (): ProjectData => ({ id: 'demo', title: FILM_PROJECT.title, genre: FILM_PROJECT.genre, status: 'planned', memory: FILM_PROJECT, assets: [] })

export async function createProject(genres: string[], language = 'en'): Promise<ProjectData> {
  if (DEMO_MODE) return demoProject()
  return request<ProjectData>('/projects', { method: 'POST', body: JSON.stringify({ genres, language }) })
}

export async function getProject(id: string): Promise<ProjectData> {
  if (DEMO_MODE) return demoProject()
  return request<ProjectData>(`/projects/${encodeURIComponent(id)}`)
}

export interface BriefInput {
  prompt: string
  genres?: string[]
  language?: string
  teaserSeconds?: number
  aspectRatio?: '16:9' | '9:16' | '1:1'
}

export async function saveBrief(id: string, brief: BriefInput): Promise<ProjectData> {
  if (DEMO_MODE) return demoProject()
  return request<ProjectData>(`/projects/${encodeURIComponent(id)}/brief`, { method: 'POST', body: JSON.stringify(brief) })
}

/* ---------- Jobs ---------- */

const demoJob = (task: string): Job => ({ id: `demo-${task}`, projectId: 'demo', task, status: 'completed', stage: 'Done', progress: 100, result: {}, cost: 0, error: '' })

export async function planProject(id: string): Promise<Job> {
  if (DEMO_MODE) return demoJob('plan')
  return request<Job>(`/projects/${encodeURIComponent(id)}/plan`, { method: 'POST', body: '{}' })
}

export type EditAction = 'continue' | 'complete' | 'improve' | 'transform'

export async function editProject(id: string, action: EditAction, target: string, instruction: string): Promise<Job> {
  if (DEMO_MODE) return demoJob('edit')
  return request<Job>(`/projects/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify({ target, instruction }) })
}

export async function estimateCost(id: string, quality: 'draft' | 'final' = 'draft'): Promise<CostEstimate> {
  return request<CostEstimate>(`/projects/${encodeURIComponent(id)}/estimate?quality=${quality}`)
}

export async function startGeneration(id: string, quality: 'draft' | 'final' = 'draft', confirmCost = false): Promise<Job> {
  return request<Job>(`/projects/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `gen-${id}-${quality}-${Date.now()}` },
    body: JSON.stringify({ quality, confirmCost }),
  })
}

export async function startRender(id: string, format: string, quality: string): Promise<Job> {
  return request<Job>(`/projects/${encodeURIComponent(id)}/render`, { method: 'POST', body: JSON.stringify({ format, quality }) })
}

export async function regenerateAsset(assetId: string): Promise<Job> {
  return request<Job>(`/assets/${encodeURIComponent(assetId)}/regenerate`, { method: 'POST' })
}

export async function getJob(id: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(id)}`)
}

const FINISHED = new Set(['completed', 'failed', 'cancelled', 'needs_review'])

/** Polls /jobs/{id} until the job finishes (report: frontend polling every few seconds). */
export async function waitForJob(job: Job, onUpdate?: (j: Job) => void, opts: { intervalMs?: number; signal?: AbortSignal } = {}): Promise<Job> {
  let current = job
  onUpdate?.(current)
  while (!FINISHED.has(current.status)) {
    await delay(opts.intervalMs ?? 1500)
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    current = await getJob(current.id)
    onUpdate?.(current)
  }
  return current
}

/** Throws a readable error unless the job completed. */
export function assertCompleted(job: Job): Job {
  if (job.status === 'completed') return job
  throw new ApiError(job.error || `The ${job.task} job ${job.status.replace('_', ' ')}.`, 0)
}

export async function approveStep(id: string, step: string, approved = true): Promise<void> {
  if (DEMO_MODE) return
  await request(`/projects/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ step, approved }) })
}

/* ---------- Workspace: projects, assets, account ---------- */

import { API_BASE } from './client'
import { DEFAULT_PREFERENCES, photoUrl } from '../types'
import type { AssetListItem, Health, Me, Preferences, ProjectSummary } from '../types'

const DEMO_PREFS_KEY = 'cineai.demoPreferences'

function demoSummary(): ProjectSummary {
  const now = new Date().toISOString()
  return { id: 'demo', title: FILM_PROJECT.title, genre: FILM_PROJECT.genre, status: 'planned', logline: FILM_PROJECT.logline,
    thumbnailUrl: photoUrl(FILM_PROJECT.shots[0], 640, 360), assetCount: FILM_PROJECT.characters.length + FILM_PROJECT.shots.length, createdAt: now, updatedAt: now }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (DEMO_MODE) return [demoSummary()]
  return request<ProjectSummary[]>('/projects')
}

export async function renameProject(id: string, title: string): Promise<ProjectData> {
  if (DEMO_MODE) return { ...demoProject(), title }
  return request<ProjectData>(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ title }) })
}

export async function deleteProject(id: string): Promise<void> {
  if (DEMO_MODE) throw new ApiError('The sample film can’t be deleted in demo mode.', 400)
  await request<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listAssets(filter: { projectId?: string; type?: string } = {}): Promise<AssetListItem[]> {
  if (DEMO_MODE) {
    const now = new Date().toISOString()
    const base = { provider: 'sample', version: 1, status: 'ready', meta: {}, projectId: 'demo', projectTitle: FILM_PROJECT.title, createdAt: now }
    const items: AssetListItem[] = [
      ...FILM_PROJECT.characters.map(c => ({ ...base, id: `c${c.id}`, type: 'character_image', ref: c.id, url: photoUrl(c, 400, 400), meta: { name: c.name } })),
      ...FILM_PROJECT.shots.map(s => ({ ...base, id: `s${s.number}`, type: 'storyboard_image', ref: String(s.number), url: photoUrl(s, 640, 360) })),
    ]
    return items.filter(a => !filter.type || a.type === filter.type)
  }
  const q = new URLSearchParams()
  if (filter.projectId) q.set('project_id', filter.projectId)
  if (filter.type) q.set('type', filter.type)
  return request<AssetListItem[]>(`/assets${q.toString() ? `?${q}` : ''}`)
}

export async function getMe(): Promise<Me> {
  if (DEMO_MODE) {
    let prefs = DEFAULT_PREFERENCES
    try {
      prefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(DEMO_PREFS_KEY) || '{}') }
    } catch {
      /* ignore */
    }
    return { id: 'demo', email: 'director@cinema.ai', preferences: prefs }
  }
  return request<Me>('/me')
}

export async function savePreferences(prefs: Preferences): Promise<Me> {
  if (DEMO_MODE) {
    try {
      localStorage.setItem(DEMO_PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* ignore */
    }
    return { id: 'demo', email: 'director@cinema.ai', preferences: prefs }
  }
  return request<Me>('/me', { method: 'PATCH', body: JSON.stringify(prefs) })
}

export async function getHealth(): Promise<Health | null> {
  if (DEMO_MODE) return null
  try {
    const res = await fetch(`${API_BASE}/health`)
    return res.ok ? ((await res.json()) as Health) : null
  } catch {
    return null
  }
}
