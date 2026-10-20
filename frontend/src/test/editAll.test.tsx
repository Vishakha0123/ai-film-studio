import { describe, it, expect } from 'vitest'
import { screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { setToken } from '../api/client'

describe('stay signed in', () => {
  it('a returning signed-in user skips the landing page and goes straight to the studio', () => {
    renderApp('/', { loggedIn: true })
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('screen-login')).toBeNull()
  })

  it('the login page also sends a signed-in user to the studio', () => {
    renderApp('/login', { loggedIn: true })
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
  })

  it('signed-out visitors still see the login page', () => {
    renderApp('/login')
    expect(screen.getByTestId('screen-login')).toBeInTheDocument()
  })

  it('when the session ends (expired or signed out elsewhere) the studio goes back to login', () => {
    renderApp('/director', { loggedIn: true })
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
    act(() => setToken(null))
    expect(screen.getByTestId('screen-login')).toBeInTheDocument()
  })
})

describe('every section can be edited', () => {
  it.each([
    ['story', 'direct-ai-story'],
    ['characters', 'direct-ai-characters'],
    ['screenplay', 'direct-ai-screenplay'],
    ['lyrics', 'direct-ai-lyrics'],
    ['scenes', 'direct-ai-scenes'],
    ['storyboard', 'direct-ai-shots'],
  ])('%s has a "Direct the AI" box', (panel, testId) => {
    renderApp(`/director/${panel}`, { loggedIn: true })
    const box = screen.getByTestId(testId)
    expect(within(box).getByLabelText('Direct the AI')).toBeInTheDocument()
    expect(within(box).getByRole('button', { name: 'Apply' })).toBeDisabled()
  })

  it('Direct the AI explains it needs the backend in demo mode', async () => {
    renderApp('/director/story', { loggedIn: true })
    const box = screen.getByTestId('direct-ai-story')
    await userEvent.click(within(box).getByRole('button', { name: 'Add a twist' }))
    expect(within(box).getByLabelText('Direct the AI')).toHaveValue('Add a twist')
    await userEvent.click(within(box).getByRole('button', { name: 'Apply' }))
    expect(within(box).getByRole('alert')).toHaveTextContent('needs the studio backend')
  })

  it('story: Edit opens the logline, tone and story for typing', async () => {
    renderApp('/director/story', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const form = screen.getByTestId('story-edit')
    expect((within(form).getByLabelText('Story text') as HTMLTextAreaElement).value.length).toBeGreaterThan(20)
    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('story-edit')).toBeNull()
  })

  it('screenplay: Edit shows the whole script in a text box', async () => {
    renderApp('/director/screenplay', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect((screen.getByLabelText('Screenplay text') as HTMLTextAreaElement).value).toContain('INT.')
  })

  it('scenes: each scene has its own Edit', async () => {
    renderApp('/director/scenes', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Edit scene 2' }))
    const form = screen.getByTestId('scene-edit')
    expect(within(form).getByLabelText('Location')).not.toHaveValue('')
    expect(within(form).getByRole('button', { name: 'Save scene' })).toBeInTheDocument()
  })

  it('lyrics: typed changes show Save lyrics, and Undo puts the song back', async () => {
    renderApp('/director/lyrics', { loggedIn: true })
    const box = screen.getByLabelText('Verse lyrics') as HTMLTextAreaElement
    const before = box.value
    await userEvent.type(box, ' la la')
    expect(screen.getByTestId('lyrics-unsaved')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(box.value).toBe(before)
    expect(screen.queryByTestId('lyrics-unsaved')).toBeNull()
  })
})
