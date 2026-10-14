import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const ORDER = ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard']

describe('Continue button on every section', { timeout: 20000 }, () => {
  it('after the story is generated, Continue walks through every section to the end', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
    await screen.findByTestId('panel-story', {}, { timeout: 2000 })

    for (let i = 0; i < ORDER.length - 1; i++) {
      expect(screen.getByTestId(`panel-${ORDER[i]}`)).toBeInTheDocument()
      expect(screen.getByTestId('continue-step')).toHaveTextContent(`Step ${i + 1} of 7`)
      await userEvent.click(screen.getByTestId('continue-button'))
      expect(await screen.findByTestId(`panel-${ORDER[i + 1]}`)).toBeInTheDocument()
      // the finished section is ticked in the sidebar
      expect(screen.getByTestId(`nav-${ORDER[i]}`).querySelector('svg:last-child')).not.toBeNull()
    }

    // Storyboard is the last open section: Finish returns to the Director chat
    expect(screen.getByTestId('continue-button')).toHaveTextContent('Finish — back to Director')
    await userEvent.click(screen.getByTestId('continue-button'))
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('continue-bar')).toBeNull()
    expect(screen.getByText('Continue to Characters')).toBeInTheDocument()
    expect(screen.getAllByTestId('card-generate')).toHaveLength(1)
  })

  it('names the next section and never sends you to a locked one', async () => {
    renderApp('/director/scenes', { loggedIn: true })
    expect(screen.getByTestId('continue-button')).toHaveTextContent('Continue to Storyboard')
    await userEvent.click(screen.getByTestId('continue-button'))
    expect(screen.getByTestId('panel-storyboard')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('continue-button'))
    expect(screen.queryByTestId('panel-audio')).toBeNull()
    expect(screen.getByTestId('panel-chat')).toBeInTheDocument()
  })

  it('Back goes to the previous section', async () => {
    renderApp('/director/screenplay', { loggedIn: true })
    await userEvent.click(within(screen.getByTestId('continue-bar')).getByRole('button', { name: 'Back to Characters' }))
    expect(screen.getByTestId('panel-characters')).toBeInTheDocument()
  })

  it('the chat has no Continue bar', () => {
    renderApp('/director', { loggedIn: true })
    expect(screen.queryByTestId('continue-bar')).toBeNull()
  })
})
