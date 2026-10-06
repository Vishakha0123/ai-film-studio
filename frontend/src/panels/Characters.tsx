import { useState } from 'react'
import { FILM_PROJECT } from '../types'
import type { Character } from '../types'

const ACTIONS = ['Edit', 'Regenerate', 'Change Appearance', 'Add Character']

export default function Characters() {
  const [selected, setSelected] = useState<string | null>('1')

  const chars = FILM_PROJECT.characters
  const char = chars.find(c => c.id === selected) ?? chars[0]

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-characters">
      <div className="max-w-3xl mx-auto animate-fade-up">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>AI Generated Characters</p>
          <h2 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            Cast of Characters
          </h2>
          <p className="text-sm text-zinc-500 mt-1">{chars.length} characters · Echoes of the Forgotten</p>
        </div>

        <div className="flex gap-3 sm:gap-4 flex-wrap mb-8">
          {chars.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              aria-pressed={selected === c.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
              style={{
                borderColor: selected === c.id ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)',
                backgroundColor: selected === c.id ? 'rgba(212,168,75,0.07)' : 'rgba(255,255,255,0.02)',
              }}
            >
              <img
                src={`https://images.unsplash.com/photo-${c.imageId}?w=64&h=64&fit=crop&auto=format`}
                alt={c.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                style={{ filter: 'grayscale(30%) contrast(1.1)' }}
              />
              <div className="text-left">
                <p className="text-sm font-medium" style={{ color: selected === c.id ? '#f4f0ea' : '#a1a1aa' }}>{c.name}</p>
                <p className="text-xs" style={{ color: selected === c.id ? '#d4a84b' : '#52525b' }}>{c.role}</p>
              </div>
            </button>
          ))}
          <button className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-all text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            Add Character
          </button>
        </div>

        {char && <CharacterDetail char={char} />}
      </div>
    </div>
  )
}

function CharacterDetail({ char }: { char: Character }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up" key={char.id}>
      {/* Portrait */}
      <div className="md:col-span-1">
        <div className="aspect-[3/4] max-w-xs md:max-w-none mx-auto rounded-xl overflow-hidden relative" style={{ backgroundColor: '#111113' }}>
          <img
            src={`https://images.unsplash.com/photo-${char.imageId}?w=400&h=533&fit=crop&auto=format`}
            alt={char.name}
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(20%) contrast(1.1)' }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(9,9,11,0.8) 0%, transparent 50%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-sm font-semibold" style={{ color: '#f4f0ea' }}>{char.name}</p>
            <p className="text-xs" style={{ color: '#d4a84b' }}>{char.role} · Age {char.age}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {ACTIONS.slice(0, 3).map(a => (
            <button
              key={a}
              className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#71717a', backgroundColor: 'transparent' }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Profile */}
      <div className="md:col-span-2 space-y-3">
        {[
          { label: 'Personality', value: char.personality },
          { label: 'Appearance', value: char.appearance },
          { label: 'Character Arc', value: char.arc },
          { label: 'Relationships', value: char.relationships },
        ].map(row => (
          <div key={row.label} className="px-4 py-4 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#52525b' }}>{row.label}</p>
            <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
