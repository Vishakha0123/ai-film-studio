import { AUTH_PROVIDER, DEMO_MODE, delay, getSupabase, request, requestRaw, setToken, ApiError } from './client'
import { FILM_PROJECT } from '../types'
import type { CostEstimate, Job, ProjectData } from '../types'

export { DEMO_MODE, AUTH_PROVIDER, ApiError, getToken } from './client'

/* ---------- Auth ---------- */

export type AuthProvider = 'google' | 'apple'

export interface Session {
  email: string
}

/**
 * Sign in with Google or Apple. There is no email/password form: Supabase hosts the
 * provider's consent screen and redirects back to /onboarding with the session.
 *  - demo: signs straight in (no backend)
 *  - dev:  backend AUTH_MODE=dev; each provider maps to a fixed local test user
 */
export async function signInWithProvider(provider: AuthProvider): Promise<Session> {
  if (AUTH_PROVIDER === 'demo') {
    await delay(1000)
    setToken('demo-token')
    return { email: 'director@cinema.ai' }
  }
  if (AUTH_PROVIDER === 'dev') {
    const email = `${provider}-user@dev.local`
    setToken(`dev:${email}`)
    await request('/me')
    return { email }
  }
  const supabase = await getSupabase()!
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/onboarding` },
  })
  if (error) throw new ApiError(error.message, 400)
  return new Promise(() => {}) // the browser is redirected to Google / Apple
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

/** Plans the film. Passing the idea too means the plan never depends on the saved brief alone. */
export async function planProject(id: string, prompt?: string): Promise<Job> {
  if (DEMO_MODE) return demoJob('plan')
  return request<Job>(`/projects/${encodeURIComponent(id)}/plan`, { method: 'POST', body: JSON.stringify(prompt ? { prompt } : {}) })
}

export type EditAction = 'continue' | 'complete' | 'improve' | 'transform'

/** Narrows an edit so the AI reads and rewrites only what changes — much faster. */
export interface EditScope {
  /** A selected passage of a text field (e.g. part of the screenplay) */
  passage?: string
  /** One item of a list field: its id, or its 1-based position */
  item?: string
}

export async function editProject(id: string, action: EditAction, target: string, instruction: string, scope: EditScope = {}): Promise<Job> {
  if (DEMO_MODE) return demoJob('edit')
  return request<Job>(`/projects/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify({ target, instruction, ...scope }) })
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

/** Keeps the AI Director conversation with the film (so a refresh or another device shows it). */
export async function saveChat(projectId: string, messages: import('../types').ChatMessage[], keepalive = false): Promise<void> {
  if (DEMO_MODE) return
  await request<void>(`/projects/${encodeURIComponent(projectId)}/chat`, { method: 'PUT', body: JSON.stringify({ messages }), keepalive })
}

/** The film's jobs, newest first; `active` = only ones still queued or running. */
export async function listProjectJobs(projectId: string, active = false): Promise<Job[]> {
  if (DEMO_MODE) return []
  return request<Job[]>(`/projects/${encodeURIComponent(projectId)}/jobs${active ? '?active=true' : ''}`)
}

/** Photorealistic portraits: the listed characters (a new photo each), or everyone without one. */
export async function makePortraits(projectId: string, characterIds?: string[]): Promise<Job> {
  if (DEMO_MODE) throw new ApiError('Photo portraits need the studio backend and an image model.', 400)
  return request<Job>(`/projects/${encodeURIComponent(projectId)}/portraits`, { method: 'POST', body: JSON.stringify(characterIds ? { characterIds } : {}) })
}

