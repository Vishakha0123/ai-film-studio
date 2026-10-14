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
