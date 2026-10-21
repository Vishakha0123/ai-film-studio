import { useEffect, useRef, useState } from 'react'
import { allCharacters, listCharacters, PORTRAIT_FOLDER } from '../../services/characterLibrary'
import { EMPTY_FILTER, isFiltered, personLabel, type LibraryEntry, type LibraryFilter } from '../../lib/characterLibrary'
import LibraryFilters from './LibraryFilters'
import CharacterCard, { CharacterCardSkeleton } from './CharacterCard'

const SELECTED_KEY = 'cineai.libraryCharacter'

/** As many columns as fit (2 on a phone, 3–5 on wider screens, fewer when the chat is docked beside it). */
const GRID: React.CSSProperties = { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))' }

function readSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

function writeSelected(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id)
    else localStorage.removeItem(SELECTED_KEY)
  } catch {
    /* storage unavailable — the choice lasts for this visit only */
  }
}

/**
 * Character library: pick an age group, gender and appearance; the gallery shows the matching people.
 * Data comes from services/characterLibrary (local today, an API later).
 */
export default function CharacterLibrary({ onSelect }: { onSelect?: (c: LibraryEntry | null) => void }) {
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER)
  const [onlyWithPortraits, setOnlyWithPortraits] = useState(false)
  const [results, setResults] = useState<LibraryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [totals, setTotals] = useState<{ all: number; withPortrait: number } | null>(null)
  const [selected, setSelected] = useState<LibraryEntry | null>(null)
  const request = useRef(0)

  // Totals and the remembered selection, once
  useEffect(() => {
    void allCharacters().then(all => {
      setTotals({ all: all.length, withPortrait: all.filter(c => c.portrait.status === 'ready').length })
      const id = readSelected()
      const remembered = id ? all.find(c => c.id === id) ?? null : null
      if (remembered) setSelected(remembered)
    })
  }, [])

  // The gallery follows the filters
  useEffect(() => {
    const mine = ++request.current
    setResults(null)
    setError(null)
    listCharacters(filter)
      .then(list => {
        if (mine === request.current) setResults(onlyWithPortraits ? list.filter(c => c.portrait.status === 'ready') : list)
      })
      .catch(e => { if (mine === request.current) setError(e instanceof Error ? e.message : 'Could not load the characters.') })
  }, [filter, onlyWithPortraits])

  const choose = (c: LibraryEntry) => {
    const next = selected?.id === c.id ? null : c
    setSelected(next)
    writeSelected(next?.id ?? null)
    onSelect?.(next)
  }

  const clear = () => {
    setFilter(EMPTY_FILTER)
    setOnlyWithPortraits(false)
  }

  return (
    <div className="space-y-6" data-testid="character-library">
      {totals && totals.withPortrait < totals.all && (
        <div className="px-4 py-3 rounded-xl text-xs leading-relaxed" style={{ backgroundColor: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', color: '#d6c08a' }} data-testid="portrait-status">
          <b>{totals.withPortrait} of {totals.all}</b> portraits added. Each character has its own portrait file and a ready-made prompt —
          generate the missing ones and save them in <code className="text-zinc-300">{PORTRAIT_FOLDER}/</code> with the character's file name
          (run <code className="text-zinc-300">npm run characters:check</code> for the list). They appear here automatically.
        </div>
      )}

      <div className="px-4 sm:px-5 py-5 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
        <LibraryFilters filter={filter} onChange={setFilter} />
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
            <input type="checkbox" checked={onlyWithPortraits} onChange={e => setOnlyWithPortraits(e.target.checked)} className="accent-[#d4a84b]" />
            Only characters with a portrait
          </label>
          <div className="flex items-center gap-3">
            <p className="text-xs text-zinc-500" role="status" data-testid="library-count">
              {results === null ? 'Loading…' : `${results.length} ${results.length === 1 ? 'character' : 'characters'}`}
            </p>
            {(isFiltered(filter) || onlyWithPortraits) && (
              <button type="button" onClick={clear} className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2">Clear filters</button>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(24,20,12,0.95)', border: '1px solid rgba(212,168,75,0.4)', backdropFilter: 'blur(6px)' }} data-testid="selected-character">
          {selected.portrait.status === 'ready'
            ? <img src={selected.portrait.src} alt="" className="w-10 h-12 rounded-md object-cover" />
            : <span className="w-10 h-12 rounded-md border border-dashed flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.15)' }} aria-hidden />}
          <div className="flex-1 min-w-0">
            <p className="text-xs" style={{ color: '#d4a84b' }}>Selected character</p>
            <p className="text-sm text-zinc-200 truncate"><code className="text-zinc-400">{selected.id}</code> · {personLabel(selected)}, age {selected.age} · {selected.heritage}</p>
          </div>
          <button type="button" onClick={() => choose(selected)} className="text-xs text-zinc-400 hover:text-zinc-200">Clear selection</button>
        </div>
      )}

      {error ? (
        <div role="alert" className="px-4 py-6 rounded-xl text-center text-sm text-red-300" style={{ border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>
      ) : results === null ? (
        <div className="grid gap-3 sm:gap-4" style={GRID} aria-busy="true" aria-label="Loading characters">
          {Array.from({ length: 8 }, (_, i) => <CharacterCardSkeleton key={i} />)}
        </div>
      ) : results.length === 0 ? (
        <div className="px-6 py-12 rounded-xl text-center" style={{ border: '1px dashed rgba(255,255,255,0.1)' }} data-testid="library-empty">
          <p className="text-sm text-zinc-300 mb-1">No characters match these choices</p>
          <p className="text-xs text-zinc-600 mb-4">Try another age group, widen the age range, or remove an appearance filter.</p>
          <button type="button" onClick={clear} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>Clear filters</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4" style={GRID} data-testid="library-grid">
          {results.map(c => <CharacterCard key={c.id} character={c} selected={selected?.id === c.id} onSelect={choose} />)}
        </div>
      )}
    </div>
  )
}
