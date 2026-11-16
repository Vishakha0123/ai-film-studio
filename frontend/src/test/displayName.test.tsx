import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

describe('display name and home page wording', () => {
  it('Settings shows how the name appears: “Vishakha’s AI Director”', async () => {
    renderApp('/settings', { loggedIn: true })
    const hint = await screen.findByTestId('display-name-hint')
    expect(hint).toHaveTextContent('Your name’s AI Director')
    await userEvent.type(screen.getByLabelText('Display name'), 'Vishakha')
    expect(hint).toHaveTextContent('Vishakha’s AI Director')
  })

  it('the home page says “Made for India’s stories”', () => {
    renderApp('/')
    expect(screen.getByTestId('landing-languages')).toHaveTextContent('Made for India’s stories')
    expect(screen.queryByText(/many (voices|stories)/)).toBeNull()
  })
})
