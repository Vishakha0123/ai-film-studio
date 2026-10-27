import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { LongFilm } from '../types'
import { FILM_PROJECT } from '../types'

const api = vi.hoisted(() => ({
  getProject: vi.fn(), getLongFilm: vi.fn(), planLongFilm: vi.fn(), generateLongFilm: vi.fn(), pauseLongFilm: vi.fn(),
  renderLongFilm: vi.fn(), writeLongFilmScripts: vi.fn(), downloadLongFilmScript: vi.fn(), retryLongFilmScene: vi.fn(), retryLongFilmShot: vi.fn(), updateLongFilm: vi.fn(), getLongFilmScene: vi.fn(),
}))
vi.mock('../api', async orig => ({ ...(await orig<typeof import('../api')>()), ...api, DEMO_MODE: false }))

import FullMovie, { duration } from '../screens/FullMovie'
import { ApiError } from '../api'

const live = { story: false, image: false, video: false, tts: false }
function film(over: Partial<LongFilm> = {}): LongFilm {
  return {
    id: 'f1', projectId: 'p1', status: 'planned', error: '', targetSeconds: 3600, shotSeconds: 8, quality: 'draft', budgetCap: 25,
    spent: 0, pauseRequested: false, hasTestClips: false, final: null, story: null,
    progress: { scenes: 2, scenesDone: 0, scenesFailed: 0, shots: 450, shotsDone: 0, shotsFailed: 0, percent: 0 },
    estimate: { scenes: 2, shots: 450, remainingShots: 450, videoSeconds: 3600, storyCalls: 2, dialogueLines: 225, estimatedCost: 0,
      fullProviderCost: 126.45, currency: 'USD', budgetCap: 25, spent: 0, liveProviders: live, quality: 'draft' },
    job: null,
    scenes: [
      { number: 1, act: 1, title: 'The letter arrives', summary: 'Paati opens it.', location: 'INT. HOUSE', characters: ['Paati'], targetSeconds: 1800, status: 'done', error: '', scripted: true, shots: 225, shotsDone: 225, shotsFailed: 0, previewUrl: 'http://x/s1.mp4' },
      { number: 2, act: 3, title: 'The river', summary: 'They cross.', location: 'EXT. RIVER', characters: ['Paati'], targetSeconds: 1800, status: 'failed', error: '1 shot(s) failed — retry them.', scripted: true, shots: 225, shotsDone: 224, shotsFailed: 1, previewUrl: null },
    ],
    ...over,
  }
}

function show() {
  return render(
    <MemoryRouter initialEntries={['/projects/p1/movie']}>
      <Routes><Route path="/projects/:id/movie" element={<FullMovie />} /></Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  api.getProject.mockResolvedValue({ id: 'p1', title: 'Paati', genre: 'Drama', status: 'planned', memory: FILM_PROJECT, assets: [] })
})

describe('full-length film page', () => {
  it('formats film lengths', () => {
    expect(duration(7200)).toBe('2h 00m')
    expect(duration(600)).toBe('10m 00s')
    expect(duration(45)).toBe('45s')
  })

  it('starts with the length choice (10 min to 2 hours) and plans the scenes with a budget cap', async () => {
    api.getLongFilm.mockResolvedValue(null)
    api.planLongFilm.mockResolvedValue(film({ status: 'planning', scenes: [] }))
    show()
    expect(await screen.findByTestId('movie-setup')).toBeInTheDocument()
    expect(screen.getByTestId('movie-test-notice')).toHaveTextContent('TEST CLIP')
    for (const l of ['10 min', '30 min', '1 hour', '2 hours']) expect(screen.getByRole('radio', { name: new RegExp(l) })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /2 hours/ }))
    const cap = screen.getByLabelText('Budget cap in US dollars')
    await userEvent.clear(cap)
    await userEvent.type(cap, '40')
    await userEvent.click(screen.getByTestId('movie-plan'))
    expect(api.planLongFilm).toHaveBeenCalledWith('p1', 120, 40, 'draft')
    expect(await screen.findByTestId('movie-planning')).toBeInTheDocument()
  })

  it('shows the estimate, scene states and asks to confirm paid work', async () => {
    api.getLongFilm.mockResolvedValue(film())
    api.generateLongFilm.mockRejectedValueOnce(new ApiError('Estimated cost $126.45 needs confirmation', 402))
      .mockResolvedValueOnce(film({ status: 'generating' }))
    show()
    expect(await screen.findByTestId('movie-estimate')).toHaveTextContent('$126.45')
    expect(screen.getByTestId('movie-scene-1')).toHaveTextContent('Ready')
    expect(screen.getByTestId('movie-scene-2')).toHaveTextContent('Failed')
    await userEvent.click(screen.getByTestId('movie-generate'))
    expect(await screen.findByTestId('movie-confirm')).toHaveTextContent('$126.45')
    await userEvent.click(screen.getByTestId('movie-confirm-yes'))
    expect(api.generateLongFilm).toHaveBeenLastCalledWith('p1', true)
    expect(await screen.findByTestId('movie-pause')).toBeInTheDocument()
  })

  it('retries a single failed shot', async () => {
    api.getLongFilm.mockResolvedValue(film({ status: 'failed' }))
    api.getLongFilmScene.mockResolvedValue({ number: 2, title: 'The river', summary: '', location: '', script: '', continuity: '', status: 'failed', error: '', previewUrl: null,
      shots: [{ id: 'sh7', number: 7, description: 'Wide river', camera: 'Wide', movement: 'Static', characters: [], dialogue: [], seconds: 8, status: 'failed', attempts: 3, error: 'timed out', clipUrl: null, clipKind: null }] })
    api.retryLongFilmShot.mockResolvedValue(film({ status: 'generating' }))
    show()
    await userEvent.click((await screen.findByTestId('movie-scene-2')).querySelector('button')!)
    await userEvent.click(await screen.findByTestId('movie-retry-shot-2-7'))
    expect(api.retryLongFilmShot).toHaveBeenCalledWith('p1', 'sh7')
  })

  it('a rendered film can be watched and downloaded, and says when it holds test clips', async () => {
    api.getLongFilm.mockResolvedValue(film({ status: 'rendered', hasTestClips: true, final: { url: 'http://x/film.mp4', seconds: 3600 } }))
    show()
    const final = await screen.findByTestId('movie-final')
    expect(final).toHaveTextContent('1h 00m')
    expect(final).toHaveTextContent('contains test clips')
    await waitFor(() => expect(screen.getByTestId('movie-download')).toHaveAttribute('href', 'http://x/film.mp4'))
  })
})

