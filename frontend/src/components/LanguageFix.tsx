import { useStudio } from '../studio'
import { isInFilmLanguage, languageName, FILM_LANGUAGES } from '../lib/languages'
import { useFilmEdit, type EditTarget } from '../lib/useFilmEdit'

/**
 * Shown when a section came back in the wrong language (e.g. an English screenplay in a Punjabi film):
 * one click rewrites it in the film's language.
 */
export default function LanguageFix({ target, text, what }: { target: EditTarget; text: string; what: string }) {
  const { project } = useStudio()
  const { working, error, ai } = useFilmEdit()
  const lang = project?.language
  if (!lang || isInFilmLanguage(text, lang)) return null
  const name = languageName(lang)
  const native = FILM_LANGUAGES.find(l => l.code === lang)?.native ?? name

  const fix = () => ai(`Rewriting the ${what} in ${name}…`, target, 'transform',
    `Translate the whole ${what} into ${name} (${native}), written in ${native} script. Keep the same events, characters, structure and format`
    + (target === 'screenplay' ? ' — only INT., EXT., FADE IN: and CUT TO: may stay in English.' : '.'))

  return (
    <div className="mb-4 px-4 py-3 rounded-xl flex flex-wrap items-center gap-3" style={{ backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)' }} data-testid={`language-fix-${target}`} role="status">
      <p className="text-xs flex-1 min-w-[200px]" style={{ color: '#fcd34d' }}>
        This {what} came out in English, but your film is in {name}.
      </p>
      <button type="button" onClick={() => void fix()} disabled={!!working} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
        {working ? `Rewriting in ${name}…` : `Rewrite in ${name}`}
      </button>
      {error && <p role="alert" className="w-full text-xs text-red-300">{error}</p>}
    </div>
  )
}
