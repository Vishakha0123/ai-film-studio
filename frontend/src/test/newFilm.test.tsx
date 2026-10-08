import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const startStory = async () => {
  await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
  await screen.findByTestId('panel-story', {}, { timeout: 2000 })
}

describe('New Film', { timeout: 15000 }, () => {
  it('sidebar New Film opens the genre picker and starts a clean chat', async () => {
    renderApp('/director', { loggedIn: true })
    await startStory()
    expect(screen.getByTestId('nav-story').querySelector('svg')).not.toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'New Film' }))
    expect(screen.getByTestId('screen-new-film')).toBeInTheDocument()
    expect(screen.getByTestId('new-film-note')).toHaveTextContent('Starting over clears “Echoes of the Forgotten”')
    expect(screen.getByRole('button', { name: 'Start without a genre' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Horror/ }))
    await userEvent.click(screen.getByRole('button', { name: /Thriller/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Start Horror & Thriller film' }))

    const chat = screen.getByTestId('panel-chat')
    expect(chat).toHaveTextContent("Let's make a new Horror & Thriller film")
    expect(chat).not.toHaveTextContent('A ghost in a lighthouse')
    expect(screen.queryByTestId('card-story')).toBeNull()
  })

  it('clears the unsent draft and attachments', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'half-written idea')
    await userEvent.upload(screen.getByTestId('file-input') as HTMLInputElement, new File(['x'], 'old.txt', { type: 'text/plain' }))
    await userEvent.click(screen.getByRole('button', { name: 'New Film' }))
    expect(screen.queryByTestId('new-film-note')).toBeNull() // nothing started yet
    await userEvent.click(screen.getByRole('button', { name: 'Start without a genre' }))
    expect(screen.getByLabelText('Message the AI Director')).toHaveValue('')
    expect(screen.queryByTestId('attachment-chips')).toBeNull()
  })

  it('cancel keeps the current film', async () => {
    renderApp('/director', { loggedIn: true })
    await startStory()
    await userEvent.click(screen.getByRole('button', { name: 'New Film' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTestId('screen-director')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('nav-chat'))
    expect(screen.getByText('A ghost in a lighthouse')).toBeInTheDocument()
  })

  it('a reply still in flight is dropped when a new film starts', async () => {
    renderApp('/director', { loggedIn: true, replyDelay: 300 })
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'New Film' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start without a genre' }))
    await new Promise(r => setTimeout(r, 500))
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('card-story')).toBeNull()
  })

  it('Projects page New Film goes to the genre picker', async () => {
    renderApp('/projects', { loggedIn: true })
    await userEvent.click(screen.getAllByRole('button', { name: 'New Film' })[0])
    expect(screen.getByTestId('screen-new-film')).toBeInTheDocument()
  })
})
