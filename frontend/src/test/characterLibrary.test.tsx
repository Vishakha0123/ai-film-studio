import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import data from '../data/characterLibrary.json'
import {
  AGE_GROUPS, EMPTY_FILTER, SKIN_TONES, ageGroupOf, filterCharacters, isLibraryCharacter,
  type LibraryCharacter, type LibraryFilter,
} from '../lib/characterLibrary'
import { listCharacters, toEntry } from '../services/characterLibrary'
import CharacterLibrary from '../components/characterLibrary/CharacterLibrary'
import CharacterCard from '../components/characterLibrary/CharacterCard'
import { renderApp } from './renderApp'

const CHARS = data.characters as LibraryCharacter[]

const fake = (id: string, age: number, gender: 'female' | 'male', file: string): LibraryCharacter => ({
  id, age, gender, ethnicity: 'south-asian', heritage: 'Tamil', skinTone: 'brown', hair: { style: 'short', color: 'black' },
  eyeColor: 'brown', features: [], wardrobe: 'a shirt', appearance: 'test', image: { file, width: 768, height: 1024 }, prompt: `${age}`,
})

describe('age groups', () => {
  it.each([
    [3, 'child'], [12, 'child'], [13, 'teen'], [17, 'teen'], [18, 'youngAdult'], [29, 'youngAdult'],
    [30, 'adult'], [59, 'adult'], [60, 'senior'], [92, 'senior'], [101, 'senior'],
  ])('age %i → %s', (age, group) => expect(ageGroupOf(age)).toBe(group))

  it('groups are Children 3–12, Teenagers 13–17, Young adults 18–29, Adults 30–59, Seniors 60+', () => {
    expect(AGE_GROUPS.map(g => [g.label, g.min, g.max])).toEqual([
      ['Children', 3, 12], ['Teenagers', 13, 17], ['Young adults', 18, 29], ['Adults', 30, 59], ['Seniors', 60, null],
    ])
  })
})

describe('filtering uses the metadata, not the file name', () => {
  // File names that say the opposite of the real age/gender
  const tricky = [
    fake('CHR-9001', 8, 'female', 'senior-man-90.webp'),
    fake('CHR-9002', 90, 'male', 'little-girl-8.webp'),
    fake('CHR-9003', 15, 'male', 'adult-woman.webp'),
  ]
  const f = (patch: Partial<LibraryFilter>) => filterCharacters(tricky, { ...EMPTY_FILTER, ...patch }).map(c => c.id)

  it('age group and gender follow the recorded age and gender', () => {
    expect(f({ ageGroups: ['child'], gender: 'female' })).toEqual(['CHR-9001'])
    expect(f({ ageGroups: ['senior'] })).toEqual(['CHR-9002'])
    expect(f({ ageGroups: ['teen'], gender: 'male' })).toEqual(['CHR-9003'])
    expect(f({ ageGroups: ['adult'] })).toEqual([])
  })

  it('exact age range and several groups combine; results come youngest first', () => {
    expect(f({ minAge: 10, maxAge: 95 })).toEqual(['CHR-9003', 'CHR-9002'])
    expect(f({ ageGroups: ['child', 'senior'] })).toEqual(['CHR-9001', 'CHR-9002'])
  })
})

