import { isTeaserLocked } from '../features'
import DirectAI from '../components/DirectAI'
import { ComingSoonButton } from '../components/LockIcon'
import { useEffect, useState } from 'react'
import { characterPhoto, filmSeconds, shotCast, shotFrame, type Character } from '../types'
import { NoFrame } from '../components/CharacterPortrait'
import { useFilm } from '../studio'
import { useFilmEdit } from '../lib/useFilmEdit'
import type { Shot } from '../types'

const PRESETS = ['Photorealistic', 'Dark Cinema', 'Anime', '3D Render', 'Vintage'] as const

/**
 * How each style shows right away: a filter on real frames, and a tint on shots that have no frame yet
 * (the frames themselves are drawn in the style when they're generated).
 */
const STYLE_LOOK: Record<string, { filter: string; overlay?: string; tint: string }> = {
  Photorealistic: { filter: 'none', tint: 'linear-gradient(135deg, #2a2d33 0%, #4a4e55 55%, #1d1f23 100%)' },
  'Dark Cinema': { filter: 'grayscale(30%) contrast(1.15) brightness(0.85)', overlay: 'rgba(212,168,75,0.06)', tint: 'radial-gradient(ellipse at 30% 30%, #4a3416 0%, #17120b 55%, #070605 100%)' },
  Anime: { filter: 'saturate(1.9) contrast(1.15) brightness(1.08) hue-rotate(-12deg)', overlay: 'rgba(120,180,255,0.08)', tint: 'linear-gradient(135deg, #3b82f6 0%, #a855f7 50%, #f472b6 100%)' },
  '3D Render': { filter: 'saturate(1.35) contrast(1.25) brightness(1.05)', overlay: 'rgba(255,255,255,0.04)', tint: 'linear-gradient(135deg, #0f766e 0%, #155e75 45%, #c2410c 100%)' },
  Vintage: { filter: 'sepia(0.75) contrast(0.92) brightness(0.95) saturate(0.85)', overlay: 'rgba(120,80,30,0.12)', tint: 'linear-gradient(135deg, #7c5a32 0%, #a8885a 50%, #4a3520 100%)' },
  Custom: { filter: 'contrast(1.05)', tint: 'linear-gradient(135deg, #3f3f46 0%, #52525b 50%, #27272a 100%)' },
}

const CAMERAS = ['Extreme wide', 'Wide', 'Medium', 'Close-up', 'Extreme close-up', 'Over-the-shoulder', 'POV', 'Aerial']
const MOVES = ['Static', 'Pan', 'Tilt', 'Slow push-in', 'Dolly out', 'Tracking', 'Handheld', 'Crane up']

const presetOf = (v?: string) => (PRESETS as readonly string[]).find(p => p.toLowerCase() === (v ?? '').toLowerCase())