describe('editing a scene of the full-length film', () => {
  const sceneDetail = {
    number: 1, title: 'The letter arrives', summary: 'Paati opens it.', location: 'INT. HOUSE', script: 'INT. HOUSE — DAY', continuity: '',
    status: 'done' as const, error: '', previewUrl: null,
    shots: [
      { id: 'a', number: 1, description: 'Wide house', camera: 'Wide', movement: 'Static', characters: [], dialogue: [{ character: 'Paati', text: 'Who is it?' }], seconds: 8, status: 'done' as const, attempts: 1, error: '', clipUrl: null, clipKind: 'test' as const },
      { id: 'b', number: 2, description: 'Close on letter', camera: 'Close-up', movement: 'Push-in', characters: [], dialogue: [], seconds: 8, status: 'done' as const, attempts: 1, error: '', clipUrl: null, clipKind: 'test' as const },
    ],
  }

  it('hand edits send only the shots that changed', async () => {
    api.getLongFilm.mockResolvedValue(film({ status: 'generated' }))
    api.getLongFilmScene.mockResolvedValue(sceneDetail)
    const editApi = vi.spyOn(await import('../api'), 'editLongFilmScene').mockResolvedValue({ ...sceneDetail, script: 'NEW' })
    show()
    await userEvent.click((await screen.findByTestId('movie-scene-1')).querySelector('button')!)
    await userEvent.click(await screen.findByTestId('movie-edit-scene-1'))
    const line = screen.getByLabelText('Shot 1 line 1')
    await userEvent.clear(line)
    await userEvent.type(line, 'Kanna, is that you?')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(editApi).toHaveBeenCalled())
    const [, n, body] = editApi.mock.calls[0]
    expect(n).toBe(1)
    expect(body.shots).toEqual([{ id: 'a', description: 'Wide house', camera: 'Wide', movement: 'Static', dialogue: [{ character: 'Paati', text: 'Kanna, is that you?' }] }])
  })
})

describe('script only (no video)', () => {
  it('writes the full script without making video, and offers the script download', async () => {
    const unwritten = film({ scenes: film().scenes.map(s => ({ ...s, status: 'planned' as const, scripted: false, shots: 0, shotsDone: 0, shotsFailed: 0, previewUrl: null })) })
    api.getLongFilm.mockResolvedValue(unwritten)
    api.writeLongFilmScripts.mockResolvedValue({ ...unwritten, status: 'planned', scenes: film().scenes })
    show()
    expect(await screen.findByTestId('movie-script-count')).toHaveTextContent('0/2 scenes written')
    expect(screen.queryByTestId('movie-download-script')).toBeNull()
    await userEvent.click(screen.getByTestId('movie-write-script'))
    expect(api.writeLongFilmScripts).toHaveBeenCalledWith('p1')
    expect(api.generateLongFilm).not.toHaveBeenCalled()
    expect(await screen.findByTestId('movie-download-script')).toBeInTheDocument()
    expect(screen.getByTestId('movie-script-count')).toHaveTextContent('2/2 scenes written')
  })
})

describe('feature story', () => {
  it('shows the feature-length story and marks the characters added for it', async () => {
    api.getLongFilm.mockResolvedValue(film({ story: { story: 'Part one.\n\nPart two.', acts: [], subplots: ['A family secret'], newCharacters: ['Ravi'],
      cast: [{ name: 'Paati', age: '72', gender: 'female', role: 'Lead' }, { name: 'Ravi', age: '45', gender: 'male', role: 'Ally' }] } }))
    show()
    expect(await screen.findByTestId('movie-story-text')).toHaveTextContent('Part two.')
    expect(screen.getByTestId('movie-story')).toHaveTextContent('2 characters (1 added for the full-length story)')
    expect(screen.getByTestId('movie-cast')).toHaveTextContent('Ravi · 45 · new')
    expect(screen.getByTestId('movie-story')).toHaveTextContent('A family secret')
  })
})
