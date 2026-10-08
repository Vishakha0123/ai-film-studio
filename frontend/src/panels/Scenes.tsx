import { isTeaserLocked } from '../features'
import { ComingSoonButton } from '../components/LockIcon'
import { useFilm } from '../studio'
import { filmSeconds } from '../types'

const CHECKLIST = [
  { label: 'Story', done: true },
  { label: 'Characters', done: true },
  { label: 'Screenplay', done: true },
  { label: 'Dialogue', done: true },
  { label: 'Lyrics', done: true },
  { label: 'Visual Style', done: true },
  { label: 'Audio', done: false },
]

const MOOD_COLORS: Record<string, string> = {
  Foreboding: '#6366f1',
  Unsettling: '#8b5cf6',
  Horror: '#ef4444',
  Conspiracy: '#f97316',
}

export default function Scenes({ onGenerate }: { onGenerate: () => void }) {
  const film = useFilm()
  const scenes = film.scenes
  const totalDuration = `${filmSeconds(film)}s`

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-scenes">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Scene Breakdown</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            {film.title}
          </h2>
          <p className="text-sm text-zinc-500">{scenes.length} scenes · {totalDuration} total · {film.genre}</p>
        </div>

        {/* Scenes */}
        <div className="space-y-3">
          {scenes.map((scene, i) => {
            const mood = MOOD_COLORS[scene.mood] || '#52525b'
            return (
              <div key={scene.id} className="px-5 py-4 rounded-xl border" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#1a1a1e', color: '#71717a' }}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: '#f4f0ea' }}>{scene.location} — {scene.time}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{scene.description}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold" style={{ color: '#d4a84b' }}>{scene.duration}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${mood}18`, border: `1px solid ${mood}30` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mood }} />
                    <span className="text-[10px] font-medium" style={{ color: MOOD_COLORS[scene.mood] || '#71717a' }}>{scene.mood}</span>
                  </div>
                  {scene.characters.map(c => (
                    <span key={c} className="text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: '#1a1a1e', color: '#71717a' }}>{c}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* AI Director Checklist */}
        <div className="px-5 py-5 rounded-xl" style={{ backgroundColor: 'rgba(212,168,75,0.04)', border: '1px solid rgba(212,168,75,0.15)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: '#d4a84b' }}>AI Director — Readiness Check</p>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-5">
            {CHECKLIST.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: item.done ? 'rgba(16,185,129,0.15)' : 'rgba(251,191,36,0.15)',
                    border: `1px solid ${item.done ? 'rgba(16,185,129,0.3)' : 'rgba(251,191,36,0.3)'}`,
                  }}
                >
                  {item.done ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" className="w-2.5 h-2.5">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#fbbf24' }} />
                  )}
                </div>
                <span className="text-xs" style={{ color: item.done ? '#a1a1aa' : '#fbbf24' }}>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: 'rgba(212,168,75,0.15)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f4f0ea' }}>Duration: {totalDuration}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{isTeaserLocked() ? 'Teaser generation is coming soon' : 'Audio generation optional — you can add it after'}</p>
            </div>
            {isTeaserLocked() ? <ComingSoonButton label="Generate Teaser" /> : (
            <button
              onClick={onGenerate}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] glow-accent"
              style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
            >
              Generate Teaser ▶
            </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
