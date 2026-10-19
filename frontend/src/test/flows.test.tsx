import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

// These flows cover the full product, including the Coming-soon features (Audio, Music,
// Generate Teaser). The locked default is covered in lockedFeatures.test.tsx.
beforeEach(() => { vi.stubEnv('VITE_UNLOCK_PREVIEW', 'true') })
afterEach(() => { vi.unstubAllEnvs() })

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
  it('login offers only Google and Apple — no email or password form', () => {
    renderApp('/login')
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /sign up|create account|sign in/i })).toBeNull()
  })

  it.each(['Google', 'Apple'])('continue with %s signs in and lands on onboarding', async name => {
    renderApp('/login')
    await userEvent.click(screen.getByRole('button', { name: `Continue with ${name}` }))
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
    expect(await screen.findByTestId('screen-onboarding', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(localStorage.getItem('cineai.token')).toBe('demo-token')
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
  it('with VITE_UNLOCK_PREVIEW every stage is open from the start', async () => {
    renderApp('/director/screenplay', { loggedIn: true })
    expect(screen.getByTestId('panel-screenplay')).toBeInTheDocument()
    for (const p of ['story', 'characters', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio', 'music']) {
      await userEvent.click(screen.getByTestId(`nav-${p}`))
      expect(screen.getByTestId(`panel-${p}`)).toBeInTheDocument()
    }
    expect(document.querySelector('[aria-disabled="true"]')).toBeNull()
  })

  it('chat generates a story, unlocks the Story panel and keeps chat history', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
    expect(screen.getByText('A ghost in a lighthouse')).toBeInTheDocument()
    // AI moves to the Story panel automatically
    expect(await screen.findByTestId('panel-story', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByTestId('panel-title')).toHaveTextContent('Story')

    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(screen.getByText('Accepted')).toBeInTheDocument()

    // Back to chat: history is preserved (was lost in the prototype)
    await userEvent.click(screen.getByTestId('nav-chat'))
    expect(screen.getByText('A ghost in a lighthouse')).toBeInTheDocument()
    expect(screen.getByTestId('card-story')).toBeInTheDocument()
  })

  it('full director walk-through completes every stage', async () => {
    renderApp('/director', { loggedIn: true })
    const panels = ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio']
    for (const p of panels) {
      if (!screen.queryByTestId('panel-chat')) await userEvent.click(screen.getByTestId('nav-chat'))
      await userEvent.type(screen.getByLabelText('Message the AI Director'), `next ${p}{Enter}`)
      expect(await screen.findByTestId(`panel-${p}`, {}, { timeout: 2000 })).toBeInTheDocument()
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

  it('dialogue suggestion actions explain they need the backend in demo mode', async () => {
    await unlockAll()
    await userEvent.click(screen.getByTestId('nav-dialogue'))
    await userEvent.click(screen.getByTestId('dialogue-1'))
    await userEvent.click(screen.getByRole('button', { name: 'Use This' }))
    expect(screen.getByRole('alert')).toHaveTextContent('needs the studio backend')
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

describe('workspace pages (demo mode)', { timeout: 15000 }, () => {
  it('sidebar links open Projects, Assets and Settings', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.click(screen.getByTestId('nav-projects'))
    expect(screen.getByTestId('screen-projects')).toBeInTheDocument()
    expect(screen.getByTestId('nav-projects')).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByTestId('nav-assets'))
    expect(screen.getByTestId('screen-assets')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('nav-settings'))
    expect(screen.getByTestId('screen-settings')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('nav-storyboard'))
    expect(screen.getByTestId('panel-storyboard')).toBeInTheDocument()
  })

  it('projects page lists, searches, renames and opens the sample film', async () => {
    renderApp('/projects', { loggedIn: true })
    expect(await screen.findAllByTestId('project-card')).toHaveLength(1)
    await userEvent.type(screen.getByLabelText('Search projects'), 'nothing matches')
    expect(screen.queryAllByTestId('project-card')).toHaveLength(0)
    await userEvent.clear(screen.getByLabelText('Search projects'))
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Project title')
    await userEvent.clear(input)
    await userEvent.type(input, 'Silent Symphony{Enter}')
    expect(await screen.findByRole('heading', { name: 'Silent Symphony' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByTestId('project-overview')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Story in the Director' }))
    expect(await screen.findByTestId('panel-story')).toBeInTheDocument()
  })

  it('opening a project shows the whole film on one page', async () => {
    renderApp('/projects/demo', { loggedIn: true })
    expect(await screen.findByTestId('overview-title')).toHaveTextContent('Echoes of the Forgotten')
    expect(screen.getByTestId('overview-stats')).toHaveTextContent('3 characters · 4 scenes · 4 shots')
    for (const s of ['story', 'characters', 'screenplay', 'scenes', 'storyboard']) {
      expect(screen.getByTestId(`overview-${s}`)).toBeInTheDocument()
    }
    expect(screen.getAllByTestId('overview-character')).toHaveLength(3)
    expect(screen.getAllByTestId('overview-scene')).toHaveLength(4)
    expect(screen.getAllByTestId('overview-shot')).toHaveLength(4)
    expect(screen.getByTestId('overview-screenplay-text')).toHaveTextContent('FADE IN:')
    expect(screen.getByText('Elena Vasquez')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Edit Storyboard in the Director' }))
    expect(await screen.findByTestId('panel-storyboard')).toBeInTheDocument()
  })

  it('Open in Director continues the film in the chat', async () => {
    renderApp('/projects/demo', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Open in Director' }))
    expect(screen.getByTestId('panel-chat')).toHaveTextContent('is open — pick any stage')
  })

  it('assets page filters by type', async () => {
    renderApp('/assets', { loggedIn: true })
    expect(await screen.findAllByTestId('asset-card')).toHaveLength(7)
    await userEvent.click(screen.getByRole('tab', { name: 'Portraits' }))
    await waitFor(() => expect(screen.getAllByTestId('asset-card')).toHaveLength(3))
    await userEvent.click(screen.getByRole('tab', { name: 'Video' }))
    expect(await screen.findByText('Nothing here yet')).toBeInTheDocument()
  })

  it('settings saves creative defaults and signs out', async () => {
    renderApp('/settings', { loggedIn: true })
    expect(await screen.findByTestId('account-email')).toHaveTextContent('director@cinema.ai')
    await userEvent.selectOptions(screen.getByLabelText('Story & voice language'), 'ta')
    fireEvent.change(screen.getByLabelText('Teaser length'), { target: { value: '45' } })
    await userEvent.click(screen.getByRole('button', { name: /9:16/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('Saved. New films use these defaults.')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('cineai.demoPreferences')!)).toMatchObject({ language: 'ta', teaserSeconds: 45, aspectRatio: '9:16' })
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByTestId('screen-login')).toBeInTheDocument()
  })
})

describe('lyrics come from the film', () => {
  it('shows the film\'s own song (title, style and sections)', async () => {
    renderApp('/director/lyrics', { loggedIn: true })
    expect(screen.getByTestId('song-title')).toHaveTextContent('Between the Rests')
    expect(screen.getByText(/^Main theme ·/)).toHaveTextContent('Dark Classical')
    expect((screen.getByLabelText('Verse lyrics') as HTMLTextAreaElement).value).toContain('Between the rests, I still remain')
  })

  it('the project page includes the song', async () => {
    renderApp('/projects/demo', { loggedIn: true })
    expect(await screen.findByTestId('overview-lyrics')).toHaveTextContent('Song — Between the Rests')
  })
})

describe('bulk delete', () => {
  it('is not offered in demo mode (the sample film can\'t be deleted)', async () => {
    renderApp('/projects', { loggedIn: true })
    await screen.findAllByTestId('project-card')
    expect(screen.queryByTestId('select-mode')).toBeNull()
  })
})

describe('characters', () => {
  it('Add Character opens a form; demo mode explains it needs the backend', async () => {
    renderApp('/director/characters', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: /Add Character/ }))
    const form = screen.getByTestId('character-form')
    expect(within(form).getByRole('button', { name: 'Add character' })).toBeDisabled() // needs a name
    await userEvent.type(within(form).getByPlaceholderText('e.g. Sundar'), 'Sundar')
    await userEvent.click(within(form).getByRole('button', { name: 'Add character' }))
    expect(screen.getByRole('alert')).toHaveTextContent('needs the studio backend')
  })

  it('Edit and Change Appearance open the right fields', async () => {
    renderApp('/director/characters', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit Elena Vasquez')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Elena Vasquez' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: 'Change Appearance' }))
    const form = screen.getByTestId('character-form')
    expect(within(form).getAllByRole('textbox')).toHaveLength(1)
    expect(within(form).getByText('Appearance')).toBeInTheDocument()
  })
})

describe('screenplay, dialogue and storyboard controls', () => {
  it('screenplay actions run (demo explains it needs the backend) and the page count is real', async () => {
    renderApp('/director/screenplay', { loggedIn: true })
    expect(screen.getByText(/^\d+ pages?$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Make Cinematic' }))
    expect(screen.getByRole('alert')).toHaveTextContent('needs the studio backend')
    await userEvent.click(screen.getByRole('button', { name: /Continue Screenplay/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('needs the studio backend')
  })

  it('dialogue: Edit opens the line, Direct the AI says what it applies to', async () => {
    renderApp('/director/dialogue', { loggedIn: true })
    expect(screen.getByText(/applies to every line/)).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('dialogue-2'))
    expect(screen.getByText(/applies to line 2/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Line')).toHaveValue("I hear it differently every time I play it. Like it's trying to tell me something I'm not ready to hear.")
    await userEvent.click(screen.getByRole('button', { name: 'Make it scarier' }))
    expect(screen.getByLabelText('Direct the AI')).toHaveValue('Make it scarier')
  })

  it('storyboard: each visual style changes how the frames look', async () => {
    renderApp('/director/storyboard', { loggedIn: true })
    const img = () => screen.getAllByTestId('shot-image')[0] as HTMLImageElement
    const before = img().style.filter
    await userEvent.click(screen.getByRole('button', { name: 'Anime' }))
    expect(screen.getByRole('button', { name: 'Anime' })).toHaveAttribute('aria-pressed', 'true')
    expect(img().style.filter).not.toBe(before)
    expect(img().style.filter).toContain('saturate(1.9)')
    await userEvent.click(screen.getByRole('button', { name: 'Vintage' }))
    expect(img().style.filter).toContain('sepia')
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByLabelText('Describe your style')).toBeInTheDocument()
  })

  it('storyboard: shot Edit and Change Camera open their forms', async () => {
    renderApp('/director/storyboard', { loggedIn: true })
    await userEvent.click(screen.getByTestId('shot-1'))
    await userEvent.click(within(screen.getByTestId('shot-1')).getByRole('button', { name: 'Change Camera' }))
    expect(screen.getByLabelText('Camera')).toBeInTheDocument()
    expect(screen.getByLabelText('Movement')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(within(screen.getByTestId('shot-1')).getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Shot description')).toBeInTheDocument()
  })
})
