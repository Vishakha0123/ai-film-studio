import { useState, useRef, useEffect } from 'react'
import type { NavFn } from '../types'
import { filmSeconds, photoUrl } from '../types'
import { useFilm, useStudio } from '../studio'

/** Shot titles from the design, used for the sample film. */
const SHOTS = [
  { imageId: '1518709268805-4e9042af9f23', title: 'Mountain Estate — Dusk' },
  { imageId: '1536440136628-849c177e76a1', title: 'The Changed Score' },
  { imageId: '1478720568477-152d9b164e26', title: 'Elena and the Shape' },
  { imageId: '1551373066-08073d2bf558', title: 'James in the Rain' },
]

const QUICK_EDITS = [
  'Make the ending scarier',
  'Change character appearance',
  'Add a ghost in the window',
  'Make it darker and slower',
  'Change to black and white',
  'Add more thunder',
]

const glass = { backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }

export default function Teaser({ navigate }: { navigate: NavFn }) {
  const film = useFilm()
  const { project } = useStudio()
  const seconds = filmSeconds(film) || 10
  const shots = film.shots.map((s, i) => ({
    ...s,
    title: project ? s.description : SHOTS[i]?.title ?? s.description,
  }))
  const words = film.title.split(' ')
  const titleHead = words.slice(0, -1).join(' ')
  const titleTail = words[words.length - 1]
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showOverlay, setShowOverlay] = useState(true)
  const [editInput, setEditInput] = useState('')
  const [showVersions, setShowVersions] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isPlaying) return
    intervalRef.current = setInterval(() => {
      setProgress(p => (p >= 100 ? 100 : p + 1))
    }, (seconds * 1000) / 100)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, seconds])

  // End of playback: stop and rewind (kept outside the state updater to avoid side effects there)
  useEffect(() => {
    if (progress >= 100) {
      setIsPlaying(false)
      setProgress(0)
    }
  }, [progress])

  const togglePlay = () => {
    setShowOverlay(false)
    setIsPlaying(p => !p)
  }

  const currentShot = Math.min(Math.floor((progress / 100) * shots.length), shots.length - 1)
  const shot = shots[currentShot]

  return (
    <div className="relative flex flex-col h-full bg-zinc-950 overflow-hidden" data-testid="screen-teaser">
      {/* Cinematic player — full bleed */}
      <div className="relative flex-1 min-h-[220px] overflow-hidden cursor-pointer" onClick={togglePlay} data-testid="teaser-player">
        {isPlaying && shot.videoUrl ? (
          <video
            key={shot.videoUrl}
            src={shot.videoUrl}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(25%) contrast(1.2) brightness(0.75)' }}
          />
        ) : (
          <img
            src={photoUrl(shot, 1920, 1080)}
            alt={shot.title}
            className="w-full h-full object-cover transition-all duration-700"
            style={{ filter: 'grayscale(25%) contrast(1.2) brightness(0.75)' }}
          />
        )}

        {/* Cinematic black bars */}
        <div className="absolute top-0 left-0 right-0 h-[12%]" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[12%]" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }} />

        {/* Film title overlay */}
        {showOverlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in px-4">
            <div className="text-center">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-3" style={{ color: '#d4a84b' }}>{film.genre}</p>
              <h1
                className="text-4xl sm:text-5xl md:text-7xl font-light mb-4"
                style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea', textShadow: '0 2px 40px rgba(0,0,0,0.8)' }}
              >
                {titleHead}{titleHead && <br />}
                <em>{titleTail}</em>
              </h1>
              <div className="flex items-center justify-center gap-3 mt-6">
                <div className="h-px w-12" style={{ backgroundColor: 'rgba(212,168,75,0.4)' }} />
                <p className="text-xs tracking-widest uppercase" style={{ color: 'rgba(212,168,75,0.6)' }}>{seconds} Seconds</p>
                <div className="h-px w-12" style={{ backgroundColor: 'rgba(212,168,75,0.4)' }} />
              </div>
            </div>
          </div>
        )}

        {/* Play button */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ backgroundColor: 'rgba(212,168,75,0.15)', border: '1px solid rgba(212,168,75,0.3)', backdropFilter: 'blur(8px)' }}
            >
              <svg viewBox="0 0 24 24" fill="#d4a84b" className="w-6 h-6 ml-1">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Shot label */}
        {isPlaying && (
          <div className="absolute bottom-8 left-8 animate-fade-in">
            <p className="text-xs text-zinc-400">{shot.title}</p>
          </div>
        )}

        {/* Top controls */}
        <div className="absolute top-5 left-4 right-4 sm:left-6 sm:right-6 flex items-center justify-between">
          <button
            aria-label="Back to editor"
            onClick={e => { e.stopPropagation(); navigate('director') }}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            style={glass}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span data-testid="teaser-time" className="text-xs font-mono text-zinc-400 px-2 py-1 rounded" style={glass}>
              {Math.floor((progress / 100) * seconds)}s / {seconds}s
            </span>
            <button
              onClick={e => { e.stopPropagation(); setShowVersions(v => !v) }}
              className="text-xs px-3 py-1.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              style={glass}
            >
              Versions
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full transition-all" style={{ width: `${progress}%`, backgroundColor: '#d4a84b' }} />
        </div>
      </div>

      {/* Bottom panel */}
      <div style={{ backgroundColor: '#0c0c0e', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Action row */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
            >
              {isPlaying ? (
                <><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Pause</>
              ) : (
                <><svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5v14l11-7z"/></svg>Play</>
              )}
            </button>
            <button
              onClick={() => navigate('generation')}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:opacity-80"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa', backgroundColor: 'transparent' }}
            >
              Regenerate
            </button>
            <button
              onClick={() => navigate('director')}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:opacity-80"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa', backgroundColor: 'transparent' }}
            >
              Edit
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('export')}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:opacity-80"
              style={{ borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b', backgroundColor: 'rgba(212,168,75,0.07)' }}
            >
              Export
            </button>
            <button className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:opacity-80" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
              Share
            </button>
          </div>
        </div>

        {/* Modification input */}
        <div className="px-4 sm:px-6 pb-5">
          <p className="text-xs text-zinc-600 mb-2">What would you like to change?</p>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              aria-label="Describe a change"
              placeholder='Try "Make the ending scarier" or "Change the music to orchestral"'
              value={editInput}
              onChange={e => setEditInput(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
            />
            <button
              disabled={!editInput.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
              style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
            >
              Apply
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {QUICK_EDITS.map(e => (
              <button
                key={e}
                onClick={() => setEditInput(e)}
                className="text-[10px] px-2.5 py-1 rounded-full border border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-all"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Versions panel */}
      {showVersions && (
        <div
          className="absolute top-14 right-4 sm:right-6 w-64 rounded-xl border overflow-hidden z-20 animate-fade-up"
          style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-xs font-semibold text-zinc-300">Versions</p>
            <button aria-label="Close versions" onClick={() => setShowVersions(false)} className="text-zinc-600 hover:text-zinc-400">×</button>
          </div>
          {[
            { label: 'Version 3 — Current', note: 'Dark Cinema + Thunder SFX', active: true },
            { label: 'Version 2', note: 'Original ending, no rain' },
            { label: 'Version 1', note: 'Initial generation' },
          ].map((v, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer hover:bg-zinc-800/40 transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}
            >
              <div className="w-12 h-8 rounded overflow-hidden flex-shrink-0" style={{ backgroundColor: '#1a1a1e' }}>
                <img
                  src={photoUrl(shots[0], 48, 32)}
                  alt=""
                  className="w-full h-full object-cover opacity-60"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: v.active ? '#d4a84b' : '#a1a1aa' }}>{v.label}</p>
                <p className="text-[10px] text-zinc-600 truncate">{v.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
