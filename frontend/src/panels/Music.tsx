import { useEffect, useRef, useState } from 'react'
import { FILM_PROJECT } from '../types'

type MusicTrack = {
  id: string
  name: string
  prompt: string
  genre: string
  mood: string
  duration: number
  kind: string
  variation: number
}

const GENRES = ['Dark Classical', 'Cinematic Orchestra', 'Ambient', 'Electronic', 'Acoustic']
const MOODS = ['Haunting', 'Tense', 'Emotional', 'Epic', 'Hopeful']
const INITIAL_TRACK: MusicTrack = {
  id: 'symphony-preview',
  name: 'Symphony Fragment (Dark)',
  prompt: 'A haunting piano melody with low strings, slowly building tension. A ghostly, unfinished symphony for an isolated mountain estate.',
  genre: 'Dark Classical',
  mood: 'Haunting',
  duration: 10,
  kind: 'Background Music',
  variation: 0,
}
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

// Local instrumental demo; replace with an AI audio service when one is connected.
function createPreview(track: MusicTrack) {
  const sampleRate = 16000
  const samples = sampleRate * track.duration
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  const bright = ['Hopeful', 'Epic'].includes(track.mood)
  const notes = bright ? [0, 4, 7, 11, 7, 4, 2, 7] : [0, 3, 7, 10, 7, 3, 2, 7]
  const seed = [...track.prompt + track.genre + track.kind].reduce((sum, letter) => sum + letter.charCodeAt(0), track.variation)
  const root = 130.81 * 2 ** ((seed % 5) / 12)
  const beat = track.mood === 'Tense' || track.mood === 'Epic' ? 0.4 : 0.7
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate
    const step = Math.floor(t / beat)
    const local = t % beat
    const frequency = root * 2 ** (notes[(step + track.variation) % notes.length] / 12)
    const envelope = Math.min(local / 0.02, 1) * Math.exp(-local * 4)
    const fade = Math.min(t / 0.3, 1, (track.duration - t) / 0.8)
    const melody = Math.sin(2 * Math.PI * frequency * 2 * t) + 0.25 * Math.sin(2 * Math.PI * frequency * 4 * t)
    const drone = Math.sin(2 * Math.PI * root * t) + 0.4 * Math.sin(2 * Math.PI * root * 1.5 * t)
    view.setInt16(44 + i * 2, (melody * envelope * 0.2 + drone * 0.07) * fade * 32767, true)
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

export default function Music({ active }: { active: boolean }) {
  const [prompt, setPrompt] = useState(INITIAL_TRACK.prompt)
  const [genre, setGenre] = useState(INITIAL_TRACK.genre)
  const [mood, setMood] = useState(INITIAL_TRACK.mood)
  const [duration, setDuration] = useState(10)
  const [kind, setKind] = useState('Background Music')
  const [tracks, setTracks] = useState<MusicTrack[]>([INITIAL_TRACK])
  const [selectedId, setSelectedId] = useState(INITIAL_TRACK.id)
  const [teaserId, setTeaserId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [volume, setVolume] = useState(70)
  const [error, setError] = useState('')
  const audio = useRef<HTMLAudioElement>(null)
  const urls = useRef(new Map<string, string>())
  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selected = tracks.find(track => track.id === selectedId) ?? tracks[0]

  useEffect(() => {
    if (!active) audio.current?.pause()
  }, [active])

  useEffect(() => {
    const previews = urls.current
    return () => {
      if (generationTimer.current) clearTimeout(generationTimer.current)
      previews.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  const loadTrack = (track: MusicTrack) => {
    const player = audio.current
    if (!player) return
    player.pause()
    setSelectedId(track.id)
    setPosition(0)
    setError('')
    let url = urls.current.get(track.id)
    if (!url) {
      url = createPreview(track)
      urls.current.set(track.id, url)
    }
    player.src = url
    player.volume = volume / 100
    player.load()
  }

  const togglePlay = async () => {
    const player = audio.current
    if (!player) return
    try {
      if (!player.getAttribute('src')) loadTrack(selected)
      if (!player.paused) player.pause()
      else await player.play()
    } catch {
      setError('Unable to play this preview. Please try again.')
    }
  }

  const generate = (source?: MusicTrack) => {
    if (isGenerating || (!source && !prompt.trim())) return
    setIsGenerating(true)
    setError('')
    generationTimer.current = setTimeout(() => {
      try {
        const variation = tracks.length
        const track: MusicTrack = {
          id: `music-${Date.now()}`,
          name: `${source?.genre ?? genre} — Take ${variation + 1}`,
          prompt: source?.prompt ?? prompt.trim(),
          genre: source?.genre ?? genre,
          mood: source?.mood ?? mood,
          duration: source?.duration ?? duration,
          kind: source?.kind ?? kind,
          variation,
        }
        loadTrack(track)
        setTracks(previous => [track, ...previous])
      } catch {
        setError('Unable to create the preview. Please try again.')
      } finally {
        setIsGenerating(false)
      }
    }, 800)
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-music">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2 text-accent">Audio Studio</p>
          <h2 className="text-3xl font-light mb-1 text-film font-[family-name:var(--font-family-display)]">Music</h2>
          <p className="text-sm text-zinc-500">Background Music · Songs · {FILM_PROJECT.title}</p>
        </div>

        <div className="px-5 py-4 rounded-xl bg-surface border border-white/7">
          <div className="flex items-center gap-4 mb-4">
            <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause music' : 'Play music'} className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-80 bg-accent text-zinc-950 flex-shrink-0">
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 mb-1 truncate">{selected.name}</p>
              <input
                type="range"
                aria-label="Music playback position"
                min={0}
                max={selected.duration}
                step={0.1}
                value={position}
                onChange={event => {
                  if (!audio.current?.getAttribute('src')) loadTrack(selected)
                  const next = Number(event.target.value)
                  if (audio.current) audio.current.currentTime = next
                  setPosition(next)
                }}
                className="block w-full h-1 rounded-full cursor-pointer accent-accent"
              />
            </div>
            <span className="text-xs text-zinc-600 font-mono flex-shrink-0">{formatTime(position)} / {formatTime(selected.duration)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">{selected.genre} · {selected.mood}</p>
            <div className="flex items-center gap-2 w-24 flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0 text-zinc-600"><path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <input
                type="range"
                aria-label="Music volume"
                min={0}
                max={100}
                value={volume}
                onChange={event => {
                  const next = Number(event.target.value)
                  setVolume(next)
                  if (audio.current) audio.current.volume = next / 100
                }}
                className="w-full min-w-0 h-0.5 rounded-full cursor-pointer accent-accent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/6">
            <button type="button" onClick={() => generate(selected)} disabled={isGenerating} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 text-muted transition-all hover:text-zinc-300 disabled:opacity-40">Regenerate</button>
            <button type="button" onClick={() => setTeaserId(selected.id)} aria-pressed={teaserId === selected.id} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80 bg-accent text-zinc-950">{teaserId === selected.id ? 'Selected for Teaser' : 'Use in Teaser'}</button>
          </div>
        </div>

        <form onSubmit={event => { event.preventDefault(); generate() }} className="space-y-3">
          <p className="text-xs text-zinc-600">Music Generation</p>
          <div className="flex gap-1 p-1 rounded-xl bg-surface border border-white/6">
            {['Background Music', 'Song'].map(option => (
              <button key={option} type="button" onClick={() => setKind(option)} aria-pressed={kind === option} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${kind === option ? 'bg-white/7 text-film' : 'text-muted'}`}>{option}</button>
            ))}
          </div>
          <div className="px-4 py-3 rounded-xl border bg-surface border-white/8">
            <label htmlFor="music-prompt" className="block text-xs text-zinc-600 mb-3">Music Prompt</label>
            <textarea id="music-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Describe the instruments, atmosphere, and musical journey…" required rows={3} className="w-full bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none resize-y" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'music-genre', label: 'Genre / Style', value: genre, options: GENRES, change: setGenre },
              { id: 'music-mood', label: 'Mood', value: mood, options: MOODS, change: setMood },
            ].map(field => (
              <div key={field.id} className="px-4 py-3 rounded-xl border bg-surface border-white/8">
                <label htmlFor={field.id} className="block text-xs text-zinc-600 mb-2">{field.label}</label>
                <select id={field.id} value={field.value} onChange={event => field.change(event.target.value)} className="w-full bg-surface text-xs text-zinc-300 focus:outline-none cursor-pointer">
                  {field.options.map(option => <option key={option}>{option}</option>)}
                </select>
              </div>
            ))}
            <div className="px-4 py-3 rounded-xl border bg-surface border-white/8">
              <label htmlFor="music-duration" className="block text-xs text-zinc-600 mb-2">Duration</label>
              <select id="music-duration" value={duration} onChange={event => setDuration(Number(event.target.value))} className="w-full bg-surface text-xs text-zinc-300 focus:outline-none cursor-pointer">
                {[10, 15, 30, 60].map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={isGenerating || !prompt.trim()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40 bg-accent text-zinc-950">
            {isGenerating && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 spinner"><path d="M12 3a9 9 0 019 9" strokeLinecap="round" /></svg>}
            {isGenerating ? 'Generating Music…' : 'Generate Music'}
          </button>
          <p className="text-xs text-zinc-600">Local instrumental previews · AI music and vocal generation are not connected.</p>
        </form>

        <div className="space-y-3">
          <p className="text-xs text-zinc-600">Music Tracks</p>
          {tracks.map(track => (
            <button key={track.id} type="button" onClick={() => loadTrack(track)} aria-pressed={selectedId === track.id} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all bg-surface text-left ${selectedId === track.id ? 'border-accent/40' : 'border-white/7 hover:border-white/12'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-cyan-500 flex-shrink-0"><path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-300 truncate">{track.name}</p>
                <p className="text-xs text-zinc-600 mt-1">{track.kind} · {track.mood}</p>
              </div>
              {teaserId === track.id && <span className="text-xs text-accent">Teaser</span>}
              <span className="text-xs font-mono text-zinc-600 flex-shrink-0">{formatTime(track.duration)}</span>
            </button>
          ))}
        </div>
        <p role="status" className="text-xs text-zinc-500">{error || (teaserId ? 'Music selected for the teaser in this demo workspace.' : '')}</p>
        <audio ref={audio} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onTimeUpdate={() => setPosition(audio.current?.currentTime ?? 0)} onError={() => setError('Unable to play this preview. Please regenerate the track.')} />
      </div>
    </div>
  )
}
