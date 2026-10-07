import { describe, it, expect, vi, afterEach } from 'vitest'
import { signIn, signOut, getToken, createProject, planProject, DEMO_MODE } from './index'
import { request, ApiError } from './client'
import { FILM_PROJECT } from '../types'

afterEach(() => vi.restoreAllMocks())

describe('api (demo mode)', () => {
  it('runs in demo mode when VITE_API_URL is not set', () => {
    expect(DEMO_MODE).toBe(true)
  })

  it('signIn stores a session token and signOut clears it', async () => {
    const session = await signIn('a@b.co', 'pw')
    expect(session.email).toBe('a@b.co')
    expect(getToken()).toBe('demo-token')
    signOut()
    expect(getToken()).toBeNull()
  })

  it('projects and jobs resolve with the sample film', async () => {
    const project = await createProject(['Horror'])
    expect(project.memory?.title).toBe(FILM_PROJECT.title)
    expect(project.memory?.characters).toHaveLength(3)
    const job = await planProject(project.id)
    expect(job.status).toBe('completed')
  })
})

describe('request()', () => {
  it('sends JSON with the bearer token to /api/v1', async () => {
    localStorage.setItem('cineai.token', 'tok')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    const res = await request<{ ok: number }>('/story', { method: 'POST', body: '{}' })
    expect(res.ok).toBe(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/story')
    const headers = new Headers((init as RequestInit).headers)
    expect(headers.get('Authorization')).toBe('Bearer tok')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('throws ApiError with the FastAPI detail message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ detail: 'Invalid credentials' }), { status: 401 }))
    await expect(request('/auth/login')).rejects.toMatchObject({ message: 'Invalid credentials', status: 401 })
    await expect(request('/auth/login')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('live mode (VITE_API_URL set, dev login)', () => {
  async function liveApi() {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    return import('./index')
  }
  afterEach(() => vi.unstubAllEnvs())

  it('dev sign-in sends a dev token to /me', async () => {
    const api = await liveApi()
    expect(api.AUTH_PROVIDER).toBe('dev')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'u', email: 'a@b.co' })))
    await api.signIn('A@B.co', 'x')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/api/v1/me')
    expect(new Headers((init as RequestInit).headers).get('Authorization')).toBe('Bearer dev:a@b.co')
  })

  it('waitForJob polls /jobs/{id} until the job finishes', async () => {
    const api = await liveApi()
    const job = (status: string, progress: number) => new Response(JSON.stringify({ id: 'j1', projectId: 'p', task: 'plan', status, stage: 's', progress, result: {}, cost: 0, error: '' }))
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(job('running', 50))
      .mockResolvedValueOnce(job('completed', 100))
    const seen: number[] = []
    const done = await api.waitForJob({ id: 'j1', projectId: 'p', task: 'plan', status: 'queued', stage: '', progress: 0, result: {}, cost: 0, error: '' }, j => seen.push(j.progress), { intervalMs: 1 })
    expect(done.status).toBe('completed')
    expect(seen).toEqual([0, 50, 100])
    expect(fetchMock.mock.calls.every(([u]) => u === 'http://api.test/api/v1/jobs/j1')).toBe(true)
  })

  it('assertCompleted surfaces the backend explanation', async () => {
    const api = await liveApi()
    expect(() => api.assertCompleted({ id: 'j', projectId: 'p', task: 'render', status: 'needs_review', stage: '', progress: 0, result: {}, cost: 0, error: 'Connect a video provider' })).toThrow('Connect a video provider')
  })

  it('network failure becomes a readable error', async () => {
    const api = await liveApi()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.getProject('p')).rejects.toThrow('Cannot reach the studio server')
  })
})
