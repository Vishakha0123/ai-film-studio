#!/usr/bin/env node
/**
 * Character library check.
 *   npm run characters:check            → validates the data, lists which portrait files are present / missing
 *   npm run characters:check -- --prompts  → also prints the generation prompt for every missing portrait
 *   npm run characters:check -- --readme   → rewrites src/assets/characters/README.md (ids, ages, file names, prompts)
 * Exits with code 1 if the data itself is invalid (duplicate ids or files, bad ages…). Missing images are reported, not failed.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'src/data/characterLibrary.json'), 'utf8'))
const folder = join(root, 'src/assets/characters')
const files = new Set(existsSync(folder) ? readdirSync(folder) : [])
const args = new Set(process.argv.slice(2))

const GROUPS = [['Children', 3, 12], ['Teenagers', 13, 17], ['Young adults', 18, 29], ['Adults', 30, 59], ['Seniors', 60, Infinity]]
const groupOf = age => GROUPS.find(([, min, max]) => age >= min && age <= max)?.[0] ?? 'Out of range'

const problems = []
const ids = new Set(), imageFiles = new Set()
for (const c of data.characters) {
  if (!/^CHR-\d{4}$/.test(c.id)) problems.push(`${c.id}: id should look like CHR-0001`)
  if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`)
  ids.add(c.id)
  if (!Number.isInteger(c.age) || c.age < 3 || c.age > 120) problems.push(`${c.id}: age ${c.age} is outside 3–120`)
  if (!['female', 'male'].includes(c.gender)) problems.push(`${c.id}: gender must be "female" or "male"`)
  if (!c.image?.file) problems.push(`${c.id}: no image file name`)
  else if (imageFiles.has(c.image.file)) problems.push(`${c.id}: image file ${c.image.file} is shared with another character`)
  imageFiles.add(c.image.file)
  if (!c.prompt?.includes(String(c.age))) problems.push(`${c.id}: prompt doesn't mention the age ${c.age}`)
}
const extra = [...files].filter(f => /\.(webp|jpe?g|png|avif)$/i.test(f) && !imageFiles.has(f))

const present = data.characters.filter(c => files.has(c.image.file))
const missing = data.characters.filter(c => !files.has(c.image.file))

console.log(`Character library: ${data.characters.length} characters`)
for (const [name] of GROUPS) {
  const inGroup = data.characters.filter(c => groupOf(c.age) === name)
  const f = inGroup.filter(c => c.gender === 'female').length, m = inGroup.length - f
  console.log(`  ${name.padEnd(13)} ${String(inGroup.length).padStart(2)}  (${f} girls/women, ${m} boys/men)`)
}
console.log(`\nPortraits: ${present.length} present, ${missing.length} missing  (folder: src/assets/characters/)`)
for (const c of missing) {
  console.log(`  missing  ${c.image.file}  — ${c.age}, ${c.gender}, ${c.heritage}`)
  if (args.has('--prompts')) console.log(`           ${c.prompt}\n`)
}
if (extra.length) console.log(`\nFiles in the folder that no character uses: ${extra.join(', ')}`)

if (args.has('--readme')) {
  const rows = data.characters.map(c => `| ${c.id} | \`${c.image.file}\` | ${c.age} | ${groupOf(c.age)} | ${c.gender} | ${c.heritage} | ${files.has(c.image.file) ? 'yes' : '—'} |`)
  const prompts = data.characters.map(c => `### ${c.id} — ${c.age}, ${c.gender}, ${c.heritage}\n\n\`${c.image.file}\`\n\n> ${c.prompt}\n`)
  writeFileSync(join(folder, 'README.md'), `# Character library portraits

One AI-generated portrait per character in \`src/data/characterLibrary.json\`. Save each image here with the
character's file name (e.g. \`CHR-0007.webp\`); the Character library picks it up automatically — no code change.

- **Format:** ${data.imageSpec.format}, ${data.imageSpec.width}×${data.imageSpec.height} (3:4, head and shoulders). JPG/PNG/AVIF also work if the file name in the data matches.
- **One image per character.** Never reuse an image for two characters, and don't add stand-in pictures: a character
  without a file shows "Portrait not added yet" in the app.
- **Ages are matched from the data, not the file name** — if a portrait looks older or younger than the character's
  age, change the image (or the age in the data), not the name.
- Check what's present or missing: \`npm run characters:check\` (add \`-- --prompts\` for the missing prompts).

## Characters

| ID | File | Age | Group | Gender | Background | Present |
|---|---|---|---|---|---|---|
${rows.join('\n')}

## Prompts

${prompts.join('\n')}`)
  console.log('\nWrote src/assets/characters/README.md')
}

if (problems.length) {
  console.error(`\nData problems:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
