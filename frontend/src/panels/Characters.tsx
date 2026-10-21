import { useState } from 'react'
import DirectAI from '../components/DirectAI'
import { usePortraits } from '../lib/usePortraits'
import { characterPhoto, characterPhotoKind } from '../types'
import { NoPortrait, StockBadge } from '../components/CharacterPortrait'
import { useFilm, useStudio } from '../studio'
import type { Character } from '../types'
import { DEMO_MODE, addCharacter, assertCompleted, editProject, removeCharacter, updateCharacter, waitForJob, type CharacterInput } from '../api'

type Mode = { kind: 'view' } | { kind: 'add' } | { kind: 'edit'; field?: 'appearance' }

const FIELDS: { key: keyof CharacterInput; label: string; long?: boolean; placeholder: string; options?: [string, string][] }[] = [
  { key: 'name', label: 'Name', placeholder: 'e.g. Sundar' },
  { key: 'role', label: 'Role', placeholder: 'e.g. Temple tea boy and key-bearer' },
  { key: 'age', label: 'Age', placeholder: 'e.g. 12' },
  { key: 'gender', label: 'Girl / Boy', placeholder: '', options: [['', 'Not set (guess from the description)'], ['female', 'Girl / Woman'], ['male', 'Boy / Man']] },
  { key: 'personality', label: 'Personality', long: true, placeholder: 'Who are they? What do they want?' },
  { key: 'appearance', label: 'Appearance', long: true, placeholder: 'What do they look like? (used to draw the portrait)' },
  { key: 'arc', label: 'Character Arc', long: true, placeholder: 'How do they change through the film?' },
  { key: 'relationships', label: 'Relationships', long: true, placeholder: 'How are they connected to the others?' },
]

const inputCls = 'w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600'

