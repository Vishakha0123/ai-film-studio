import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'
import { DEMO } from '../demo'
import { SITE } from '../site'

beforeEach(() => {
  localStorage.clear()
  HTMLMediaElement.prototype.pause = vi.fn()
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
})
afterEach(() => vi.restoreAllMocks())

describe('home page', () => {
  it('has How it works, Features, Languages, a final call to action and the footer', () => {
    renderApp('/')
    expect(screen.getByTestId('landing-how')).toHaveTextContent('From one line to a full film')
    expect(within(screen.getByTestId('landing-features')).getAllByRole('heading', { level: 3 })).toHaveLength(8)
    expect(screen.getByTestId('landing-features')).toHaveTextContent('Soon')
    expect(screen.getByTestId('landing-languages')).toHaveTextContent('தமிழ்')
    expect(screen.getByTestId('landing-cta')).toHaveTextContent('Create With AI')
    const footer = screen.getByTestId('public-footer')
    for (const name of ['About', 'Contact us', 'Privacy Policy', 'Terms of Service', 'Watch demo', 'Features'])
      expect(within(footer).getByRole(/Privacy|Terms|About|Contact/.test(name) ? 'link' : 'button', { name })).toBeInTheDocument()
    expect(within(footer).queryByText(/cookie/i)).toBeNull()
    expect(footer).toHaveTextContent(`© ${SITE.year} ${SITE.name}`)
    expect(footer).toHaveTextContent(SITE.email)
  })

  it('top bar links: sections, Contact, Sign In and Get Started', () => {
    renderApp('/')
    const nav = screen.getByTestId('public-nav')
    for (const name of ['Features', 'How it works', 'Languages']) expect(within(nav).getByRole('button', { name })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact')
    expect(within(nav).getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Get Started' })).toBeInTheDocument()
  })

  it('Watch Demo opens the one-minute video with captions and chapters; Esc closes it', async () => {
    renderApp('/')
    expect(screen.queryByTestId('demo-modal')).toBeNull()
    await userEvent.click(screen.getByTestId('landing-watch-demo'))
    const modal = screen.getByTestId('demo-modal')
    expect(within(modal).getByTestId('demo-video')).toHaveAttribute('src', DEMO.src)
    expect(within(modal).getByTestId('demo-caption')).toHaveTextContent('1 · Describe your idea')
    expect(within(modal).getAllByRole('button', { pressed: false }).length + 1).toBe(DEMO.chapters.length)
    // jumping to a chapter moves the video and the caption
    await userEvent.click(within(modal).getByTestId('demo-chapter-4'))
    expect((within(modal).getByTestId('demo-video') as HTMLVideoElement).currentTime).toBe(DEMO.chapters[3].start)
    expect(within(modal).getByTestId('demo-caption')).toHaveTextContent('4 · Two families, two languages')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('demo-modal')).toBeNull()
  })

  it('the close button and the footer link work too; ?demo=1 opens it directly', async () => {
    renderApp('/?demo=1')
    expect(screen.getByTestId('demo-modal')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('demo-close'))
    expect(screen.queryByTestId('demo-modal')).toBeNull()
    await userEvent.click(within(screen.getByTestId('public-footer')).getByRole('button', { name: 'Watch demo' }))
    expect(screen.getByTestId('demo-modal')).toBeInTheDocument()
  })

  it('"Try it free" goes to sign in', async () => {
    renderApp('/?demo=1')
    await userEvent.click(screen.getByTestId('demo-try'))
    expect(screen.getByTestId('screen-login')).toBeInTheDocument()
  })
})

describe('public pages', () => {
  it.each([
    ['/privacy', 'page-privacy', 'Privacy Policy', 'Sarvam AI'],
    ['/terms', 'page-terms', 'Terms of Service', 'Acceptable use'],
    ['/about', 'page-about', `About ${SITE.name}`, '10 Indian languages'],
    ['/contact', 'page-contact', 'Contact us', 'we read every message'],
  ])('%s opens without signing in', (path, testId, title, text) => {
    renderApp(path)
    const page = screen.getByTestId(testId)
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent(title)
    expect(page).toHaveTextContent(text)
    expect(page).toHaveTextContent(SITE.email)
    expect(within(page).getByTestId('public-footer')).toBeInTheDocument()
  })

  it('privacy and terms show the date they were last updated', () => {
    renderApp('/privacy')
    expect(screen.getByTestId('page-privacy')).toHaveTextContent(`Last updated: ${SITE.legalUpdated}`)
  })

  it('the contact form has name, email, subject and message', () => {
    renderApp('/contact')
    const form = screen.getByTestId('contact-form')
    for (const label of ['Your name', 'Your email', 'Subject', 'Message']) expect(within(form).getByLabelText(label)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Send message' })).toBeInTheDocument()
  })

  it('a signed-in visitor gets Open Studio on the public pages', () => {
    renderApp('/terms', { loggedIn: true })
    expect(within(screen.getByTestId('public-nav')).getByTestId('landing-open-studio')).toBeInTheDocument()
  })
})
