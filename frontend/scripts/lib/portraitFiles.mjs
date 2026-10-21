/**
 * Shared helpers for the character portrait scripts: paths, settings, the manifest of generated portraits,
 * and checking that a file really is an image of the expected size.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const DATA_FILE = join(FRONTEND, 'src/data/characterLibrary.json')

export const outputDir = () => process.env.CHARACTER_OUTPUT_DIR || join(FRONTEND, 'src/assets/characters')
export const manifestPath = () => join(outputDir(), 'manifest.json')

export const loadLibrary = () => JSON.parse(readFileSync(DATA_FILE, 'utf8'))

/** Settings from the environment, then frontend/.env.local, then backend/.env (the key usually lives there). */
export function loadSettings() {
  const files = [join(FRONTEND, '.env.local'), join(FRONTEND, '..', 'backend', '.env')]
  const fromFiles = {}
  for (const f of files) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && !(m[1] in fromFiles)) fromFiles[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '')
    }
  }
  const get = k => process.env[k] ?? fromFiles[k] ?? ''
  return {
    provider: get('CHARACTER_IMAGE_PROVIDER') || 'openai',
    openaiKey: get('OPENAI_API_KEY'),
    openaiBase: (get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, ''),
    openaiModel: get('CHARACTER_IMAGE_MODEL') || get('OPENAI_IMAGE_MODEL') || 'gpt-image-1',
    quality: get('CHARACTER_IMAGE_QUALITY') || 'high',
    negativePrompt: get('CHARACTER_NEGATIVE_PROMPT'),
  }
}

export function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath(), 'utf8'))
  } catch {
    return {}
  }
}

export function writeManifest(manifest) {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  const tmp = `${manifestPath()}.tmp`
  writeFileSync(tmp, `${JSON.stringify(sorted, null, 2)}\n`)
  renameSync(tmp, manifestPath())
}

export const sha256 = buf => createHash('sha256').update(buf).digest('hex')

/** Width/height of a WebP (VP8, VP8L or VP8X), or null if the bytes aren't a WebP image. */
export function webpSize(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null
    const bits = buf.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  return null
}

/**
 * Is this file a real portrait we can use? A WebP of the expected size, listed in the manifest with the same
 * checksum (so we know it came from the generator), and not identical to another character's file.
 */
export function verifyPortrait(character, { dir = outputDir(), manifest = readManifest(), spec } = {}) {
  const path = join(dir, character.image.file)
  if (!existsSync(path)) return { status: 'missing' }
  const buf = readFileSync(path)
  const size = webpSize(buf)
  if (!size) return { status: 'invalid', reason: 'not a WebP image' }
  const want = spec ?? character.image
  if (size.width !== want.width || size.height !== want.height) {
    return { status: 'invalid', reason: `${size.width}×${size.height}, expected ${want.width}×${want.height}` }
  }
  const entry = manifest[character.id]
  const hash = sha256(buf)
  if (!entry || entry.file !== character.image.file || entry.sha256 !== hash) {
    return { status: 'unverified', reason: 'not recorded by characters:generate (no matching manifest entry)' }
  }
  const twin = Object.entries(manifest).find(([id, e]) => id !== character.id && e.sha256 === hash)
  if (twin) return { status: 'invalid', reason: `identical to ${twin[0]}'s portrait` }
  return { status: 'verified', entry }
}

export const imageFilesIn = dir => (existsSync(dir) ? readdirSync(dir).filter(f => /\.(webp|jpe?g|png|avif)$/i.test(f)) : [])
