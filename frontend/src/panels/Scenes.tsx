import { isTeaserLocked } from '../features'
import { ComingSoonButton } from '../components/LockIcon'
import { useState } from 'react'
import { useFilm } from '../studio'
import { filmSeconds, type Scene } from '../types'
import { useFilmEdit } from '../lib/useFilmEdit'
import DirectAI, { EditButton, SaveCancel, fieldCls } from '../components/DirectAI'

type SceneDraft = Omit<Scene, 'characters'> & { characters: string }

/** Hand edit of one scene: place, time, what happens, mood, length and who's in it. */
function SceneEditor({ scene, onSave, onCancel, saving, error }: { scene: Scene; onSave: (s: Scene) => void; onCancel: () => void; saving: boolean; error: string | null }) {
  const [d, setD] = useState<SceneDraft>({ ...scene, characters: scene.characters.join(', ') })
  const set = <K extends keyof SceneDraft>(k: K, v: SceneDraft[K]) => setD(x => ({ ...x, [k]: v }))
  return (
    <div className="space-y-3" data-testid="scene-edit">
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <input aria-label="Location" value={d.location} onChange={e => set('location', e.target.value)} placeholder="INT. KITCHEN" className={fieldCls} />
        <input aria-label="Time" value={d.time} onChange={e => set('time', e.target.value)} placeholder="NIGHT" className={fieldCls} />
      </div>
      <textarea aria-label="What happens" rows={3} value={d.description} onChange={e => set('description', e.target.value)} className={`${fieldCls} resize-y`} />
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_100px_2fr] gap-2">
        <input aria-label="Mood" value={d.mood} onChange={e => set('mood', e.target.value)} placeholder="Mood" className={fieldCls} />
        <input aria-label="Scene length" value={d.duration} onChange={e => set('duration', e.target.value)} placeholder="3s" className={fieldCls} />
        <input aria-label="Characters in scene" value={d.characters} onChange={e => set('characters', e.target.value)} placeholder="Names, separated by commas" className={`${fieldCls} col-span-2 sm:col-span-1`} />
      </div>
      <SaveCancel
        saving={saving}
        saveLabel="Save scene"
        onCancel={onCancel}
        onSave={() => onSave({ ...d, location: d.location.trim(), time: d.time.trim(), characters: d.characters.split(',').map(c => c.trim()).filter(Boolean) })}
      />
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  )
}

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
  const { working, error, save } = useFilmEdit()
  const [editing, setEditing] = useState<string | null>(null)
  const saveScene = async (updated: Scene) => {
    if (await save(`Saving scene ${updated.number}…`, { scenes: scenes.map(sc => (sc.id === updated.id ? updated : sc)) })) setEditing(null)
  }

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
              <div key={scene.id} className="px-5 py-4 rounded-xl border" style={{ backgroundColor: '#111113', borderColor: editing === scene.id ? 'rgba(212,168,75,0.3)' : 'rgba(255,255,255,0.07)' }} data-testid="scene-card">
                {editing === scene.id ? (
                  <SceneEditor scene={scene} onSave={s => void saveScene(s)} onCancel={() => setEditing(null)} saving={!!working} error={error} />
                ) : (
                <>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-xs font-semibold" style={{ color: '#d4a84b' }}>{scene.duration}</p>
                    <EditButton onClick={() => setEditing(scene.id)} disabled={!!working || (editing !== null && editing !== scene.id)} ariaLabel={`Edit scene ${i + 1}`} />
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
                </>
                )}
              </div>
            )
          })}
        </div>

        <DirectAI
          target="scenes"
          appliesTo="changes the scene breakdown"
          suggestions={['Add a scene before the climax', 'Make every scene shorter', 'Move the ending to a rooftop', 'Give each scene a stronger mood']}
          placeholder='Try "Add a flashback scene" or "Make scene 2 happen at night"'
        />

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
