import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Elapsed, formatElapsed } from '../lib/useElapsed'

afterEach(() => { vi.useRealTimers() })

describe('response timers', () => {
  it('formats like Claude: seconds, then minutes, then hours', () => {
    expect(formatElapsed(800)).toBe('1s')
    expect(formatElapsed(12_000)).toBe('12s')
    expect(formatElapsed(65_000)).toBe('1m 05s')
    expect(formatElapsed(3_720_000)).toBe('1h 02m')
  })

  it('counts up every second while working, and from a server start time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'))
    const { rerender } = render(<Elapsed active />)
    expect(screen.getByTestId('elapsed')).toHaveTextContent('0s')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByTestId('elapsed')).toHaveTextContent('3s')
    rerender(<Elapsed active={false} />)
    expect(screen.queryByTestId('elapsed')).toBeNull()
    render(<Elapsed active since="2026-11-03T09:58:00Z" />)
    expect(screen.getAllByTestId('elapsed').at(-1)).toHaveTextContent('2m 03s')
  })
})
