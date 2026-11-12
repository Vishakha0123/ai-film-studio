import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { sectionLanguage, switchInstruction } from '../components/SectionLanguage'

describe('section language picker', { timeout: 15000 }, () => {
  it.each([
    ['story', 'story'],
    ['characters', 'character details'],
    ['screenplay', 'screenplay'],
    ['lyrics', 'song'],
    ['scenes', 'scene descriptions'],
    ['storyboard', 'shot descriptions'],
  ])('the %s screen has a language picker next to its title', async (panel, what) => {
    renderApp(`/director/${panel}`, { loggedIn: true })
    const picker = await screen.findByLabelText(`Language of the ${what}`) as HTMLSelectElement
    expect(picker.value).toBe('en')
    expect(picker.querySelectorAll('option')).toHaveLength(10)
  })

  it('picking a language asks for the backend in demo mode and leaves the section as it was', async () => {
    renderApp('/director/story', { loggedIn: true })
    const picker = await screen.findByLabelText('Language of the story') as HTMLSelectElement
    await userEvent.selectOptions(picker, 'ta')
    expect(await screen.findByRole('alert')).toHaveTextContent('needs the studio backend')
    expect(picker.value).toBe('en')
  })

  it('a section uses its own language when the creator picked one, else the film’s', () => {
    const project = { language: 'hi', memory: { sectionLanguages: { lyrics: 'ta' } } }
    expect(sectionLanguage(project, 'lyrics')).toBe('ta')
    expect(sectionLanguage(project, 'story')).toBe('hi')
    expect(sectionLanguage({ memory: null }, 'story')).toBe('en')
  })

  it('tells the AI to write in the new script and keep what must not change', () => {
    expect(switchInstruction('lyrics', 'song', 'ta')).toContain('in Tamil (தமிழ்), written in தமிழ் script')
    expect(switchInstruction('characters', 'character details', 'hi')).toContain('name and "language" field exactly')
    expect(switchInstruction('screenplay', 'screenplay', 'en')).toContain('in English')
  })
})