export async function getJob(id: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(id)}`)
}

const FINISHED = new Set(['completed', 'failed', 'cancelled', 'needs_review'])

/** Polls /jobs/{id} until the job finishes (report: frontend polling every few seconds). */
export async function waitForJob(job: Job, onUpdate?: (j: Job) => void, opts: { intervalMs?: number; signal?: AbortSignal } = {}): Promise<Job> {
  let current = job
  onUpdate?.(current)
  let polls = 0
  while (!FINISHED.has(current.status)) {
    // Check quickly at first (short edits finish in a few seconds), then ease off for long jobs.
    await delay(opts.intervalMs ?? (polls++ < 6 ? 500 : 1500))
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

/** Deletes several projects at once; ids that aren't yours come back in notFound. */
export async function deleteProjects(ids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
  if (DEMO_MODE) throw new ApiError('The sample film can’t be deleted in demo mode.', 400)
  return request<{ deleted: string[]; notFound: string[] }>('/projects/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) })
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

/* ---------- Voice & your data ---------- */

/** Bulbul v3 voices (same list as backend/app/services/voices.py). */
export const VOICES = [
  'shubh', 'aditya', 'ritu', 'priya', 'neha', 'rahul', 'pooja', 'rohan', 'simran', 'kavya', 'amit', 'dev',
  'ishita', 'shreya', 'ratan', 'varun', 'manan', 'sumit', 'roopa', 'kabir', 'aayan', 'ashutosh', 'advait',
  'anand', 'tanya', 'tarun', 'sunny', 'mani', 'gokul', 'vijay', 'shruti', 'suhani', 'mohit', 'kavitha',
  'rehan', 'soham', 'rupali',
] as const

/** A short line spoken in the chosen voice, pace and language (WAV). */
export async function previewVoice(voice: string, pace: number, language: string): Promise<Blob> {
  if (DEMO_MODE) throw new ApiError('Voice preview needs the studio backend.', 400)
  const res = await requestRaw('/voice/preview', { method: 'POST', body: JSON.stringify({ voice, pace, language }) })
  return res.blob()
}

/** Account, settings and every film as one JSON file. */
export async function exportMyData(): Promise<Blob> {
  if (DEMO_MODE) {
    const me = await getMe()
    return new Blob([JSON.stringify({ account: me, films: [demoProject()] }, null, 2)], { type: 'application/json' })
  }
  return (await requestRaw('/me/export')).blob()
}

/** Deletes the creator's films, files and settings, then signs them out. */
export async function deleteAccount(): Promise<void> {
  if (DEMO_MODE) throw new ApiError('There is no account to delete in demo mode.', 400)
  await request<void>('/me', { method: 'DELETE' })
  await signOut()
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

/* ---------- Attachments & voice input ---------- */

import type { ProjectDocument } from '../types'

/** File types the AI Director accepts as source material (validated again on the server). */
export const ATTACHMENT_ACCEPT = '.pdf,.docx,.txt,.md,.fountain,.png,.jpg,.jpeg,.webp'
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS = 5

export async function uploadDocument(projectId: string, file: File): Promise<ProjectDocument> {
  if (DEMO_MODE) {
    await delay(300)
    const kind = /\.(png|jpe?g|webp)$/i.test(file.name) ? 'image' : /\.pdf$/i.test(file.name) ? 'pdf' : /\.docx$/i.test(file.name) ? 'docx' : 'text'
    const preview = kind === 'text' ? (await file.text()).slice(0, 280) : ''
    return { id: `demo-${file.name}`, filename: file.name, type: kind, size: file.size, fileUrl: '', sourceReference: '', preview, createdAt: new Date().toISOString() }
  }
  const form = new FormData()
  form.append('file', file)
  return request<ProjectDocument>(`/projects/${encodeURIComponent(projectId)}/documents`, { method: 'POST', body: form })
}

export async function listDocuments(projectId: string): Promise<ProjectDocument[]> {
  if (DEMO_MODE) return []
  return request<ProjectDocument[]>(`/projects/${encodeURIComponent(projectId)}/documents`)
}

/** Server-side speech-to-text (Sarvam). Returns the transcript. */
export async function transcribeAudio(audio: Blob, language: string): Promise<string> {
  const form = new FormData()
  form.append('audio', audio, audio.type.includes('mp4') ? 'voice.m4a' : 'voice.webm')
  form.append('language', language)
  const res = await request<{ text: string; provider: string }>('/transcribe', { method: 'POST', body: form })
  return res.text
}

/* ---------- Language versions ---------- */

/**
 * The same film in another language — the creator doesn't retype the idea. The backend copies the
 * project (brief, source files, pictures) into a new one and translates every text in a job.
 */
export async function createLanguageVersion(projectId: string, language: string): Promise<{ project: ProjectData; job: Job }> {
  if (DEMO_MODE) throw new ApiError('Making the film in another language needs the studio backend — the demo film stays in English.', 400)
  return request<{ project: ProjectData; job: Job }>(`/projects/${encodeURIComponent(projectId)}/versions`, {
    method: 'POST',
    body: JSON.stringify({ language }),
  })
}

/** Starts a language version, waits for the translation, and returns the finished project. */
export async function makeLanguageVersion(projectId: string, language: string, onStage?: (stage: string) => void): Promise<ProjectData> {
  const { project, job } = await createLanguageVersion(projectId, language)
  assertCompleted(await waitForJob(job, j => onStage?.(j.stage || 'Queued')))
  return getProject(project.id)
}

/* ---------- Characters ---------- */

export type CharacterInput = Partial<Pick<import('../types').Character, 'name' | 'age' | 'gender' | 'role' | 'personality' | 'appearance' | 'arc' | 'relationships'>>

const NEEDS_BACKEND = 'Changing characters needs the studio backend — the demo film can’t be edited.'

export async function addCharacter(projectId: string, data: CharacterInput): Promise<ProjectData> {
  if (DEMO_MODE) throw new ApiError(NEEDS_BACKEND, 400)
  return request<ProjectData>(`/projects/${encodeURIComponent(projectId)}/characters`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateCharacter(projectId: string, characterId: string, data: CharacterInput): Promise<ProjectData> {
  if (DEMO_MODE) throw new ApiError(NEEDS_BACKEND, 400)
  return request<ProjectData>(`/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function removeCharacter(projectId: string, characterId: string): Promise<ProjectData> {
  if (DEMO_MODE) throw new ApiError(NEEDS_BACKEND, 400)
  return request<ProjectData>(`/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}`, { method: 'DELETE' })
}