export default function Storyboard({ onGenerate }: { onGenerate: () => void }) {
  const film = useFilm()
  const shots = film.shots
  const { working, error, canEdit, ai, save } = useFilmEdit()
  const saved = film.visualStyle || 'Dark Cinema'
  const [style, setStyle] = useState<string>(presetOf(saved) ?? 'Custom')
  const [custom, setCustom] = useState(presetOf(saved) ? '' : saved)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setStyle(presetOf(saved) ?? 'Custom')
    if (!presetOf(saved)) setCustom(saved)
  }, [saved])

  const pickStyle = (s: string) => {
    setStyle(s) // the frames change look straight away
    if (s !== 'Custom' && canEdit && s !== saved) void save(`Switching to ${s}…`, { visualStyle: s })
  }

  const look = STYLE_LOOK[style] ?? STYLE_LOOK.Custom
  const updateShot = (shot: Shot, patch: Partial<Shot>, label: string) =>
    save(label, { shots: shots.map(s => (s.id === shot.id ? { ...s, ...patch } : s)) })

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-storyboard">
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Storyboard</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            Visual Breakdown
          </h2>
          <p className="text-sm text-zinc-500">{shots.length} shots · {filmSeconds(film)}s total</p>
        </div>

        {/* Visual style selector */}
        <div>
          <p className="text-xs text-zinc-600 mb-3">Visual Style</p>
          <div className="flex flex-wrap gap-2">
            {[...PRESETS, 'Custom'].map(s => (
              <button
                key={s}
                onClick={() => pickStyle(s)}
                aria-pressed={style === s}
                disabled={!!working}
                className="px-4 py-2 rounded-lg text-xs font-medium border transition-all"
                style={
                  style === s
                    ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.4)', color: '#d4a84b' }
                    : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }
                }
              >
                {s}
              </button>
            ))}
          </div>
          {style === 'Custom' && (
            <form onSubmit={e => { e.preventDefault(); if (custom.trim()) void save('Saving your style…', { visualStyle: custom.trim() }) }} className="flex gap-2 mt-3">
              <input
                aria-label="Describe your style"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                placeholder="e.g. watercolour, soft pastel light, hand-drawn lines"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <button type="submit" disabled={!custom.trim() || !!working} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>Apply</button>
            </form>
          )}
          <p className="text-[11px] text-zinc-600 mt-2" data-testid="style-note">
            {canEdit
              ? `Saved for this film — storyboard frames are drawn in ${style === 'Custom' ? 'your style' : style} when they're generated. Character portraits stay photorealistic.`
              : 'Preview only in demo mode.'}
          </p>
          {working && <p className="text-xs mt-2" style={{ color: '#d4a84b' }} data-testid="storyboard-working">{working}</p>}
          {error && <p role="alert" className="text-xs text-red-300 mt-2">{error}</p>}
        </div>

        {/* Shot grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-style={style}>
          {shots.map(shot => (
            <ShotCard
              key={shot.id}
              shot={shot}
              look={look}
              styleName={style === 'Custom' ? custom || 'your style' : style}
              cast={shotCast(shot, film.characters)}
              busy={!!working}
              isSelected={selected === shot.id}
              onSelect={() => setSelected(selected === shot.id ? null : shot.id)}
              onSave={(patch, label) => updateShot(shot, patch, label)}
              onRegenerate={() => ai(`Rewriting shot ${shot.number}…`, 'shots', 'transform',
                'Rewrite this shot: a fresh, more striking description, camera, movement and mood that fit the story. Keep its id, number and duration.', { item: shot.id })}
            />
          ))}
        </div>

        <DirectAI
          target="shots"
          appliesTo={selected ? `changes shot ${shots.find(sh => sh.id === selected)?.number} (click it again to change all shots)` : 'changes all shots (click a shot to change just that one)'}
          suggestions={['More close-ups', 'Add a drone shot', 'Slower camera moves', 'Make it look like a thriller']}
          placeholder='Try "Start with a wide shot of the city"'
          scope={selected ? { item: selected } : {}}
        />

        {/* Generate */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-sm text-zinc-400">All shots reviewed</p>
            <p className="text-xs text-zinc-600 mt-0.5">Visual style: {style === 'Custom' ? custom || 'Custom' : style}</p>
          </div>
          {isTeaserLocked() ? <ComingSoonButton label="Generate Visuals & Video" /> : (
          <button
            onClick={onGenerate}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
          >
            Generate Visuals & Video ▶
          </button>
          )}
        </div>
      </div>
    </div>
  )
}

type Mode = 'view' | 'edit' | 'camera'

