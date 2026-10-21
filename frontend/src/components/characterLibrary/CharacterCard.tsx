import { useState } from 'react'
import { AGE_GROUPS, ETHNICITY_LABEL, personLabel, type LibraryEntry } from '../../lib/characterLibrary'

const GOLD = '#d4a84b'

/** One library character: their own portrait (or an honest "not added yet"), age, id and Select. */
export default function CharacterCard({ character: c, selected, onSelect }: {
  character: LibraryEntry
  selected: boolean
  onSelect: (c: LibraryEntry) => void
}) {
  const [image, setImage] = useState<'loading' | 'loaded' | 'broken'>('loading')
  const group = AGE_GROUPS.find(g => g.id === c.ageGroup)!
  const who = personLabel(c)

  return (
    <article
      className="rounded-xl overflow-hidden border flex flex-col transition-all"
      style={{
        backgroundColor: '#111113',
        borderColor: selected ? 'rgba(212,168,75,0.7)' : 'rgba(255,255,255,0.07)',
        boxShadow: selected ? '0 0 0 1px rgba(212,168,75,0.35), 0 8px 24px rgba(212,168,75,0.08)' : 'none',
      }}
      aria-label={`${c.id}, ${who}, age ${c.age}`}
      data-testid="library-card"
      data-id={c.id}
      data-age={c.age}
      data-gender={c.gender}
      data-selected={selected || undefined}
    >
      <div className="relative aspect-[3/4] bg-zinc-900">
        {c.portrait.status === 'ready' && image !== 'broken' ? (
          <>
            {image === 'loading' && <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: '#1c1c20' }} data-testid="portrait-loading" />}
            <img
              src={c.portrait.src}
              alt={`${who}, age ${c.age} — ${c.heritage}`}
              width={c.image.width}
              height={c.image.height}
              loading="lazy"
              onLoad={() => setImage('loaded')}
              onError={() => setImage('broken')}
              className="w-full h-full object-cover transition-opacity duration-300"
              style={{ opacity: image === 'loaded' ? 1 : 0 }}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center border-b border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)' }} data-testid="portrait-missing">
            <svg viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" className="w-8 h-8" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" />
            </svg>
            <p className="text-xs font-medium text-zinc-400">{image === 'broken' ? 'Portrait file couldn’t load' : 'Portrait not added yet'}</p>
            <p className="text-[10px] text-zinc-600 break-all">{c.image.file}</p>
          </div>
        )}
        {selected && (
          <span className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: GOLD }} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="#09090b" strokeWidth="3" className="w-4 h-4"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        )}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" style={{ backgroundColor: 'rgba(9,9,11,0.8)', color: '#a1a1aa' }}>
          {group.label}
        </span>
        {c.portrait.status === 'ready' && (
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'rgba(9,9,11,0.8)', color: c.portrait.generated ? '#a1a1aa' : '#fbbf24' }}
            title={c.portrait.generated ? `Generated with ${c.portrait.generated.model} on ${c.portrait.generated.generatedAt.slice(0, 10)}` : 'This file was not made by characters:generate'}
            data-testid="portrait-origin">
            {c.portrait.generated ? `AI-generated · ${c.portrait.generated.model}` : 'Unverified image'}
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <code className="self-start px-1.5 py-0.5 rounded text-[10px] text-zinc-400" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} data-testid="character-id">{c.id}</code>
        <p className="text-sm font-medium leading-snug" style={{ color: '#f4f0ea' }}>{c.name ? `${c.name} · ` : ''}{who} · <span style={{ color: GOLD }} className="whitespace-nowrap">Age {c.age}</span></p>
        <p className="text-[11px] text-zinc-500">{c.heritage} · {ETHNICITY_LABEL[c.ethnicity]}</p>
        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2" title={c.appearance}>{c.appearance}</p>
        <button
          type="button"
          onClick={() => onSelect(c)}
          aria-pressed={selected}
          className="mt-auto w-full py-2 rounded-lg text-xs font-semibold transition-all"
          style={selected
            ? { backgroundColor: GOLD, color: '#09090b' }
            : { backgroundColor: 'transparent', color: GOLD, border: '1px solid rgba(212,168,75,0.35)' }}
        >
          {selected ? 'Selected ✓' : 'Select Character'}
        </button>
      </div>
    </article>
  )
}

export function CharacterCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border animate-pulse" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.05)' }} data-testid="library-skeleton">
      <div className="aspect-[3/4]" style={{ backgroundColor: '#1a1a1e' }} />
      <div className="p-3 space-y-2">
        <div className="h-3 w-2/3 rounded" style={{ backgroundColor: '#1f1f23' }} />
        <div className="h-2.5 w-1/2 rounded" style={{ backgroundColor: '#1a1a1e' }} />
        <div className="h-7 w-full rounded-lg mt-3" style={{ backgroundColor: '#1a1a1e' }} />
      </div>
    </div>
  )
}
