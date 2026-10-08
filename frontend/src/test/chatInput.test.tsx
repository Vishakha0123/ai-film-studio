import { describe, it, expect, afterEach } from 'vitest'
import { screen, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from './renderApp'

const file = (name: string, size = 2048, type = 'application/pdf') => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('chat input — attachments', () => {
  it('attach button opens the file picker and selected files show as removable chips', async () => {
    renderApp('/director', { loggedIn: true })
    const input = screen.getByTestId('file-input') as HTMLInputElement
    let opened = false
    input.addEventListener('click', () => { opened = true })
    await userEvent.click(screen.getByRole('button', { name: 'Attach files' }))
    expect(opened).toBe(true)

    await userEvent.upload(input, [file('story.pdf'), file('lyrics.txt', 300, 'text/plain')])
    const chips = screen.getByTestId('attachment-chips')
    expect(within(chips).getByText('story.pdf')).toBeInTheDocument()
    expect(within(chips).getByText('lyrics.txt')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remove story.pdf' }))
    expect(within(screen.getByTestId('attachment-chips')).queryByText('story.pdf')).toBeNull()
  })

  it('rejects unsupported and oversized files with a readable message', async () => {
    renderApp('/director', { loggedIn: true })
    const input = screen.getByTestId('file-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file('virus.exe'), file('huge.pdf', 11 * 1024 * 1024)] } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('virus.exe: use PDF, Word, text or an image')
    expect(alert).toHaveTextContent('huge.pdf: larger than 10 MB')
    expect(screen.queryByTestId('attachment-chips')).toBeNull()
  })

  it('a file alone can be sent and appears on the message', async () => {
    renderApp('/director', { loggedIn: true })
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()
    await userEvent.upload(screen.getByTestId('file-input') as HTMLInputElement, file('treatment.docx'))
    expect(send).toBeEnabled()
    await userEvent.click(send)
    expect(screen.queryByTestId('attachment-chips')).toBeNull()
    expect(screen.getByText('treatment.docx')).toBeInTheDocument()
    expect(await screen.findByTestId('panel-story', {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('files can be dropped onto the chat', async () => {
    renderApp('/director', { loggedIn: true })
    fireEvent.drop(screen.getByTestId('panel-chat'), { dataTransfer: { files: [file('ref.png', 4096, 'image/png')], types: ['Files'] } })
    expect(within(screen.getByTestId('attachment-chips')).getByText('ref.png')).toBeInTheDocument()
  })
})

class FakeRecognition {
  static last: FakeRecognition | null = null
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = false
  constructor() { FakeRecognition.last = this }
  start() { this.started = true }
  stop() { this.started = false; this.onend?.() }
}

describe('chat input — voice', () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  })

  it('explains when the browser has no speech recognition', async () => {
    renderApp('/director', { loggedIn: true })
    await userEvent.click(screen.getByTestId('mic-button'))
    expect(screen.getByRole('alert')).toHaveTextContent('Voice input isn’t supported in this browser')
  })

  it('dictates into the message box and stops on a second tap', async () => {
    ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition
    renderApp('/director', { loggedIn: true })
    const box = screen.getByLabelText('Message the AI Director') as HTMLTextAreaElement
    await userEvent.type(box, 'A heist')

    await userEvent.click(screen.getByRole('button', { name: 'Voice input' }))
    const rec = FakeRecognition.last!
    expect(rec.started).toBe(true)
    expect(rec.lang).toBe('en-IN')
    expect(screen.getByRole('button', { name: 'Stop voice input' })).toHaveAttribute('aria-pressed', 'true')

    act(() => rec.onresult!({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'in Mumbai at night' } }] }))
    expect(box.value).toBe('A heist in Mumbai at night')

    await userEvent.click(screen.getByRole('button', { name: 'Stop voice input' }))
    expect(rec.started).toBe(false)
    expect(screen.getByRole('button', { name: 'Voice input' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a clear message when the microphone is blocked', async () => {
    ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition
    renderApp('/director', { loggedIn: true })
    await userEvent.click(screen.getByRole('button', { name: 'Voice input' }))
    act(() => FakeRecognition.last!.onerror!({ error: 'not-allowed' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone access is blocked')
  })
})
