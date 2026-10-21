import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Screens } from '../App'

export function renderApp(path = '/', opts: { loggedIn?: boolean; replyDelay?: number; generationStepMs?: number } = {}) {
  if (opts.loggedIn) localStorage.setItem('cineai.token', 'test-token')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Screens replyDelay={opts.replyDelay ?? 5} generationStepMs={opts.generationStepMs ?? 10} />
    </MemoryRouter>,
  )
}
