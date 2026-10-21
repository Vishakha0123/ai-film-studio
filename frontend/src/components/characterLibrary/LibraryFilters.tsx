import {
  AGE_GROUPS, ETHNICITY_LABEL, GENDER_LABEL, HAIR_LABEL, MAX_AGE, MIN_AGE, SKIN_TONES, ageGroupLabel,
  type Ethnicity, type HairStyle, type LibraryFilter, type SkinTone,
} from '../../lib/characterLibrary'

const chip = (on: boolean) => on
  ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.45)', color: '#d4a84b' }
  : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

/** Age, gender and appearance choices for the library. Pure UI: reads and returns a LibraryFilter. */
export default function LibraryFilters({ filter, onChange }: { filter: LibraryFilter; onChange: (f: LibraryFilter) => void }) {
  const set = (patch: Partial<LibraryFilter>) => onChange({ ...filter, ...patch })
  const clampAge = (v: string, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) && v !== '' ? Math.max(MIN_AGE, Math.min(MAX_AGE, Math.round(n))) : fallback
  }

  return (
    <div className="space-y-5" data-testid="library-filters">
      <fieldset>
        <legend className="text-xs text-zinc-500 mb-2">Age</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Age group">
          {AGE_GROUPS.map(g => (
            <button key={g.id} type="button" aria-pressed={filter.ageGroups.includes(g.id)} onClick={() => set({ ageGroups: toggle(filter.ageGroups, g.id) })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all" style={chip(filter.ageGroups.includes(g.id))}>
              {ageGroupLabel(g)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
          <label className="flex items-center gap-2">Exact age from
            <input type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} value={filter.minAge} aria-label="Minimum age"
              onChange={e => set({ minAge: clampAge(e.target.value, MIN_AGE) })}
              className="w-16 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-zinc-600" />
          </label>
          <label className="flex items-center gap-2">to
            <input type="number" inputMode="numeric" min={MIN_AGE} max={MAX_AGE} value={filter.maxAge} aria-label="Maximum age"
              onChange={e => set({ maxAge: clampAge(e.target.value, MAX_AGE) })}
              className="w-16 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-zinc-600" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs text-zinc-500 mb-2">Gender</legend>
        <div className="inline-flex p-1 rounded-lg" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }} role="radiogroup" aria-label="Gender">
          {([['any', 'Everyone'], ['female', GENDER_LABEL.female.group], ['male', GENDER_LABEL.male.group]] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={filter.gender === v} onClick={() => set({ gender: v })}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={filter.gender === v ? { backgroundColor: 'rgba(255,255,255,0.08)', color: '#f4f0ea' } : { color: '#71717a' }}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <details className="group">
        <summary className="text-xs text-zinc-500 cursor-pointer select-none hover:text-zinc-300">Appearance — skin tone, background, hair</summary>
        <div className="space-y-4 mt-3">
          <div>
            <p className="text-[11px] text-zinc-600 mb-2">Skin tone</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Skin tone">
              {SKIN_TONES.map(t => (
                <button key={t.id} type="button" aria-pressed={filter.skinTones.includes(t.id)} onClick={() => set({ skinTones: toggle<SkinTone>(filter.skinTones, t.id) })}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all" style={chip(filter.skinTones.includes(t.id))}>
                  <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ backgroundColor: t.swatch }} aria-hidden />{t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-zinc-600 mb-2">Background</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Background">
              {(Object.keys(ETHNICITY_LABEL) as Ethnicity[]).map(e => (
                <button key={e} type="button" aria-pressed={filter.ethnicities.includes(e)} onClick={() => set({ ethnicities: toggle<Ethnicity>(filter.ethnicities, e) })}
                  className="px-3 py-1.5 rounded-lg text-xs border transition-all" style={chip(filter.ethnicities.includes(e))}>
                  {ETHNICITY_LABEL[e]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-zinc-600 mb-2">Hair</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Hair">
              {(Object.keys(HAIR_LABEL) as HairStyle[]).map(h => (
                <button key={h} type="button" aria-pressed={filter.hairStyles.includes(h)} onClick={() => set({ hairStyles: toggle<HairStyle>(filter.hairStyles, h) })}
                  className="px-3 py-1.5 rounded-lg text-xs border transition-all" style={chip(filter.hairStyles.includes(h))}>
                  {HAIR_LABEL[h]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}
