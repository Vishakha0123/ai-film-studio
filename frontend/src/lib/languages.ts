/** Languages a film can be written in (same list as the backend's app/services/languages.py). */
export const FILM_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
] as const

export function languageLabel(code: string | undefined): string {
  const l = FILM_LANGUAGES.find(x => x.code === (code || 'en'))
  return l ? (l.code === 'en' ? l.label : `${l.label} · ${l.native}`) : code || 'English'
}

export const languageName = (code: string | undefined) => FILM_LANGUAGES.find(x => x.code === (code || 'en'))?.label ?? code ?? 'English'

/** Unicode block of each film language's script (same as backend app/services/script_check.py). */
const SCRIPTS: Record<string, [number, number]> = {
  hi: [0x0900, 0x097f], mr: [0x0900, 0x097f], bn: [0x0980, 0x09ff], pa: [0x0a00, 0x0a7f], gu: [0x0a80, 0x0aff],
  ta: [0x0b80, 0x0bff], te: [0x0c00, 0x0c7f], kn: [0x0c80, 0x0cff], ml: [0x0d00, 0x0d7f],
}

const FORMAT_LINE = /^\s*(INT\.|EXT\.|INT\/EXT|EXT\/INT|I\/E|FADE |FADE$|FADE IN|FADE OUT|CUT TO|SMASH CUT|DISSOLVE|MATCH CUT|THE END)/i

/**
 * False when text meant to be in the film's language is mostly in another script — e.g. an English
 * screenplay in a Punjabi film. Screenplay format lines (INT., EXT., FADE IN:, CUT TO:) are ignored.
 */
export function isInFilmLanguage(text: string, language: string | undefined): boolean {
  const block = SCRIPTS[language || 'en']
  if (!block) return true
  const body = text.split('\n').filter(l => !FORMAT_LINE.test(l)).join('\n')
  const letters = [...body].filter(ch => /\p{L}/u.test(ch))
  if (letters.length < 30) return true
  const native = letters.filter(ch => { const c = ch.codePointAt(0)!; return c >= block[0] && c <= block[1] }).length
  return native / letters.length >= 0.5
}
