import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const runToStoryboard = async () => {
  await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
  await screen.findByTestId('panel-story', {}, { timeout: 2000 })
  for (const stage of ['characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard']) {
    await userEvent.click(screen.getByTestId('nav-chat'))
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'continue{Enter}')
    await screen.findByTestId(`panel-${stage}`, {}, { timeout: 2000 })
  }
}

describe('Coming soon: Audio, Music, Generate Teaser', { timeout: 20000 }, () => {
  it('Audio and Music are locked in the sidebar; other stages stay open', async () => {
    renderApp('/director', { loggedIn: true })
    for (const p of ['audio', 'music']) {
      const item = screen.getByTestId(`nav-${p}`)
      expect(item).toHaveAttribute('aria-disabled', 'true')
      expect(within(item).getByTestId('lock-icon')).toBeInTheDocument()
      expect(item).toHaveTextContent('Soon')
      await userEvent.click(item)
      expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
    }
    for (const p of ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard']) {
      expect(screen.getByTestId(`nav-${p}`)).not.toHaveAttribute('aria-disabled')
    }
  })

  it('Generate Teaser is locked in the top bar', async () => {
    renderApp('/director', { loggedIn: true })
    const btn = screen.getByTestId('topbar-generate')
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(btn)
    expect(screen.getByTestId('screen-director')).toBeInTheDocument()
  })

  it('deep links to locked screens go back to the Director', () => {
    for (const path of ['/director/audio', '/director/music', '/generation', '/teaser', '/export']) {
      const { unmount } = renderApp(path, { loggedIn: true })
      expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
      unmount()
    }
  })

  it('after the storyboard the Director stays in chat and the generate actions say Coming soon', async () => {
    renderApp('/director', { loggedIn: true })
    await runToStoryboard()
    expect(within(screen.getByTestId('panel-storyboard')).getByRole('button', { name: /Generate Visuals & Video/ })).toHaveAttribute('aria-disabled', 'true')

    await userEvent.click(screen.getByTestId('nav-chat'))
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'continue{Enter}')
    const card = await screen.findByTestId('card-generate', {}, { timeout: 2000 })
    expect(within(card).getByRole('button', { name: /Generate/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/Teaser generation is coming soon/)).toBeInTheDocument()
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument() // did not jump to the locked Audio panel
    expect(screen.getByTestId('sidebar-generate')).toHaveAttribute('aria-disabled', 'true')

    await userEvent.click(screen.getByTestId('nav-scenes'))
    expect(within(screen.getByTestId('panel-scenes')).getByRole('button', { name: /Generate Teaser/ })).toHaveAttribute('aria-disabled', 'true')
  })
})
