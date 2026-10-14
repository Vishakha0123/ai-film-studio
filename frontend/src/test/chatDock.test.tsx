import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const wide = (matches: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {} }))

describe('AI Director chat next to every section', { timeout: 20000 }, () => {
  beforeEach(() => wide(true))
  afterEach(() => vi.unstubAllGlobals())

  it('every section shows the chat panel beside it', async () => {
    renderApp('/director', { loggedIn: true })
    expect(screen.queryByTestId('chat-dock')).toBeNull() // the Director page is the chat itself
    for (const p of ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard']) {
      await userEvent.click(screen.getByTestId(`nav-${p}`))
      expect(screen.getByTestId(`panel-${p}`)).toBeInTheDocument()
      expect(within(screen.getByTestId('chat-dock')).getByLabelText('Message the AI Director')).toBeInTheDocument()
    }
  })

  it('keeps the conversation and lets you chat from a section', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
    await screen.findByTestId('panel-story', {}, { timeout: 2000 })
    const dock = screen.getByTestId('chat-dock')
    expect(within(dock).getByText('A ghost in a lighthouse')).toBeInTheDocument()

    // Ask from the Story section → the Director moves on to Characters, the chat stays beside it
    await userEvent.type(within(dock).getByLabelText('Message the AI Director'), 'continue{Enter}')
    expect(await screen.findByTestId('panel-characters', {}, { timeout: 2000 })).toBeInTheDocument()
    expect(within(screen.getByTestId('chat-dock')).getByText('continue')).toBeInTheDocument()
  })

  it('a reply still on its way survives switching sections', async () => {
    renderApp('/director/scenes', { loggedIn: true, replyDelay: 300 })
    await userEvent.type(within(screen.getByTestId('chat-dock')).getByLabelText('Message the AI Director'), 'Make it darker{Enter}')
    await userEvent.click(screen.getByTestId('nav-characters'))
    expect(await within(screen.getByTestId('chat-dock')).findByText(/Beautiful premise/, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('can be closed, reopened and expanded to the full chat — and remembers being closed', async () => {
    const { unmount } = renderApp('/director/story', { loggedIn: true })
    expect(screen.getByTestId('chat-toggle')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Close chat' }))
    expect(screen.getByTestId('chat-dock').className).toContain('lg:hidden')
    expect(screen.getByTestId('chat-toggle')).toHaveAttribute('aria-pressed', 'false')
    unmount()

    renderApp('/director/story', { loggedIn: true })
    expect(screen.getByTestId('chat-dock').className).toContain('lg:hidden')
    await userEvent.click(screen.getByRole('button', { name: 'Show chat' }))
    expect(screen.getByTestId('chat-dock').className).toContain('lg:flex')
    await userEvent.click(screen.getByRole('button', { name: 'Open full chat' }))
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
  })

  it('on a phone the chat opens as a full-screen sheet from the Chat button', async () => {
    wide(false)
    renderApp('/director/story', { loggedIn: true })
    expect(screen.getByTestId('chat-dock').className).toMatch(/(^|\s)hidden(\s|$)/)
    await userEvent.click(screen.getByTestId('chat-toggle'))
    expect(screen.getByTestId('chat-dock').className).toContain('fixed inset-0')
    await userEvent.click(screen.getByRole('button', { name: 'Close chat' }))
    expect(screen.getByTestId('chat-dock').className).toMatch(/(^|\s)hidden(\s|$)/)
  })
})
