import { useState } from 'react'
import { photoUrl } from '../types'
import { useFilm } from '../studio'
import type { Shot } from '../types'

const VISUAL_STYLES = ['Photorealistic', 'Dark Cinema', 'Anime', '3D Render', 'Vintage', 'Custom']

export default function Storyboard({ onGenerate }: { onGenerate: () => void }) {
  const [style, setStyle] = useState('Dark Cinema')
  const [selected, setSelected] = useState<string | null>(null)
  const film = useFilm()
  const shots = film.shots

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-storyboard">
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Storyboard</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            Visual Breakdown
          </h2>
          <p className="text-sm text-zinc-500">{shots.length} shots · 10s total</p>
        </div>

        {/* Visual style selector */}
        <div>
          <p className="text-xs text-zinc-600 mb-3">Visual Style</p>
          <div className="flex flex-wrap gap-2">
            {VISUAL_STYLES.map(s => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                aria-pressed={style === s}
                className="px-4 py-2 rounded-lg text-xs font-medium border transition-all"
                style={
                  style === s
                    ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.4)', color: '#d4a84b' }
                    : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Shot grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shots.map(shot => (
            <ShotCard key={shot.id} shot={shot} isSelected={selected === shot.id} onSelect={() => setSelected(selected === shot.id ? null : shot.id)} />
          ))}
        </div>

        {/* Generate */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-sm text-zinc-400">All shots reviewed</p>
            <p className="text-xs text-zinc-600 mt-0.5">Visual style: {style}</p>
          </div>
          <button
            onClick={onGenerate}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
          >
            Generate Visuals & Video ▶
          </button>
        </div>
      </div>
    </div>
  )
}

function ShotCard({ shot, isSelected, onSelect }: { shot: Shot; isSelected: boolean; onSelect: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden border cursor-pointer transition-all"
      style={{
        borderColor: isSelected ? 'rgba(212,168,75,0.5)' : 'rgba(255,255,255,0.07)',
        boxShadow: isSelected ? '0 0 0 1px rgba(212,168,75,0.2)' : 'none',
      }}
      onClick={onSelect}
      data-testid={`shot-${shot.number}`}
    >
      <div className="relative aspect-video bg-zinc-900">
        <img
          src={photoUrl(shot, 600, 338, 70)}
          alt={shot.description}
          className="w-full h-full object-cover"
          style={{ filter: 'grayscale(30%) contrast(1.15)', opacity: 0.85 }}
        />
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

        {isSelected && (
          <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {['Edit', 'Regenerate', 'Change Camera'].map(a => (
              <button
                key={a}
                onClick={e => e.stopPropagation()}
                className="flex-1 py-1.5 rounded text-[10px] font-medium border transition-all"
                style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
