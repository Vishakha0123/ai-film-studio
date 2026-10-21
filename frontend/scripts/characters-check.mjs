#!/usr/bin/env node
/**
 * Character library check — what's really there.
 *   npm run characters:check                  → validates the data; per character: verified / unverified / invalid / missing
 *   npm run characters:check -- --prompts     → also prints the full prompt (with the negative prompt) for each one still to generate
 *   npm run characters:check -- --readme      → rewrites src/assets/characters/README.md
 * Exits 1 if the data is invalid. Portraits that are missing are reported, not failed.
 *
 * "Verified" = a WebP of the expected size, recorded in manifest.json by `characters:generate` with the same
 * checksum, and not identical to another character's file. Anything else is not counted as a real portrait.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { imageFilesIn, loadLibrary, loadSettings, outputDir, readManifest, verifyPortrait } from './lib/portraitFiles.mjs'

const data = loadLibrary()
const args = new Set(process.argv.slice(2))
const manifest = readManifest()
const negative = loadSettings().negativePrompt || data.negativePrompt

const GROUPS = [['Children', 3, 12], ['Teenagers', 13, 17], ['Young adults', 18, 29], ['Adults', 30, 59], ['Seniors', 60, Infinity]]
const groupOf = age => GROUPS.find(([, min, max]) => age >= min && age <= max)?.[0] ?? 'Out of range'

const problems = []
const ids = new Set(), files = new Set()
for (const c of data.characters) {
  if (!/^CHR-\d{4}$/.test(c.id)) problems.push(`${c.id}: id should look like CHR-0001`)
  if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`)
  ids.add(c.id)
  if (!Number.isInteger(c.age) || c.age < 3 || c.age > 120) problems.push(`${c.id}: age ${c.age} is outside 3–120`)
  if (!['female', 'male'].includes(c.gender)) problems.push(`${c.id}: gender must be "female" or "male"`)
  if (c.image?.file !== `${c.id}.webp`) problems.push(`${c.id}: image file should be ${c.id}.webp`)
  if (files.has(c.image?.file)) problems.push(`${c.id}: image file shared with another character`)
  files.add(c.image?.file)
  if (!c.prompt?.startsWith(`Photorealistic close-up portrait photograph of a ${c.age}-year-old`)) problems.push(`${c.id}: prompt must start with the photorealistic portrait line and the exact age ${c.age}`)
  if (/cartoon|illustrat|anime|avatar/i.test(c.prompt ?? '')) problems.push(`${c.id}: style words like cartoon/illustration belong in the negative prompt, not the prompt`)
}
if (!negative) problems.push('negativePrompt is empty')

const results = data.characters.map(c => ({ c, r: verifyPortrait(c, { manifest, spec: data.imageSpec }) }))
const by = s => results.filter(x => x.r.status === s)

console.log(`Character library: ${data.characters.length} characters`)
for (const [name] of GROUPS) {
  const inGroup = data.characters.filter(c => groupOf(c.age) === name)
  const f = inGroup.filter(c => c.gender === 'female').length
  console.log(`  ${name.padEnd(13)} ${String(inGroup.length).padStart(2)}  (${f} girls/women, ${inGroup.length - f} boys/men)`)
}
console.log(`\nPortraits in ${outputDir()}:`)
console.log(`  generated and verified: ${by('verified').length}`)
for (const { c, r } of by('verified')) console.log(`    ✓ ${c.image.file}  ${r.entry.model}, ${r.entry.generatedAt}`)
console.log(`  present but unverified: ${by('unverified').length}`)
for (const { c, r } of by('unverified')) console.log(`    ? ${c.image.file}  ${r.reason}`)
console.log(`  invalid:                ${by('invalid').length}`)
for (const { c, r } of by('invalid')) console.log(`    ✗ ${c.image.file}  ${r.reason}`)
console.log(`  still to generate:      ${by('missing').length}`)
for (const { c } of by('missing')) {
  console.log(`    – ${c.image.file}  ${c.age}, ${c.gender}, ${c.heritage}${c.name ? ` (${c.name})` : ''}`)
  if (args.has('--prompts')) console.log(`      ${c.prompt}\n      Avoid: ${negative}.\n`)
}
const extra = imageFilesIn(outputDir()).filter(f => !files.has(f))
if (extra.length) console.log(`\nFiles no character uses: ${extra.join(', ')}`)

if (args.has('--readme')) {
  const status = { verified: 'generated ✓', unverified: 'unverified', invalid: 'invalid', missing: '—' }
  const rows = results.map(({ c, r }) => `| ${c.id} | \`${c.image.file}\` | ${c.age} | ${groupOf(c.age)} | ${c.gender} | ${c.heritage}${c.name ? ` (${c.name})` : ''} | ${status[r.status]} |`)
  const prompts = data.characters.map(c => `### ${c.id} — ${c.age}, ${c.gender}, ${c.heritage}${c.name ? ` — ${c.name}` : ''}\n\n\`${c.image.file}\`\n\n> ${c.prompt}\n`)
  writeFileSync(join(outputDir(), 'README.md'), `# Character library portraits

One **AI-generated, photorealistic** portrait per character in \`src/data/characterLibrary.json\`, saved here as
\`<ID>.webp\` (${data.imageSpec.width}×${data.imageSpec.height}). The app shows a portrait only when its own file is here; a character
without one shows "Portrait not added yet". No drawings, avatars, stand-ins or stock photos.

## Generating them

Portraits are made by an image model through \`npm run characters:generate\` (in \`frontend/\`). It needs an API key:

\`\`\`
# backend/.env  (or frontend/.env.local)
OPENAI_API_KEY=sk-...                 # required — platform.openai.com → API keys
CHARACTER_IMAGE_MODEL=gpt-image-1     # optional — a GPT Image model that can return WebP
CHARACTER_IMAGE_QUALITY=high          # optional — low | medium | high (higher costs more per image)
CHARACTER_NEGATIVE_PROMPT=...         # optional — replaces the default negative prompt below
\`\`\`

\`\`\`
npm run characters:generate -- --dry-run          # see exactly what will be sent (no calls, no files)
npm run characters:generate -- --only=CHR-0045    # one portrait first (Paati) to check the look
npm run characters:generate                       # every character still missing
npm run characters:generate -- --force --only=CHR-0007   # replace one you don't like
npm run characters:check                          # generated and verified / unverified / invalid / missing
\`\`\`

Each image is checked before it's saved — a real WebP of the right size, not identical to another character's —
and recorded in \`manifest.json\` (model, time, checksum, prompt checksum). Files added by hand are reported as
**unverified**. Add another provider in \`scripts/characters-generate.mjs\` (\`PROVIDERS\`).

**Negative prompt** (what portraits must never look like): ${negative}

## Characters

| ID | File | Age | Group | Gender | Background | Portrait |
|---|---|---|---|---|---|---|
${rows.join('\n')}

## Prompts

${prompts.join('\n')}`)
  console.log('\nWrote README.md')
}

if (problems.length) {
  console.error(`\nData problems:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