export default function Characters() {
  const film = useFilm()
  const { project, setProject, refreshProject } = useStudio()
  const chars = film.characters
  const [selected, setSelected] = useState<string | null>(chars[0]?.id ?? null)
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const char = chars.find(c => c.id === selected) ?? chars[0]
  const photos = usePortraits()

  /** Runs a change against the backend; the panel shows what it's doing and any error. */
  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null)
    if (DEMO_MODE || !project) {
      setError('Changing characters needs the studio backend — the demo film can’t be edited.')
      return
    }
    setWorking(label)
    try {
      await fn()
      void photos.watch() // a new or changed character gets a fresh photo portrait in the background
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.')
    } finally {
      setWorking(null)
    }
  }

  const aiEdit = async (instruction: string, item?: string) => {
    assertCompleted(await waitForJob(await editProject(project!.id, 'transform', 'characters', instruction, item ? { item } : {})))
    return refreshProject()
  }

  const addByHand = (data: CharacterInput) => run('Adding the character…', async () => {
    const p = await addCharacter(project!.id, data)
    setProject(p)
    setSelected(p.memory?.characters.at(-1)?.id ?? null)
    setMode({ kind: 'view' })
  })

  const addWithAi = (data: CharacterInput) => run('The AI is writing the character…', async () => {
    const given = Object.entries(data).filter(([, v]) => v?.trim()).map(([k, v]) => `${k}: ${v}`).join('; ')
    const fresh = await aiEdit(
      `Add one new character: ${given || 'someone the story needs'}. Write all fields (name, age, role, personality, appearance, arc, relationships) so they fit the story, in the film's language. Keep every existing character exactly as it is, with the same ids.`,
    )
    setSelected(fresh?.memory?.characters.at(-1)?.id ?? null)
    setMode({ kind: 'view' })
  })

  const save = (c: Character, data: CharacterInput) => run('Saving…', async () => {
    setProject(await updateCharacter(project!.id, c.id, data))
    setMode({ kind: 'view' })
  })

  const regenerate = (c: Character) => run(`Rewriting ${c.name}…`, async () => {
    await aiEdit(
      `Rewrite this character (id "${c.id}", ${c.name}): give a fresh personality, appearance, arc and relationships that fit the story. Keep the name, role and id.`,
      c.id,
    )
  })

  const remove = (c: Character) => run(`Removing ${c.name}…`, async () => {
    const p = await removeCharacter(project!.id, c.id)
    setProject(p)
    setSelected(p.memory?.characters[0]?.id ?? null)
    setMode({ kind: 'view' })
  })

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-characters">
      <div className="max-w-3xl mx-auto animate-fade-up">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>AI Generated Characters</p>
          <h2 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            Cast of Characters
          </h2>
          <p className="text-sm text-zinc-500 mt-1">{chars.length} characters · {film.title}</p>
        </div>

        <div className="flex gap-3 sm:gap-4 flex-wrap mb-8">
          {chars.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelected(c.id); setMode({ kind: 'view' }); setError(null) }}
              aria-pressed={selected === c.id && mode.kind !== 'add'}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
              style={{
                borderColor: selected === c.id && mode.kind !== 'add' ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)',
                backgroundColor: selected === c.id && mode.kind !== 'add' ? 'rgba(212,168,75,0.07)' : 'rgba(255,255,255,0.02)',
              }}
            >
              {characterPhoto(c, 64, 64)
                ? <img src={characterPhoto(c, 64, 64)!} alt={c.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                : <NoPortrait size="chip" label={c.name} />}
              <div className="text-left">
                <p className="text-sm font-medium" style={{ color: selected === c.id ? '#f4f0ea' : '#a1a1aa' }}>{c.name}</p>
                <p className="text-xs" style={{ color: selected === c.id ? '#d4a84b' : '#52525b' }}>{c.role}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => { setMode({ kind: 'add' }); setError(null) }}
            aria-pressed={mode.kind === 'add'}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed transition-all text-sm"
            style={mode.kind === 'add' ? { borderColor: 'rgba(212,168,75,0.5)', color: '#d4a84b' } : { borderColor: '#27272a', color: '#52525b' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            Add Character
          </button>
        </div>

        {working && <p className="text-xs mb-4" style={{ color: '#d4a84b' }} data-testid="characters-working">{working}</p>}
        {photos.stage && (
          <p className="flex items-center gap-2 text-xs mb-4" style={{ color: '#d4a84b' }} data-testid="portraits-working">
            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
            Taking photo portraits — {photos.stage}…
          </p>
        )}
        {photos.error && <p role="alert" className="text-xs text-red-300 mb-4">{photos.error}</p>}
        {error && <p role="alert" className="text-xs text-red-300 mb-4">{error}</p>}

        {mode.kind === 'add' ? (
          <CharacterForm
            title="New character"
            hint="Fill in as much as you like. “Add character” saves exactly what you wrote; “Let AI write it” fills in the rest to fit the story."
            busy={!!working}
            onCancel={() => setMode({ kind: 'view' })}
            submit={{ label: 'Add character', run: addByHand, needsName: true }}
            secondary={{ label: '✨ Let AI write it', run: addWithAi }}
          />
        ) : char && mode.kind === 'edit' ? (
          <CharacterForm
            key={char.id + (mode.field ?? '')}
            title={mode.field === 'appearance' ? `Change ${char.name}'s appearance` : `Edit ${char.name}`}
            hint={mode.field === 'appearance' ? 'The portrait will be redrawn from this when you generate.' : undefined}
            initial={char}
            only={mode.field ? [mode.field] : undefined}
            busy={!!working}
            onCancel={() => setMode({ kind: 'view' })}
            submit={{ label: 'Save', run: data => save(char, data), needsName: !mode.field }}
            danger={mode.field ? undefined : { label: `Remove ${char.name}`, run: () => remove(char) }}
          />
        ) : (
          char && (
            <CharacterDetail
              char={char}
              busy={!!working}
              onEdit={() => setMode({ kind: 'edit' })}
              onRegenerate={() => regenerate(char)}
              onAppearance={() => setMode({ kind: 'edit', field: 'appearance' })}
              photo={{ busy: !!photos.stage, live: photos.live, take: () => void photos.newPhoto([char.id]) }}
            />
          )
        )}

        {char && mode.kind === 'view' && (
          <div className="mt-8">
            <DirectAI
              target="characters"
              appliesTo={`changes ${char.name} (pick another character above to change them)`}
              suggestions={[`Make ${char.name} older`, `Give ${char.name} a secret`, `Make ${char.name} funnier`, 'Change their look to traditional clothes']}
              placeholder={`Try "Make ${char.name} a police officer"`}
              scope={{ item: char.id }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function CharacterForm({ title, hint, initial, only, busy, onCancel, submit, secondary, danger }: {
  title: string
  hint?: string
  initial?: Character
  only?: (keyof CharacterInput)[]
  busy: boolean
  onCancel: () => void
  submit: { label: string; run: (d: CharacterInput) => void; needsName?: boolean }
  secondary?: { label: string; run: (d: CharacterInput) => void }
  danger?: { label: string; run: () => void }
}) {
  const fields = FIELDS.filter(f => !only || only.includes(f.key))
  const [data, setData] = useState<CharacterInput>(() => Object.fromEntries(fields.map(f => [f.key, initial?.[f.key] ?? ''])))
  const [confirmRemove, setConfirmRemove] = useState(false)
  const canSubmit = !busy && (!submit.needsName || !!data.name?.trim())

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (canSubmit) submit.run(data) }}
      className="rounded-xl p-5 sm:p-6 space-y-4 animate-fade-up"
      style={{ backgroundColor: '#111113', border: '1px solid rgba(212,168,75,0.2)' }}
      data-testid="character-form"
    >
      <div className="flex items-start gap-4">
        <div>
          <h3 className="text-base font-medium" style={{ color: '#f4f0ea' }}>{title}</h3>
          {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
          {(fields.some(f => f.key === 'age' || f.key === 'appearance')) && (
            <p className="text-[11px] text-zinc-600 mt-1">Age, Girl / Boy and Appearance shape the AI portrait.</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map(f => (
          <label key={f.key} className={f.long ? 'sm:col-span-2 block' : 'block'}>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-500">{f.label}</span>
            {f.options ? (
              <select value={data[f.key] ?? ''} onChange={e => setData(d => ({ ...d, [f.key]: e.target.value }))} className={`${inputCls} mt-1 cursor-pointer`} aria-label={f.label}>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : f.long ? (
              <textarea rows={3} value={data[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setData(d => ({ ...d, [f.key]: e.target.value }))} className={`${inputCls} mt-1 resize-y`} />
            ) : (
              <input value={data[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setData(d => ({ ...d, [f.key]: e.target.value }))} className={`${inputCls} mt-1`} />
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" disabled={!canSubmit} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
          {submit.label}
        </button>
        {secondary && (
          <button type="button" disabled={busy} onClick={() => secondary.run(data)} className="px-4 py-2 rounded-lg text-xs font-medium border disabled:opacity-40" style={{ borderColor: 'rgba(212,168,75,0.35)', color: '#d4a84b' }}>
            {secondary.label}
          </button>
        )}
        <button type="button" onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
        {danger && (
          <span className="ml-auto">
            {confirmRemove ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Sure?</span>
                <button type="button" onClick={danger.run} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}>Yes, remove</button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="text-xs text-zinc-500">Keep</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmRemove(true)} disabled={busy} className="text-xs text-zinc-500 hover:text-red-400">{danger.label}</button>
            )}
          </span>
        )}
      </div>
    </form>
  )
}

function CharacterDetail({ char, busy, onEdit, onRegenerate, onAppearance, photo }: {
  char: Character
  busy: boolean
  onEdit: () => void
  onRegenerate: () => void
  onAppearance: () => void
  photo: { busy: boolean; live: boolean | null; take: () => void }
}) {
  const actions = [
    { label: 'Edit', run: onEdit },
    { label: 'Regenerate', run: onRegenerate },
    { label: 'Change Appearance', run: onAppearance },
  ]
  const kind = characterPhotoKind(char)
  const isPhoto = kind === 'ai'
  const src = characterPhoto(char, 400, 533)
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up" key={char.id}>
      {/* Portrait */}
      <div className="md:col-span-1">
        <div className="aspect-[3/4] max-w-xs md:max-w-none mx-auto rounded-xl overflow-hidden relative" style={{ backgroundColor: '#111113' }}>
          {src ? <img src={src} alt={char.name} className="w-full h-full object-cover" /> : <NoPortrait size="large" label={char.name} />}
          {kind === 'stock' && <StockBadge />}
          {photo.busy && !isPhoto && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(9,9,11,0.45)' }} data-testid="photo-pending">
              <span className="px-3 py-1.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: 'rgba(9,9,11,0.8)', color: '#d4a84b' }}>Taking photo…</span>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(9,9,11,0.8) 0%, transparent 50%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-sm font-semibold" style={{ color: '#f4f0ea' }}>{char.name}</p>
            <p className="text-xs" style={{ color: '#d4a84b' }}>{char.role}{char.age ? ` · Age ${char.age}` : ''}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2" data-testid="photo-row">
          <button
            type="button"
            onClick={photo.take}
            disabled={busy || photo.busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ backgroundColor: 'rgba(212,168,75,0.12)', color: '#d4a84b', border: '1px solid rgba(212,168,75,0.3)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5"><path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" /></svg>
            {isPhoto ? 'New portrait' : 'Generate portrait'}
          </button>
          <span className="text-[11px] text-zinc-600 leading-tight" data-testid="photo-caption">
            {isPhoto ? 'AI-generated portrait'
              : kind === 'reference' ? 'Closest matching portrait for this age and gender'
              : photo.live === false ? 'No portrait yet — AI portraits need an image model (see Settings → Studio connection)'
              : kind === 'stock' ? 'Sample stock photo — make an AI portrait to replace it'
              : 'No portrait yet'}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {actions.map(a => (
            <button
              key={a.label}
              onClick={a.run}
              disabled={busy}
              className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80 hover:text-zinc-200 disabled:opacity-40"
              style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa', backgroundColor: 'transparent' }}
            >
              {a.label}
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
            <p className="text-sm leading-relaxed" style={{ color: row.value ? '#a1a1aa' : '#3f3f46' }}>{row.value || 'Not written yet'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