describe('library data', () => {
  it('every record is valid, with its own id and its own image file', () => {
    expect(CHARS.every(isLibraryCharacter)).toBe(true)
    expect(new Set(CHARS.map(c => c.id)).size).toBe(CHARS.length)
    expect(new Set(CHARS.map(c => c.image.file)).size).toBe(CHARS.length)
  })

  it('covers every age group for girls/women and boys/men, from 3 to 90+', () => {
    for (const g of AGE_GROUPS) for (const gender of ['female', 'male'] as const) {
      expect(CHARS.filter(c => ageGroupOf(c.age) === g.id && c.gender === gender).length).toBeGreaterThanOrEqual(3)
    }
    expect(Math.min(...CHARS.map(c => c.age))).toBe(3)
    expect(Math.max(...CHARS.map(c => c.age))).toBeGreaterThanOrEqual(90)
  })

  it('is diverse: many backgrounds, every skin tone, several hairstyles', () => {
    expect(new Set(CHARS.map(c => c.ethnicity)).size).toBeGreaterThanOrEqual(7)
    expect(new Set(CHARS.map(c => c.skinTone))).toEqual(new Set(SKIN_TONES.map(t => t.id)))
    expect(new Set(CHARS.map(c => c.hair.style)).size).toBeGreaterThanOrEqual(5)
  })

  it('prompts describe a unique, photorealistic person of that exact age, with their recorded details', () => {
    for (const c of CHARS) {
      expect(c.prompt.startsWith(`Photorealistic close-up portrait photograph of a ${c.age}-year-old`)).toBe(true)
      for (const detail of [c.heritage, c.eyeColor, c.wardrobe, ...c.features]) expect(c.prompt).toContain(detail)
      expect(c.prompt).toContain('A unique, fictional person with their own distinct face')
      expect(c.prompt).toContain('real skin texture')
      expect(c.prompt).not.toMatch(/cartoon|illustrat|anime|avatar/i) // style words only in the negative prompt
    }
    expect(new Set(CHARS.map(c => c.prompt)).size).toBe(CHARS.length) // no two characters get the same prompt
  })

  it('has a negative prompt that rules out cartoons, illustrations, anime, 3D, paintings and avatars', () => {
    for (const word of ['cartoon', 'illustration', 'anime', '3D render', 'painting', 'avatar']) expect(data.negativePrompt).toContain(word)
  })

  it('Paati (CHR-0045) is a 78-year-old Indian grandmother with silver hair in a bun and a white checked-border cotton saree', () => {
    const p = CHARS.find(c => c.id === 'CHR-0045')!
    expect(p).toMatchObject({ name: 'Paati', age: 78, gender: 'female', ethnicity: 'south-asian', image: { file: 'CHR-0045.webp' } })
    for (const d of ['silver hair pulled back into a neat bun', 'white cotton saree with a checked border', 'natural wrinkles', 'expressive eyes'])
      expect(p.prompt).toContain(d)
    expect(ageGroupOf(p.age)).toBe('senior')
  })

  it('portraits are 1024×1536 WebP, one file per character id', () => {
    expect(data.imageSpec).toMatchObject({ format: 'webp', width: 1024, height: 1536 })
    for (const c of CHARS) expect(c.image).toEqual({ file: `${c.id}.webp`, width: 1024, height: 1536 })
  })
})

