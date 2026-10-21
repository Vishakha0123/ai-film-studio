/**
 * Where the character library comes from. Today: the local data file plus the portrait files that exist in
 * src/assets/characters/. Later: swap `loadCharacters` for an API call (and the image map for URLs from the
 * image-generation service) — the gallery only uses `listCharacters`.
 */
import data from '../data/characterLibrary.json'
import {
  ageGroupOf, filterCharacters, isLibraryCharacter,
  type LibraryCharacter, type LibraryEntry, type LibraryFilter,
} from '../lib/characterLibrary'

/** Portrait files that are actually in the repo (filename → URL). Missing files simply aren't here. */
const PORTRAIT_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/characters/*.{webp,jpg,jpeg,png,avif}', { eager: true, query: '?url', import: 'default' }))
    .map(([path, url]) => [path.split('/').pop()!, url as string]),
)

/** What `npm run characters:generate` recorded for each portrait it made (absent until something is generated). */
type ManifestEntry = { file: string; model: string; generatedAt: string }
const MANIFEST: Record<string, ManifestEntry> = (Object.values(
  import.meta.glob('../assets/characters/manifest.json', { eager: true, import: 'default' }),
)[0] as Record<string, ManifestEntry> | undefined) ?? {}

export const PORTRAIT_FOLDER = 'frontend/src/assets/characters'

/** Pairs each character with its own portrait file — or says plainly that the file isn't there yet. */
export function toEntry(c: LibraryCharacter, files: Record<string, string> = PORTRAIT_FILES,
  manifest: Record<string, ManifestEntry> = MANIFEST): LibraryEntry {
  const src = files[c.image.file]
  const made = manifest[c.id]
  return {
    ...c,
    ageGroup: ageGroupOf(c.age),
    portrait: src
      ? { status: 'ready', src, generated: made?.file === c.image.file ? { model: made.model, generatedAt: made.generatedAt } : null }
      : { status: 'missing', expectedPath: `${PORTRAIT_FOLDER}/${c.image.file}` },
  }
}

async function loadCharacters(): Promise<LibraryCharacter[]> {
  return (data.characters as unknown[]).filter(isLibraryCharacter)
}

/** The library, filtered by the creator's choices (async, like the API it will become). */
export async function listCharacters(filter: LibraryFilter): Promise<LibraryEntry[]> {
  return filterCharacters((await loadCharacters()).map(c => toEntry(c)), filter)
}

/** Every character (for counts and the "added portraits" summary). */
export async function allCharacters(): Promise<LibraryEntry[]> {
  return (await loadCharacters()).map(c => toEntry(c))
}

export async function getCharacter(id: string): Promise<LibraryEntry | null> {
  return (await allCharacters()).find(c => c.id === id) ?? null
}
