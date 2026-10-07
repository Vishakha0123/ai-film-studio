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
