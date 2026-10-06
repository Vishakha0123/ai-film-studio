import { DEMO_MODE, delay, request, setToken } from './client'
import { FILM_PROJECT, type FilmProject } from '../types'

export { DEMO_MODE, ApiError, getToken } from './client'

/* ---------- Auth ---------- */

export interface Session {
  token: string
  email: string
}

export async function signIn(email: string, password: string, mode: 'login' | 'signup' = 'login'): Promise<Session> {
  if (DEMO_MODE) {
    await delay(1200)
    const session = { token: 'demo-token', email }
    setToken(session.token)
    return session
  }
  const session = await request<Session>(mode === 'login' ? '/auth/login' : '/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(session.token)
  return session
}

export async function signInWithGoogle(): Promise<Session> {
  if (DEMO_MODE) {
    await delay(1000)
    const session = { token: 'demo-token', email: 'director@cinema.ai' }
    setToken(session.token)
    return session
  }
  // Live mode: the backend returns the OAuth redirect URL.
  const { url } = await request<{ url: string }>('/auth/google')
  window.location.href = url
  return new Promise(() => {})
}

export function signOut() {
  setToken(null)
}

/* ---------- Film pipeline ---------- */

export interface StoryRequest {
  prompt: string
  genres?: string[]
}

/** Generates the story (and the rest of the project scaffold) from a film idea. */
export async function generateStory(req: StoryRequest): Promise<FilmProject> {
  if (DEMO_MODE) {
    await delay(300)
    return FILM_PROJECT
  }
  return request<FilmProject>('/story', { method: 'POST', body: JSON.stringify(req) })
}

export interface GenerationStatus {
  stage: string
  progress: number // 0-100
  done: boolean
}

export async function startTeaserGeneration(projectTitle: string): Promise<{ jobId: string }> {
  if (DEMO_MODE) return { jobId: 'demo-job' }
  return request<{ jobId: string }>('/video', { method: 'POST', body: JSON.stringify({ title: projectTitle }) })
}

export async function getGenerationStatus(jobId: string): Promise<GenerationStatus> {
  return request<GenerationStatus>(`/projects/${encodeURIComponent(jobId)}/status`)
}
