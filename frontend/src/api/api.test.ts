import { describe, it, expect, vi, afterEach } from 'vitest'
import { signIn, signOut, getToken, generateStory, DEMO_MODE } from './index'
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

  it('generateStory returns the sample film project', async () => {
    const project = await generateStory({ prompt: 'a ghost story' })
    expect(project.title).toBe(FILM_PROJECT.title)
    expect(project.characters).toHaveLength(3)
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