describe('portrait files', () => {
  it('a character is "ready" only when its own file exists; otherwise it says which file is missing', () => {
    const c = CHARS[0]
    expect(toEntry(c, {}).portrait).toEqual({ status: 'missing', expectedPath: `frontend/src/assets/characters/${c.image.file}` })
    expect(toEntry(c, { [c.image.file]: '/assets/x.webp' }, {}).portrait).toEqual({ status: 'ready', src: '/assets/x.webp', generated: null })
    expect(toEntry(c, { [c.image.file]: '/assets/x.webp' }, { [c.id]: { file: c.image.file, model: 'gpt-image-1', generatedAt: '2026-10-21T10:00:00Z' } }).portrait)
      .toEqual({ status: 'ready', src: '/assets/x.webp', generated: { model: 'gpt-image-1', generatedAt: '2026-10-21T10:00:00Z' } })
    expect(toEntry(c, { 'CHR-9999.webp': '/assets/other.webp' }).portrait.status).toBe('missing') // never borrows another file
  })

  it('a ready card shows a loading shimmer until its own image loads, and says so if it fails', () => {
    const entry = toEntry(CHARS[0], { [CHARS[0].image.file]: '/portraits/CHR-0001.webp' })
    const { rerender } = render(<CharacterCard character={entry} selected={false} onSelect={() => undefined} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/portraits/CHR-0001.webp')
    expect(screen.getByTestId('portrait-loading')).toBeInTheDocument()
    fireEvent.load(img)
    expect(screen.queryByTestId('portrait-loading')).toBeNull()
    rerender(<CharacterCard key="2" character={entry} selected={false} onSelect={() => undefined} />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByTestId('portrait-missing')).toHaveTextContent('Portrait file couldn’t load')
  })

  it('the service lists characters filtered the same way', async () => {
    const kids = await listCharacters({ ...EMPTY_FILTER, ageGroups: ['child'], gender: 'male' })
    expect(kids.length).toBe(CHARS.filter(c => c.age <= 12 && c.gender === 'male').length)
    expect(kids.every(c => c.ageGroup === 'child' && c.gender === 'male')).toBe(true)
  })
})

describe('character library gallery', () => {
  beforeEach(() => localStorage.clear())

  const cards = () => screen.getAllByTestId('library-card')

  it('shows a loading state, then every character', async () => {
    render(<CharacterLibrary />)
    expect(screen.getAllByTestId('library-skeleton').length).toBeGreaterThan(0)
    await waitFor(() => expect(cards()).toHaveLength(CHARS.length))
    expect(screen.getByTestId('library-count')).toHaveTextContent(`${CHARS.length} characters`)
  })

  it('choosing an age group and gender filters the gallery to matching people', async () => {
    render(<CharacterLibrary />)
    await waitFor(() => expect(cards()).toHaveLength(CHARS.length))
    await userEvent.click(screen.getByRole('button', { name: /Children · 3–12/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Girls & women' }))
    await waitFor(() => expect(cards()).toHaveLength(CHARS.filter(c => c.age <= 12 && c.gender === 'female').length))
    for (const card of cards()) {
      expect(Number(card.dataset.age)).toBeLessThanOrEqual(12)
      expect(card.dataset.gender).toBe('female')
    }
    await userEvent.click(screen.getByRole('button', { name: /Children · 3–12/ }))
    await userEvent.click(screen.getByRole('button', { name: /Seniors · 60\+/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Boys & men' }))
    await waitFor(() => expect(cards().every(c => Number(c.dataset.age) >= 60 && c.dataset.gender === 'male')).toBe(true))
    expect(cards()).toHaveLength(CHARS.filter(c => c.age >= 60 && c.gender === 'male').length)
  })

  it('the exact age range and appearance filters narrow it further', async () => {
    render(<CharacterLibrary />)
    await waitFor(() => expect(cards()).toHaveLength(CHARS.length))
    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '40' } })
    fireEvent.change(screen.getByLabelText('Maximum age'), { target: { value: '50' } })
    await waitFor(() => expect(cards()).toHaveLength(CHARS.filter(c => c.age >= 40 && c.age <= 50).length))
    await userEvent.click(screen.getByRole('button', { name: /^Clear filters$/ }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Skin tone' })).getByRole('button', { name: 'Dark' }))
    await waitFor(() => expect(cards()).toHaveLength(CHARS.filter(c => c.skinTone === 'dark').length))
  })

  it('shows an empty state with a way back', async () => {
    render(<CharacterLibrary />)
    await waitFor(() => expect(cards()).toHaveLength(CHARS.length))
    fireEvent.change(screen.getByLabelText('Minimum age'), { target: { value: '99' } })
    expect(await screen.findByTestId('library-empty')).toHaveTextContent('No characters match these choices')
    await userEvent.click(within(screen.getByTestId('library-empty')).getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(cards()).toHaveLength(CHARS.length))
  })

  it('cards show the id, age and a Select Character button; selecting is clear and remembered', async () => {
    const { unmount } = render(<CharacterLibrary />)
    await waitFor(() => expect(cards()).toHaveLength(CHARS.length))
    const first = cards()[0]
    const id = within(first).getByTestId('character-id').textContent!
    expect(first).toHaveTextContent(/Age \d+/)
    await userEvent.click(within(first).getByRole('button', { name: 'Select Character' }))
    expect(within(first).getByRole('button', { name: 'Selected ✓' })).toHaveAttribute('aria-pressed', 'true')
    expect(first).toHaveAttribute('data-selected', 'true')
    expect(screen.getByTestId('selected-character')).toHaveTextContent(id)
    expect(screen.getAllByRole('button', { name: 'Selected ✓' })).toHaveLength(1)
    unmount()
    render(<CharacterLibrary />)
    expect(await screen.findByTestId('selected-character')).toHaveTextContent(id) // remembered
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.queryByTestId('selected-character')).toBeNull()
  })

  it('characters without their portrait file say so — no stand-in images', async () => {
    render(<CharacterLibrary />)
    await waitFor(() => expect(cards()).toHaveLength(CHARS.length))
    const missing = screen.getAllByTestId('portrait-missing')
    expect(missing[0]).toHaveTextContent('Portrait not added yet')
    expect(missing[0]).toHaveTextContent(/CHR-\d{4}\.webp/)
    expect(screen.getByTestId('portrait-status')).toHaveTextContent(`0 of ${CHARS.length} portraits added`)
    await userEvent.click(screen.getByLabelText('Only characters with a portrait'))
    expect(await screen.findByTestId('library-empty')).toBeInTheDocument()
  })

  it('is a tab on the Characters page next to the film cast', async () => {
    renderApp('/director/characters', { loggedIn: true })
    await userEvent.click(screen.getByRole('tab', { name: 'Character library' }))
    expect(await screen.findByTestId('character-library')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Film cast' }))
    expect(screen.queryByTestId('character-library')).toBeNull()
    expect(screen.getByRole('button', { name: /Add Character/ })).toBeInTheDocument()
  })
})
