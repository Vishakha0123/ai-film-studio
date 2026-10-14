import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

describe('film language', { timeout: 15000 }, () => {
  it('the chat lets you choose the film language before writing the idea', async () => {
    renderApp('/director', { loggedIn: true })
    const picker = screen.getByLabelText('Film language') as HTMLSelectElement
    expect(picker.value).toBe('en')
    expect(screen.getByText('Write film in')).toBeInTheDocument()
    await userEvent.selectOptions(picker, 'ta')
    expect(picker.value).toBe('ta')
    expect(screen.getByRole('option', { name: 'Tamil · தமிழ்' })).toBeInTheDocument()
  })

  it('switching language on a finished film asks for the backend in demo mode — no retyping prompt', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.type(screen.getByLabelText('Message the AI Director'), 'A ghost in a lighthouse{Enter}')
    await screen.findByTestId('panel-story', {}, { timeout: 2000 })
    await userEvent.click(screen.getByTestId('nav-chat'))
    expect(screen.getByText('Film in')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Film language'), 'hi')
    expect(screen.getByText('Make this film in Hindi')).toBeInTheDocument()
    expect(screen.getByText(/needs the studio backend/)).toBeInTheDocument()
    expect((screen.getByLabelText('Film language') as HTMLSelectElement).value).toBe('en')
  })

  it('the project page shows the language and offers other languages', async () => {
    renderApp('/projects/demo', { loggedIn: true })
    expect(await screen.findByTestId('overview-language')).toHaveTextContent('English')
    const select = screen.getByLabelText('Make this film in another language')
    expect(screen.queryByRole('option', { name: 'English' })).toBeNull()
    await userEvent.selectOptions(select, 'ta')
    expect(await screen.findByRole('alert')).toHaveTextContent('needs the studio backend')
  })
})
