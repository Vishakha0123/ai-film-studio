import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_MODE, getHealth, transcribeAudio } from '../api'

/**
 * Voice input for the AI Director chat.
 *
 *  - "server":  record with MediaRecorder, transcribe on the backend (Sarvam Saaras) —
 *               used when the backend has STT_PROVIDER=sarvam. Best for Indian languages.
 *  - "browser": the browser's own speech recognition (Chrome, Edge, Safari) — live words
 *               appear as you speak.
 *  - "none":    neither is available (e.g. Firefox without a server provider).
 */
export type DictationMode = 'server' | 'browser' | 'none'
export type DictationState = 'idle' | 'listening' | 'transcribing'

const LOCALES: Record<string, string> = {
  en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN',
}
/** Sarvam's REST endpoint is for short clips. */
const MAX_RECORDING_MS = 30_000

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib).
interface SpeechRecognitionResultLike { isFinal: boolean; 0: { transcript: string } }
interface SpeechRecognitionEventLike { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

let serverSttPromise: Promise<boolean> | null = null
function serverSttAvailable(): Promise<boolean> {
  if (DEMO_MODE || typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(false)
  serverSttPromise ??= getHealth().then(h => !!h && h.providers.stt !== undefined && h.providers.stt !== 'mock')
  return serverSttPromise
}

function join(base: string, addition: string): string {
  const a = addition.trim()
  if (!a) return base
  return base && !/\s$/.test(base) ? `${base} ${a}` : `${base}${a}`
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings and try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow it in your browser’s site settings and try again.',
  'no-speech': 'No speech heard. Tap the mic and try again.',
  'audio-capture': 'No microphone found.',
  network: 'Voice input needs an internet connection.',
}

export function useDictation(opts: { language: string; getText: () => string; setText: (t: string) => void }) {
  const [mode, setMode] = useState<DictationMode>(() => (speechRecognitionCtor() ? 'browser' : 'none'))
  const [state, setState] = useState<DictationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    serverSttAvailable().then(ok => alive && ok && setMode('server'))
    return () => { alive = false }
  }, [])

  const cleanup = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current)
    recognition.current?.stop()
    recognition.current = null
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
  }, [])

  useEffect(() => cleanup, [cleanup])

  const startBrowser = useCallback(() => {
    const Ctor = speechRecognitionCtor()
    if (!Ctor) return false
    const rec = new Ctor()
    rec.lang = LOCALES[optsRef.current.language] ?? 'en-IN'
    rec.continuous = true
    rec.interimResults = true
    const base = optsRef.current.getText()
    let finalText = ''
    rec.onresult = e => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      optsRef.current.setText(join(base, finalText + interim))
    }
    rec.onerror = e => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'Voice input stopped unexpectedly.')
    }
    rec.onend = () => {
      recognition.current = null
      setState('idle')
    }
    recognition.current = rec
    rec.start()
    setState('listening')
    return true
  }, [])

  const startServer = useCallback(async () => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError(ERRORS['not-allowed'])
      return
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported?.(t))
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = e => e.data.size && chunks.push(e.data)
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      recorder.current = null
      if (stopTimer.current) clearTimeout(stopTimer.current)
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
      if (!blob.size) {
        setState('idle')
        return
      }
      setState('transcribing')
      try {
        const text = await transcribeAudio(blob, optsRef.current.language)
        if (!text.trim()) setError(ERRORS['no-speech'])
        else optsRef.current.setText(join(optsRef.current.getText(), text))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Transcription failed.')
      } finally {
        setState('idle')
      }
    }
    recorder.current = rec
    rec.start()
    setState('listening')
    stopTimer.current = setTimeout(() => rec.state !== 'inactive' && rec.stop(), MAX_RECORDING_MS)
  }, [])

  const toggle = useCallback(() => {
    setError(null)
    if (state === 'listening') {
      cleanup()
      if (mode === 'browser') setState('idle')
      return
    }
    if (state === 'transcribing') return
    if (mode === 'server') void startServer()
    else if (mode === 'browser') startBrowser()
    else setError('Voice input isn’t supported in this browser. Try Chrome, Edge or Safari.')
  }, [state, mode, cleanup, startServer, startBrowser])

  return { mode, state, error, toggle, supported: mode !== 'none', clearError: () => setError(null) }
}