function ShotCard({ shot, look, styleName, cast, busy, isSelected, onSelect, onSave, onRegenerate }: {
  shot: Shot
  look: { filter: string; overlay?: string; tint: string }
  styleName: string
  cast: Character[]
  busy: boolean
  isSelected: boolean
  onSelect: () => void
  onSave: (patch: Partial<Shot>, label: string) => Promise<boolean>
  onRegenerate: () => Promise<boolean>
}) {
  const [mode, setMode] = useState<Mode>('view')
  const [draft, setDraft] = useState({ description: shot.description, duration: shot.duration, mood: shot.mood, camera: shot.camera, movement: shot.movement })
  const open = (m: Mode) => { setDraft({ description: shot.description, duration: shot.duration, mood: shot.mood, camera: shot.camera, movement: shot.movement }); setMode(m) }
  const field = 'w-full px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600'
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const frame = shotFrame(shot, 600, 338)

  return (
    <div
      className="rounded-xl overflow-hidden border cursor-pointer transition-all"
      style={{
        borderColor: isSelected ? 'rgba(212,168,75,0.5)' : 'rgba(255,255,255,0.07)',
        boxShadow: isSelected ? '0 0 0 1px rgba(212,168,75,0.2)' : 'none',
      }}
      onClick={() => mode === 'view' && onSelect()}
      data-testid={`shot-${shot.number}`}
    >
      <div className="relative aspect-video bg-zinc-900">
        {frame.src ? (
          <>
            <img
              src={frame.src}
              alt={shot.description}
              className="w-full h-full object-cover transition-[filter] duration-500"
              style={{ filter: look.filter, opacity: 0.9 }}
              data-testid="shot-image"
            />
            {look.overlay && <div className="absolute inset-0 transition-colors duration-500" style={{ backgroundColor: look.overlay, mixBlendMode: 'overlay' }} />}
          </>
        ) : (
          <NoFrame tint={look.tint} styleName={styleName}>
            {cast.length > 0 && (
              <div className="absolute top-9 right-2 flex -space-x-2" data-testid="shot-cast">
                {cast.map(c => {
                  const src = characterPhoto(c, 64, 64)
                  return src
                    ? <img key={c.id} src={src} alt={c.name} title={c.name} className="w-8 h-8 rounded-full object-cover border-2" style={{ borderColor: '#111113' }} />
                    : null
                })}
              </div>
            )}
          </NoFrame>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(9,9,11,0.7) 0%, transparent 60%)' }} />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: 'rgba(9,9,11,0.8)', color: '#a1a1aa' }}>
          {shot.number.toString().padStart(2, '0')}
        </div>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: 'rgba(212,168,75,0.15)', color: '#d4a84b' }}>
          {shot.duration}
        </div>
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-xs text-zinc-300 leading-snug">{shot.description}</p>
        </div>
      </div>

      <div className="px-3 py-3" style={{ backgroundColor: '#111113' }}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-medium" style={{ color: '#d4d4d8' }}>{shot.camera}</span>
          <span className="text-[10px] text-zinc-600 text-right">{shot.movement}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1a1a1e', color: '#71717a' }}>{shot.mood}</span>
          {shot.characters !== 'None' && <span className="text-[10px] text-zinc-600">{shot.characters}</span>}
        </div>

        {mode === 'edit' && (
          <form onClick={stop} onSubmit={async e => { e.preventDefault(); if (await onSave({ description: draft.description.trim(), duration: draft.duration.trim(), mood: draft.mood.trim() }, 'Saving the shot…')) setMode('view') }} className="space-y-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <textarea aria-label="Shot description" rows={3} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} className={field} />
            <div className="flex gap-2">
              <input aria-label="Duration" value={draft.duration} onChange={e => setDraft(d => ({ ...d, duration: e.target.value }))} className={field} placeholder="2.5s" />
              <input aria-label="Mood" value={draft.mood} onChange={e => setDraft(d => ({ ...d, mood: e.target.value }))} className={field} placeholder="Mood" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !draft.description.trim()} className="px-3 py-1.5 rounded text-[11px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>Save</button>
              <button type="button" onClick={() => setMode('view')} className="px-3 py-1.5 rounded text-[11px] text-zinc-400">Cancel</button>
            </div>
          </form>
        )}

        {mode === 'camera' && (
          <form onClick={stop} onSubmit={async e => { e.preventDefault(); if (await onSave({ camera: draft.camera, movement: draft.movement }, 'Changing the camera…')) setMode('view') }} className="space-y-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex gap-2">
              <select aria-label="Camera" value={draft.camera} onChange={e => setDraft(d => ({ ...d, camera: e.target.value }))} className={field}>
                {[...new Set([draft.camera, ...CAMERAS])].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select aria-label="Movement" value={draft.movement} onChange={e => setDraft(d => ({ ...d, movement: e.target.value }))} className={field}>
                {[...new Set([draft.movement, ...MOVES])].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="px-3 py-1.5 rounded text-[11px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>Save</button>
              <button type="button" onClick={() => setMode('view')} className="px-3 py-1.5 rounded text-[11px] text-zinc-400">Cancel</button>
            </div>
          </form>
        )}

        {isSelected && mode === 'view' && (
          <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button onClick={e => { stop(e); open('edit') }} disabled={busy} className="flex-1 py-1.5 rounded text-[10px] font-medium border transition-all hover:text-zinc-200 disabled:opacity-40" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>Edit</button>
            <button onClick={e => { stop(e); void onRegenerate() }} disabled={busy} className="flex-1 py-1.5 rounded text-[10px] font-medium border transition-all hover:text-zinc-200 disabled:opacity-40" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>Regenerate</button>
            <button onClick={e => { stop(e); open('camera') }} disabled={busy} className="flex-1 py-1.5 rounded text-[10px] font-medium border transition-all hover:text-zinc-200 disabled:opacity-40" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>Change Camera</button>
          </div>
        )}
      </div>
    </div>
  )
}
