import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { ageBand, genderOf, portraitSvg, portraitUrl } from '../lib/portraits'
import { characterPhoto, type Character } from '../types'

describe('portraits by age and gender', () => {
  it.each([
    ['7', 'child'], ['12', 'child'], ['13', 'teen'], ['19', 'teen'], ['24', 'young'], ['early 30s', 'young'],
    ['45', 'adult'], ['70s', 'senior'], ['', 'adult'], ['teenager', 'teen'], ['elderly', 'senior'], ['little kid', 'child'],
    ['੫੫', 'senior'], ['௮', 'child'],
  ])('age "%s" → %s', (age, band) => expect(ageBand(age)).toBe(band))

  it('uses the gender when set, otherwise guesses from the description', () => {
    expect(genderOf({ name: 'Ravi', gender: 'female' })).toBe('female')
    expect(genderOf({ name: 'Ravi', gender: 'Boy' })).toBe('male')
    expect(genderOf({ name: 'X', role: 'Grandmother of the bride' })).toBe('female')
    expect(genderOf({ name: 'X', relationships: 'Her father and his brother' })).toBe('male')
  })

  it('each age and gender gets a different drawing; the same character always looks the same', () => {
    const svgs = new Set<string>()
    for (const age of ['7', '15', '26', '44', '68']) for (const gender of ['female', 'male']) svgs.add(portraitSvg({ name: 'Asha', age, gender }))
    expect(svgs.size).toBe(10)
    expect(portraitSvg({ name: 'Asha', age: '8', gender: 'female' })).toBe(portraitSvg({ name: 'Asha', age: '8', gender: 'female' }))
    expect(portraitUrl({ name: 'Asha', age: '8', gender: 'female' })).toMatch(/^data:image\/svg\+xml/)
  })

  it('a generated portrait or a sample photo wins over the drawing', () => {
    const c = { id: '1', name: 'Asha', age: '8', gender: 'female', role: '', personality: '', appearance: '', arc: '', relationships: '', imageId: '' } as Character
    expect(characterPhoto(c, 100, 100)).toMatch(/^data:image\/svg/)
    expect(characterPhoto({ ...c, imageUrl: 'https://x/p.png' }, 100, 100)).toBe('https://x/p.png')
    expect(characterPhoto({ ...c, imageId: 'abc' }, 100, 100)).toContain('images.unsplash.com/photo-abc')
  })

  it('the character form previews the portrait as age and Girl / Boy change', async () => {
    renderApp('/director/characters', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: /Add Character/ }))
    const form = screen.getByTestId('character-form')
    await userEvent.type(within(form).getByPlaceholderText('e.g. 12'), '7')
    await userEvent.selectOptions(within(form).getByLabelText('Girl / Boy'), 'female')
    expect(within(form).getByTestId('portrait-band')).toHaveTextContent('Child · girl / woman')
    const before = within(form).getByTestId('portrait-preview').getAttribute('src')
    await userEvent.clear(within(form).getByPlaceholderText('e.g. 12'))
    await userEvent.type(within(form).getByPlaceholderText('e.g. 12'), '70')
    expect(within(form).getByTestId('portrait-band')).toHaveTextContent('Senior · girl / woman')
    expect(within(form).getByTestId('portrait-preview').getAttribute('src')).not.toBe(before)
  })
})

describe('AI photo portraits', () => {
  it('each character has a photo button; the demo explains it needs the backend', async () => {
    renderApp('/director/characters', { loggedIn: true })
    expect(screen.getByTestId('photo-caption')).toHaveTextContent('Drawing for now — real photos need the image model')
    await userEvent.click(screen.getByRole('button', { name: 'Make AI photo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo portraits need the studio backend')
  })
})
