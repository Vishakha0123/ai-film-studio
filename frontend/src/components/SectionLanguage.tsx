import { Elapsed } from '../lib/useElapsed'
import { useStudio } from '../studio'
import { FILM_LANGUAGES, languageName } from '../lib/languages'
import { useFilmEdit, type EditTarget } from '../lib/useFilmEdit'

/** The language this section is written in: the creator's pick for it, or else the film's language. */
export function sectionLanguage(project: { language?: string; memory?: { sectionLanguages?: Partial<Record<string, string>> } | null } | null | undefined, target: EditTarget): string {
  return project?.memory?.sectionLanguages?.[target] || project?.language || 'en'
}

/** What the AI is told when a section moves to another language. */
export function switchInstruction(target: EditTarget, what: string, code: string): string {
  const name = languageName(code)
  const native = FILM_LANGUAGES.find(l => l.code === code)?.native ?? name
  const script = code === 'en' ? 'in English' : `in ${name} (${native}), written in ${native} script`
  const extra: Partial<Record<EditTarget, string>> = {
    screenplay: ' Only INT., EXT., FADE IN: and CUT TO: may stay in English.',
    characters: ' Keep every character’s name and "language" field exactly as they are; rewrite the other details.',
    dialogue: ' Keep who says each line and its scene. A character who speaks their own language (their "language" field) keeps it.',
    shots: ' Keep each shot’s number, camera and duration.',
  }
  return `Rewrite the whole ${what} ${script}. Keep the same meaning, events, characters, structure and format.${extra[target] ?? ''}`
}

/**
 * "Language" picker at the top of a section: rewrites just this section in the chosen language.
 * The choice is remembered, so later AI edits of this section keep writing in it.
 */
export default function SectionLanguage({ target, what, also = [] }: { target: EditTarget; what: string; also?: { target: EditTarget; what: string }[] }) {
  const { project } = useStudio()
  const { working, error, ai } = useFilmEdit()
  const current = sectionLanguage(project, target)

  const change = async (code: string) => {
    if (!code || code === current) return
    const label = `Rewriting the ${what} in ${languageName(code)}…`
    for (const part of [{ target, what }, ...also]) {
      if (!(await ai(label, part.target, 'transform', switchInstruction(part.target, part.what, code), { language: code }))) return
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 flex-shrink-0" data-testid={`section-language-${target}`}>
      <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all hover:text-zinc-200" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a1a1aa' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5" aria-hidden>
          <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <select
          aria-label={`Language of the ${what}`}
          value={current}
          onChange={e => void change(e.target.value)}
          disabled={!!working}
          className="bg-transparent text-xs focus:outline-none cursor-pointer disabled:opacity-60"
          style={{ color: 'inherit' }}
        >
          {FILM_LANGUAGES.map(l => (
            <option key={l.code} value={l.code} style={{ backgroundColor: '#18181b' }}>
              {l.code === 'en' ? l.label : `${l.label} · ${l.native}`}
            </option>
          ))}
        </select>
      </label>
      {working && <p className="text-[11px]" style={{ color: '#d4a84b' }} role="status" data-testid={`section-language-working-${target}`}>{working} <Elapsed active className="ml-1 opacity-60" /></p>}
      {error && <p role="alert" className="text-[11px] text-red-300 max-w-[240px] text-right">{error}</p>}
    </div>
  )
}
