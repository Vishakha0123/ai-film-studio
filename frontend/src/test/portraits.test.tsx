import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { characterPhoto, characterPhotoKind, type Character } from '../types'

const base = { id: '1', name: 'Paati', age: '78', gender: 'female', role: '', personality: '', appearance: '', arc: '', relationships: '', imageId: '' } as Character

describe('cast portraits are real or absent — never drawn', () => {
  it('a generated portrait is used; a stock sample is labelled; otherwise there is no picture at all', () => {
    expect(characterPhotoKind({ ...base, imageUrl: 'https://x/projects/p/character_image/1-v1.png' })).toBe('ai')
    expect(characterPhoto({ ...base, imageUrl: 'https://x/p.png' }, 100, 100)).toBe('https://x/p.png')
    expect(characterPhotoKind({ ...base, imageId: 'abc' })).toBe('stock')
    expect(characterPhotoKind(base)).toBe('none')
    expect(characterPhoto(base, 100, 100)).toBeNull()
  })

  it('the matched reference portrait shows until a generated one exists; a generated portrait wins', () => {
    const ref = { ...base, imageId: 'abc', referenceImageUrl: 'http://localhost:8000/portraits/female-senior.webp' }
    expect(characterPhotoKind(ref)).toBe('reference')
    expect(characterPhoto(ref, 100, 100)).toBe('http://localhost:8000/portraits/female-senior.webp')
    expect(characterPhotoKind({ ...ref, imageUrl: 'https://x/p.png' })).toBe('ai')
  })

  it("the offline mock's SVG placeholder frames don't count as portraits", () => {
    expect(characterPhotoKind({ ...base, imageUrl: 'http://localhost:8000/media/projects/p/character_image/1-v1.svg' })).toBe('none')
  })

  it('without an image model there is no Generate portrait button (it could only fail)', () => {
    renderApp('/director/characters', { loggedIn: true })
    expect(screen.getByTestId('stock-badge')).toHaveTextContent('Stock sample photo')
    expect(screen.getByTestId('photo-caption')).toHaveTextContent('Sample stock photo')
    expect(screen.queryByRole('button', { name: 'Generate portrait' })).toBeNull()
  })

  it('the character form has no drawn preview any more', async () => {
    renderApp('/director/characters', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: /Add Character/ }))
    const form = screen.getByTestId('character-form')
    expect(within(form).queryByRole('img')).toBeNull()
    expect(form).toHaveTextContent('Age, Girl / Boy and Appearance shape the AI portrait.')
    expect(within(form).getByLabelText('Girl / Boy')).toBeInTheDocument()
  })
})
