/**
 * Character library: types, age groups and filtering. No UI here — the gallery reads through
 * `services/characterLibrary.ts`, so a backend or image-generation API can replace the local data later.
 *
 * Filtering always uses each character's metadata (their recorded age, gender, skin tone…), never the
 * image filename.
 */

export type Gender = 'female' | 'male'
export type AgeGroupId = 'child' | 'teen' | 'youngAdult' | 'adult' | 'senior'
export type Ethnicity = 'south-asian' | 'east-asian' | 'southeast-asian' | 'black' | 'white' | 'latino' | 'middle-eastern' | 'indigenous'
export type SkinTone = 'light' | 'medium-light' | 'medium' | 'tan' | 'brown' | 'dark'
export type HairStyle = 'short' | 'long' | 'curly' | 'braided' | 'tied' | 'bald' | 'covered'

export interface LibraryCharacter {
  /** Stable id, e.g. "CHR-0007" */
  id: string
  /** Optional story name (e.g. "Paati"), role and personality — kept in the portrait prompt */
  name?: string
  role?: string
  personality?: string
  /** Exact age in years — the age filter uses this */
  age: number
  gender: Gender
  ethnicity: Ethnicity
  /** More specific background, e.g. "Tamil", "Nigerian" */
  heritage: string
  skinTone: SkinTone
  hair: { style: HairStyle; color: string }
  eyeColor: string
  features: string[]
  wardrobe: string
  /** One-line description shown on the card */
  appearance: string
  /** This character's own portrait file (in src/assets/characters/) */
  image: { file: string; width: number; height: number }
  /** Prompt the portrait was (or should be) generated from */
  prompt: string
}

/**
 * A character plus where its portrait is: `src` is set only when its own image file really exists.
 * `generated` says whether the file was recorded by the generator (model + time) — files added by hand aren't.
 */
export interface LibraryEntry extends LibraryCharacter {
  ageGroup: AgeGroupId
  portrait:
    | { status: 'ready'; src: string; generated: { model: string; generatedAt: string } | null }
    | { status: 'missing'; expectedPath: string }
}

export interface AgeGroup {
  id: AgeGroupId
  label: string
  /** Inclusive range in years; seniors are open-ended */
  min: number
  max: number | null
}

export const AGE_GROUPS: AgeGroup[] = [
  { id: 'child', label: 'Children', min: 3, max: 12 },
  { id: 'teen', label: 'Teenagers', min: 13, max: 17 },
  { id: 'youngAdult', label: 'Young adults', min: 18, max: 29 },
  { id: 'adult', label: 'Adults', min: 30, max: 59 },
  { id: 'senior', label: 'Seniors', min: 60, max: null },
]

export const MIN_AGE = 3
export const MAX_AGE = 100

export const ageGroupLabel = (g: AgeGroup) => `${g.label} · ${g.min}${g.max === null ? '+' : `–${g.max}`}`

/** The age group a character belongs to, from their actual age. */
export function ageGroupOf(age: number): AgeGroupId {
  const g = AGE_GROUPS.find(x => age >= x.min && (x.max === null || age <= x.max))
  if (g) return g.id
  return age < MIN_AGE ? 'child' : 'senior'
}

export const GENDER_LABEL: Record<Gender, { group: string; child: string; adult: string }> = {
  female: { group: 'Girls & women', child: 'Girl', adult: 'Woman' },
  male: { group: 'Boys & men', child: 'Boy', adult: 'Man' },
}

/** "Girl", "Teenage boy", "Woman"… for a card. */
export function personLabel(c: Pick<LibraryCharacter, 'age' | 'gender'>): string {
  const g = ageGroupOf(c.age)
  const l = GENDER_LABEL[c.gender]
  if (g === 'child') return l.child
  if (g === 'teen') return `Teenage ${l.child.toLowerCase()}`
  if (g === 'senior') return `Senior ${l.adult.toLowerCase()}`
  return g === 'youngAdult' ? `Young ${l.adult.toLowerCase()}` : l.adult
}

export const ETHNICITY_LABEL: Record<Ethnicity, string> = {
  'south-asian': 'South Asian',
  'east-asian': 'East Asian',
  'southeast-asian': 'Southeast Asian',
  black: 'Black / African',
  white: 'White / European',
  latino: 'Latino',
  'middle-eastern': 'Middle Eastern',
  indigenous: 'Indigenous',
}

export const SKIN_TONES: { id: SkinTone; label: string; swatch: string }[] = [
  { id: 'light', label: 'Light', swatch: '#f3d6be' },
  { id: 'medium-light', label: 'Medium light', swatch: '#e2b996' },
  { id: 'medium', label: 'Medium', swatch: '#c99872' },
  { id: 'tan', label: 'Tan', swatch: '#b07c54' },
  { id: 'brown', label: 'Brown', swatch: '#8a5a3b' },
  { id: 'dark', label: 'Dark', swatch: '#5c3a26' },
]

export const HAIR_LABEL: Record<HairStyle, string> = {
  short: 'Short', long: 'Long', curly: 'Curly / coily', braided: 'Braided', tied: 'Tied up', bald: 'Bald / shaved', covered: 'Covered (hijab, turban, scarf)',
}

export interface LibraryFilter {
  /** Age groups to include (empty = all) */
  ageGroups: AgeGroupId[]
  /** Exact age range, inclusive */
  minAge: number
  maxAge: number
  gender: Gender | 'any'
  ethnicities: Ethnicity[]
  skinTones: SkinTone[]
  hairStyles: HairStyle[]
}

export const EMPTY_FILTER: LibraryFilter = {
  ageGroups: [], minAge: MIN_AGE, maxAge: MAX_AGE, gender: 'any', ethnicities: [], skinTones: [], hairStyles: [],
}

export const isFiltered = (f: LibraryFilter) =>
  f.ageGroups.length > 0 || f.minAge !== MIN_AGE || f.maxAge !== MAX_AGE || f.gender !== 'any'
  || f.ethnicities.length > 0 || f.skinTones.length > 0 || f.hairStyles.length > 0

/** Does this character match? Uses only metadata: age (number), gender, ethnicity, skin tone, hair. */
export function matches(c: LibraryCharacter, f: LibraryFilter): boolean {
  if (f.ageGroups.length && !f.ageGroups.includes(ageGroupOf(c.age))) return false
  if (c.age < f.minAge || c.age > f.maxAge) return false
  if (f.gender !== 'any' && c.gender !== f.gender) return false
  if (f.ethnicities.length && !f.ethnicities.includes(c.ethnicity)) return false
  if (f.skinTones.length && !f.skinTones.includes(c.skinTone)) return false
  if (f.hairStyles.length && !f.hairStyles.includes(c.hair.style)) return false
  return true
}

/** Matching characters, youngest first. */
export function filterCharacters<T extends LibraryCharacter>(list: T[], f: LibraryFilter): T[] {
  return list.filter(c => matches(c, f)).sort((a, b) => a.age - b.age || a.id.localeCompare(b.id))
}

/** Checks a record from the data file (or, later, an API) before the app uses it. */
export function isLibraryCharacter(x: unknown): x is LibraryCharacter {
  const c = x as LibraryCharacter
  return !!c && typeof c.id === 'string' && Number.isFinite(c.age) && c.age >= 0
    && (c.gender === 'female' || c.gender === 'male')
    && typeof c.image?.file === 'string' && c.image.file.length > 0
    && typeof c.appearance === 'string'
}
