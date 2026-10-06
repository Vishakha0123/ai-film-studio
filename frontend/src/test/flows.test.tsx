import { describe, it, expect } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

describe('public screens', () => {
  it('landing shows the hero and routes to login', async () => {
    renderApp('/')
    expect(screen.getByText('Turn Your Ideas')).toBeInTheDocument()
    expect(screen.getByText('Into Films.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create With AI' }))
    expect(screen.getByTestId('screen-login')).toBeInTheDocument()
  })

  it('protected screens redirect to login when signed out', () => {
    renderApp('/director')
    expect(screen.getByTestId('screen-login')).toBeInTheDocument()
  })

  it('unknown routes go to landing', () => {
    renderApp('/nope')
    expect(screen.getByTestId('screen-landing')).toBeInTheDocument()
  })
})

describe('authentication', () => {
  it('signs in with email/password and lands on onboarding', async () => {
    renderApp('/login')
    await userEvent.type(screen.getByLabelText('Email address'), 'dir@film.ai')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByText('Signing in…')).toBeInTheDocument()
    expect(await screen.findByTestId('screen-onboarding', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(localStorage.getItem('cineai.token')).toBe('demo-token')
  })

  it('toggles between sign in and sign up', async () => {
    renderApp('/login')
    expect(screen.getByText('Welcome back, director.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }))
    expect(screen.getByText('Begin your first film.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
  })
})

describe('onboarding', () => {
  it('selecting genres updates the continue button', async () => {
    renderApp('/onboarding', { loggedIn: true })
    const cta = screen.getByRole('button', { name: 'Select a genre to continue' })
    expect(cta).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /Horror/ }))
    await userEvent.click(screen.getByRole('button', { name: /Thriller/ }))
    await userEvent.click(screen.getByRole('button', { name: /Drama/ }))
    const go = screen.getByRole('button', { name: 'Continue with Horror & Thriller +more' })
    await userEvent.click(go)
    expect(screen.getByTestId('screen-director')).toBeInTheDocument()
  })
})

describe('AI Director', { timeout: 15000 }, () => {
  it('locked panels cannot be opened before the story exists', async () => {
    renderApp('/director/story', { loggedIn: true })
    // redirected back to chat
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
    expect(screen.getByTestId('nav-story')).toHaveAttribute('aria-disabled', 'true')
  })

  it('chat generates a story, unlocks the Story panel and keeps chat history', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
    expect(screen.getByText('A ghost in a lighthouse')).toBeInTheDocument()
    // AI moves to the Story panel automatically
    expect(await screen.findByTestId('panel-story', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByTestId('panel-title')).toHaveTextContent('Story')
    expect(screen.getByTestId('nav-story')).toHaveAttribute('aria-disabled', 'false')

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.getByText('Accepted')).toBeInTheDocument()

    // Back to chat: history is preserved (was lost in the prototype)
    await userEvent.click(screen.getByTestId('nav-chat'))
    expect(screen.getByText('A ghost in a lighthouse')).toBeInTheDocument()
    expect(screen.getByTestId('card-story')).toBeInTheDocument()
  })

  it('full director walk-through unlocks every stage', async () => {
    renderApp('/director', { loggedIn: true })
    const panels = ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio']
    for (const p of panels) {
      if (!screen.queryByTestId('panel-chat')) await userEvent.click(screen.getByTestId('nav-chat'))
      await userEvent.type(screen.getByLabelText('Message the AI Director'), `next ${p}{Enter}`)
      expect(await screen.findByTestId(`panel-${p}`, {}, { timeout: 2000 })).toBeInTheDocument()
    }
    for (const p of [...panels, 'music']) {
      expect(screen.getByTestId(`nav-${p}`)).toHaveAttribute('aria-disabled', 'false')
    }
    await userEvent.click(screen.getByTestId('nav-music'))
    expect(screen.getByTestId('panel-music')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Generate Teaser ▶' })).toBeInTheDocument()
  })
})

describe('panels', { timeout: 15000 }, () => {
  async function unlockAll() {
    renderApp('/director', { loggedIn: true })
    for (const p of ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio']) {
      if (!screen.queryByTestId('panel-chat')) await userEvent.click(screen.getByTestId('nav-chat'))
      await userEvent.type(screen.getByLabelText('Message the AI Director'), 'go{Enter}')
      await screen.findByTestId(`panel-${p}`, {}, { timeout: 2000 })
    }
  }

  it('lyrics tabs switch the editor content', async () => {
    await unlockAll()
    await userEvent.click(screen.getByTestId('nav-lyrics'))
    expect((screen.getByLabelText('Verse lyrics') as HTMLTextAreaElement).value).toContain('Between the rests')
    await userEvent.click(screen.getByRole('tab', { name: 'Chorus' }))
    expect((screen.getByLabelText('Chorus lyrics') as HTMLTextAreaElement).value).toContain('I am the music in the walls')
  })

  it('audio tracks can be muted', async () => {
    await unlockAll()
    await userEvent.click(screen.getByTestId('nav-audio'))
    const row = screen.getByTestId('track-3')
    expect(row).toHaveAttribute('data-active', 'true')
    await userEvent.click(within(row).getByRole('button'))
    expect(row).toHaveAttribute('data-active', 'false')
  })

  it('dialogue suggestion can be used', async () => {
    await unlockAll()
    await userEvent.click(screen.getByTestId('nav-dialogue'))
    await userEvent.click(screen.getByTestId('dialogue-1'))
    await userEvent.click(screen.getByRole('button', { name: 'Use This' }))
    expect(screen.getByText('Used ✓')).toBeInTheDocument()
  })
})

describe('generation → teaser → export', { timeout: 15000 }, () => {
  it('generation progresses to the teaser player', async () => {
    renderApp('/generation', { loggedIn: true, generationStepMs: 50 })
    expect(screen.getByTestId('screen-generation')).toBeInTheDocument()
    expect(await screen.findByTestId('screen-teaser', {}, { timeout: 8000 })).toBeInTheDocument()
  })

  it('teaser plays and opens export', async () => {
    renderApp('/teaser', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Versions' }))
    expect(screen.getByText('Version 3 — Current')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Make the ending scarier' }))
    expect(screen.getByLabelText('Describe a change')).toHaveValue('Make the ending scarier')
    await userEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(screen.getByTestId('screen-export')).toBeInTheDocument()
  })

  it('export renders the chosen format and completes', async () => {
    renderApp('/export', { loggedIn: true })
    fireEvent.click(screen.getByRole('button', { name: /9:16/ }))
    fireEvent.click(screen.getByRole('button', { name: /4K/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Export 9:16 · 4k' }))
    expect(screen.getByText('Exporting…')).toBeInTheDocument()
    expect(await screen.findByText('Your Teaser Is Ready.', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download MP4/ })).toBeInTheDocument()
  })
})
