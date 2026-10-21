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

export const PORTRAIT_FOLDER = 'frontend/src/assets/characters'

/** Pairs each character with its own portrait file — or says plainly that the file isn't there yet. */
export function toEntry(c: LibraryCharacter, files: Record<string, string> = PORTRAIT_FILES): LibraryEntry {
  const src = files[c.image.file]
  return {
    ...c,
    ageGroup: ageGroupOf(c.age),
    portrait: src ? { status: 'ready', src } : { status: 'missing', expectedPath: `${PORTRAIT_FOLDER}/${c.image.file}` },
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
