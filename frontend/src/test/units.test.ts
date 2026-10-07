import { describe, it, expect } from 'vitest'
import { classifyLine } from '../panels/Screenplay'
import { formatTime } from '../panels/Music'
import { isStageComplete, WORKFLOW } from '../components/Sidebar'
import { PANEL_ORDER, PANEL_TITLES } from '../screens/Director'
import { PANELS, FILM_PROJECT } from '../types'

describe('screenplay formatting', () => {
  it('classifies screenplay lines', () => {
    expect(classifyLine('ECHOES OF THE FORGOTTEN', 0)).toBe('title')
    expect(classifyLine('EXT. MOUNTAIN ESTATE — DUSK', 4)).toBe('heading')
    expect(classifyLine('INT. STUDY — LATER', 9)).toBe('heading')
    expect(classifyLine('FADE IN:', 2)).toBe('transition')
    expect(classifyLine('SMASH CUT TO BLACK.', 50)).toBe('transition')
    expect(classifyLine('ELENA', 12)).toBe('character')
    expect(classifyLine('(whispering)', 13)).toBe('parenthetical')
    expect(classifyLine('', 3)).toBe('blank')
    expect(classifyLine('She turns.', 20)).toBe('action')
  })

  it('formats every line of the sample screenplay', () => {
    const kinds = FILM_PROJECT.screenplay.split('\n').map(classifyLine)
    expect(kinds.filter(k => k === 'heading')).toHaveLength(4)
    expect(kinds.filter(k => k === 'character').length).toBeGreaterThanOrEqual(3)
  })
})

describe('music time format', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(6.4)).toBe('0:06')
    expect(formatTime(75)).toBe('1:15')
  })
})

describe('workflow', () => {
  it('stages are marked complete as the Director progresses', () => {
    expect(isStageComplete(-1, 8)).toBe(false) // the Director chat itself is never "complete"
    expect(isStageComplete(0, 0)).toBe(false)
    expect(isStageComplete(0, 1)).toBe(true)
    expect(isStageComplete(7, 7)).toBe(false)
    expect(isStageComplete(7, 8)).toBe(true)
  })

  it('every panel has a sidebar entry and a title', () => {
    for (const p of PANELS) {
      expect(WORKFLOW.some(w => w.id === p)).toBe(true)
      expect(PANEL_TITLES[p]).toBeTruthy()
    }
    expect(PANEL_ORDER).toHaveLength(8)
  })
})
