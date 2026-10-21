#!/usr/bin/env node
/**
 * Generate photorealistic portraits for the character library with a real image model.
 *
 *   npm run characters:generate                       → every character without a verified portrait
 *   npm run characters:generate -- --only=CHR-0045    → just these ids (comma-separated)
 *   npm run characters:generate -- --force --only=…   → make a new portrait even if one exists
 *   npm run characters:generate -- --limit=3          → at most 3 this run
 *   npm run characters:generate -- --dry-run          → print the prompts that would be sent; nothing is called or written
 *
 * Needs an image API (see src/assets/characters/README.md). Without one it stops and says what to set —
 * it never writes placeholder or stand-in files. Each image is checked (real WebP, 1024×1536, not identical to
 * another character's) before it's saved as <ID>.webp and recorded in manifest.json.
 */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadLibrary, loadSettings, outputDir, readManifest, sha256, verifyPortrait, webpSize, writeManifest } from './lib/portraitFiles.mjs'

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v ?? true]
}))
const library = loadLibrary()
const settings = loadSettings()
const negative = settings.negativePrompt || library.negativePrompt
const spec = library.imageSpec
const only = typeof args.only === 'string' ? new Set(args.only.split(',').map(s => s.trim())) : null
const limit = args.limit ? Number(args.limit) : Infinity

/** The full text sent to the model: the character's prompt plus what it must not look like. */
export const fullPrompt = c => `${c.prompt}\n\nAvoid: ${negative}.`

/* ---------- Providers: add another image API here (same input, returns WebP bytes) ---------- */
const PROVIDERS = {
  async openai({ prompt }) {
    if (!settings.openaiKey) throw new SetupError()
    const body = { model: settings.openaiModel, prompt, n: 1, size: `${spec.width}x${spec.height}`, quality: settings.quality, output_format: 'webp' }
    for (let attempt = 1; ; attempt++) {
      const r = await fetch(`${settings.openaiBase}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (r.ok) {
        const item = (await r.json()).data?.[0]
        if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
        if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer())
        throw new Error('the API answered without an image')
      }
      const text = (await r.text()).slice(0, 300)
      if ((r.status === 429 || r.status >= 500) && attempt < 4) {
        await new Promise(res => setTimeout(res, 2000 * attempt))
        continue
      }
      throw new Error(`OpenAI images ${r.status}: ${text}`)
    }
  },
}

class SetupError extends Error {}

function setupHelp() {
  return `No image model is configured, so no portraits were generated (and no files were written).

To generate real portraits, add to backend/.env (or frontend/.env.local):
  OPENAI_API_KEY=sk-...                 your OpenAI API key (platform.openai.com → API keys)
  CHARACTER_IMAGE_MODEL=gpt-image-1     optional; a GPT Image model that can return WebP
  CHARACTER_IMAGE_QUALITY=high          optional; low | medium | high (higher costs more)
  CHARACTER_NEGATIVE_PROMPT=...         optional; replaces the default list in characterLibrary.json
Then run:  npm run characters:generate -- --only=CHR-0045   (one portrait first, to check the look)`
}

const manifest = readManifest()
const todo = library.characters
  .filter(c => !only || only.has(c.id))
  .filter(c => args.force || verifyPortrait(c, { manifest, spec }).status !== 'verified')
  .slice(0, limit)

if (args['dry-run']) {
  console.log(`Dry run — ${todo.length} portrait(s) would be generated with ${settings.provider} (${settings.openaiModel}, ${spec.width}×${spec.height} WebP). Nothing is sent or written.\n`)
  for (const c of todo) console.log(`── ${c.id} → ${c.image.file}  (${c.age}, ${c.gender}, ${c.heritage})\n${fullPrompt(c)}\n`)
  process.exit(0)
}

const provider = PROVIDERS[settings.provider]
if (!provider) {
  console.error(`Unknown CHARACTER_IMAGE_PROVIDER "${settings.provider}". Available: ${Object.keys(PROVIDERS).join(', ')}`)
  process.exit(2)
}
if (!todo.length) {
  console.log('Every selected character already has a verified portrait. Use --force to make new ones.')
  process.exit(0)
}

mkdirSync(outputDir(), { recursive: true })
const done = [], failed = []
for (const c of todo) {
  process.stdout.write(`${c.id} (${c.age}, ${c.gender}, ${c.heritage}) … `)
  try {
    const bytes = await provider({ prompt: fullPrompt(c), negativePrompt: negative, width: spec.width, height: spec.height, character: c })
    const size = webpSize(bytes)
    if (!size) throw new Error('the model did not return a WebP image')
    if (size.width !== spec.width || size.height !== spec.height) throw new Error(`got ${size.width}×${size.height}, expected ${spec.width}×${spec.height}`)
    const hash = sha256(bytes)
    const twin = Object.entries(manifest).find(([id, e]) => id !== c.id && e.sha256 === hash)
    if (twin) throw new Error(`identical to ${twin[0]}'s portrait — not saved`)
    const path = join(outputDir(), c.image.file)
    writeFileSync(`${path}.tmp`, bytes)
    renameSync(`${path}.tmp`, path)
    manifest[c.id] = {
      file: c.image.file, provider: settings.provider, model: settings.openaiModel, width: size.width, height: size.height,
      bytes: bytes.length, sha256: hash, promptSha256: sha256(Buffer.from(fullPrompt(c))), generatedAt: new Date().toISOString(),
    }
    writeManifest(manifest)
    done.push(c.id)
    console.log(`saved ${c.image.file} (${Math.round(bytes.length / 1024)} KB)`)
  } catch (e) {
    if (e instanceof SetupError) {
      console.log('stopped')
      console.error(`\n${setupHelp()}`)
      process.exit(2)
    }
    failed.push(c.id)
    console.log(`FAILED — ${e.message}`)
  }
}
console.log(`\nGenerated and verified: ${done.length}${done.length ? ` (${done.join(', ')})` : ''}`)
if (failed.length) console.log(`Failed: ${failed.length} (${failed.join(', ')}) — run again to retry`)
process.exit(failed.length ? 1 : 0)