/* ---------- Hand edits ---------- */

export type MemoryPatch = Partial<Pick<import('../types').FilmProject, 'story' | 'logline' | 'screenplay' | 'tone' | 'visualStyle' | 'scenes' | 'shots' | 'dialogue' | 'lyrics'>>

/** Saves the creator's own edits to parts of the film; pictures that no longer match are marked outdated. */
export async function patchMemory(projectId: string, patch: MemoryPatch): Promise<ProjectData> {
  if (DEMO_MODE) throw new ApiError('Saving changes needs the studio backend — the demo film can’t be edited.', 400)
  return request<ProjectData>(`/projects/${encodeURIComponent(projectId)}/memory`, { method: 'PATCH', body: JSON.stringify(patch) })
}

/* ---------- Full-length film (10 minutes – 2 hours) ---------- */

import type { LongFilm, LongFilmScene } from '../types'

const NEEDS_SERVER = 'A full-length film needs the studio backend — it can’t be made in demo mode.'
const filmPath = (projectId: string, rest = '') => `/projects/${encodeURIComponent(projectId)}/film${rest}`

/** The film's full-length version, or null when none was started. */
export async function getLongFilm(projectId: string): Promise<LongFilm | null> {
  if (DEMO_MODE) return null
  return request<LongFilm | null>(filmPath(projectId))
}

/** Plan (or re-plan) the full-length version: the scene outline for the target length. */
export async function planLongFilm(projectId: string, targetMinutes: number, budgetCap: number, quality: 'draft' | 'final' = 'draft'): Promise<LongFilm> {
  if (DEMO_MODE) throw new ApiError(NEEDS_SERVER, 400)
  return request<LongFilm>(filmPath(projectId), { method: 'POST', body: JSON.stringify({ targetMinutes, budgetCap, quality }) })
}

export async function updateLongFilm(projectId: string, change: { budgetCap?: number; quality?: 'draft' | 'final' }): Promise<LongFilm> {
  return request<LongFilm>(filmPath(projectId), { method: 'PATCH', body: JSON.stringify(change) })
}

export async function getLongFilmScene(projectId: string, scene: number): Promise<LongFilmScene> {
  return request<LongFilmScene>(filmPath(projectId, `/scenes/${scene}`))
}

/** Make the scenes (or continue after a pause or a budget stop). */
export async function generateLongFilm(projectId: string, confirmCost = false): Promise<LongFilm> {
  return request<LongFilm>(filmPath(projectId, '/generate'), { method: 'POST', body: JSON.stringify({ confirmCost }) })
}

export async function pauseLongFilm(projectId: string): Promise<LongFilm> {
  return request<LongFilm>(filmPath(projectId, '/pause'), { method: 'POST' })
}

export async function retryLongFilmShot(projectId: string, shotId: string): Promise<LongFilm> {
  return request<LongFilm>(filmPath(projectId, `/shots/${encodeURIComponent(shotId)}/retry`), { method: 'POST' })
}

export async function retryLongFilmScene(projectId: string, scene: number): Promise<LongFilm> {
  return request<LongFilm>(filmPath(projectId, `/scenes/${scene}/retry`), { method: 'POST' })
}

export async function renderLongFilm(projectId: string): Promise<LongFilm> {
  return request<LongFilm>(filmPath(projectId, '/render'), { method: 'POST' })
}

export interface LongFilmSceneEdit {
  title?: string
  summary?: string
  location?: string
  script?: string
  shots?: { id: string; description?: string; camera?: string; movement?: string; dialogue?: { character: string; text: string }[] }[]
}

/** Hand edits to one scene; shots whose picture or words changed are made again, the rest are kept. */
export async function editLongFilmScene(projectId: string, scene: number, edit: LongFilmSceneEdit): Promise<LongFilmScene> {
  return request<LongFilmScene>(filmPath(projectId, `/scenes/${scene}`), { method: 'PATCH', body: JSON.stringify(edit) })
}

/** Direct the AI: it rewrites one scene's script and shots from the instruction (a background job). */
export async function rewriteLongFilmScene(projectId: string, scene: number, instruction: string): Promise<Job> {
  return request<Job>(filmPath(projectId, `/scenes/${scene}/rewrite`), { method: 'POST', body: JSON.stringify({ instruction }) })
}

/** Scripts only: write every scene's script and shots, without making any video, pictures or voices. */
export async function writeLongFilmScripts(projectId: string): Promise<LongFilm> {
  return request<LongFilm>(filmPath(projectId, '/scripts'), { method: 'POST' })
}

/** The whole film's screenplay as a text file. */
export async function downloadLongFilmScript(projectId: string): Promise<{ blob: Blob; filename: string }> {
  const res = await requestRaw(filmPath(projectId, '/script'))
  const header = res.headers.get('Content-Disposition') ?? ''
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1]
  const name = (utf8 && decodeURIComponent(utf8)) || /filename="([^"]+)"/.exec(header)?.[1] || 'script.txt'
  return { blob: await res.blob(), filename: name }
}
