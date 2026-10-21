import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom has no media playback
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: () => {} })
Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() })
