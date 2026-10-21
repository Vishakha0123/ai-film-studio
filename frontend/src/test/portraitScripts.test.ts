import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync, spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error — plain .mjs helper shared with the scripts
import { webpSize, verifyPortrait, sha256 } from '../../scripts/lib/portraitFiles.mjs'

/** Just the header of a VP8X WebP of the given size (enough for the size check; not a viewable image). */
function webpHeader(width: number, height: number, salt = 0): Buffer {
  const b = Buffer.alloc(40)
  b.write('RIFF', 0); b.writeUInt32LE(32, 4); b.write('WEBP', 8); b.write('VP8X', 12); b.writeUInt32LE(10, 16)
  b.writeUIntLE(width - 1, 24, 3); b.writeUIntLE(height - 1, 27, 3); b[39] = salt
  return b
}

const FRONTEND = join(__dirname, '..', '..')
const run = (args: string[], env: Record<string, string>) =>
  spawnSync(process.execPath, ['scripts/characters-generate.mjs', ...args], { cwd: FRONTEND, env: { PATH: process.env.PATH!, ...env }, encoding: 'utf8' })

describe('portrait file checks', () => {
  it('reads WebP sizes and rejects anything that is not a WebP', () => {
    expect(webpSize(webpHeader(1024, 1536))).toEqual({ width: 1024, height: 1536 })
    expect(webpSize(Buffer.from('\x89PNG\r\n\x1a\n' + 'x'.repeat(40)))).toBeNull()
    expect(webpSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
  })

  it('only a generator-recorded file of the right size, unique to its character, counts as verified', () => {
    const dir = mkdtempSync(join(tmpdir(), 'portraits-'))
    const c = { id: 'CHR-0001', image: { file: 'CHR-0001.webp', width: 1024, height: 1536 } }
    expect(verifyPortrait(c, { dir, manifest: {} }).status).toBe('missing')
    const img = webpHeader(1024, 1536)
    writeFileSync(join(dir, 'CHR-0001.webp'), img)
    expect(verifyPortrait(c, { dir, manifest: {} }).status).toBe('unverified') // added by hand
    const entry = { file: 'CHR-0001.webp', sha256: sha256(img), model: 'gpt-image-1' }
    expect(verifyPortrait(c, { dir, manifest: { 'CHR-0001': entry } }).status).toBe('verified')
    expect(verifyPortrait(c, { dir, manifest: { 'CHR-0001': entry, 'CHR-0002': { ...entry, file: 'CHR-0002.webp' } } }).status).toBe('invalid') // same image twice
    writeFileSync(join(dir, 'CHR-0001.webp'), webpHeader(512, 512))
    expect(verifyPortrait(c, { dir, manifest: { 'CHR-0001': entry } })).toMatchObject({ status: 'invalid', reason: '512×512, expected 1024×1536' })
    rmSync(dir, { recursive: true })
  })
})

describe('characters:generate', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'portraits-')) })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('without an API key it explains the setup and writes no files', () => {
    const r = run(['--only=CHR-0045'], { CHARACTER_OUTPUT_DIR: dir, OPENAI_API_KEY: '', HOME: dir })
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('No image model is configured, so no portraits were generated')
    expect(r.stderr).toContain('OPENAI_API_KEY=sk-')
    expect(readdirSync(dir)).toEqual([])
  })

  it('a dry run prints the full prompt with the negative prompt and writes nothing', () => {
    const r = run(['--dry-run', '--only=CHR-0045'], { CHARACTER_OUTPUT_DIR: dir })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Photorealistic close-up portrait photograph of a 78-year-old elderly Tamil woman named Paati')
    expect(r.stdout).toContain('Avoid: cartoon, illustration')
    expect(readdirSync(dir)).toEqual([])
  })

  describe('with an image API', () => {
    let server: Server
    let base = ''
    const requests: Record<string, unknown>[] = []
    let reply: (n: number) => Buffer = n => webpHeader(1024, 1536, n)

    beforeEach(async () => {
      requests.length = 0
      server = createServer((req, res) => {
        let body = ''
        req.on('data', d => { body += d })
        req.on('end', () => {
          requests.push(JSON.parse(body))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ data: [{ b64_json: reply(requests.length).toString('base64') }] }))
        })
      })
      await new Promise<void>(r => server.listen(0, r))
      base = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`
    })
    afterEach(() => new Promise<void>(r => server.close(() => r())))

    const runAsync = (args: string[]) => new Promise<{ code: number; out: string }>(resolve => {
      const p = spawn(process.execPath, ['scripts/characters-generate.mjs', ...args], {
        cwd: FRONTEND, env: { PATH: process.env.PATH!, CHARACTER_OUTPUT_DIR: dir, OPENAI_API_KEY: 'sk-test', OPENAI_BASE_URL: base },
      })
      let out = ''
      p.stdout.on('data', d => { out += d }); p.stderr.on('data', d => { out += d })
      p.on('close', code => resolve({ code: code ?? 1, out }))
    })

    it('saves each portrait as <ID>.webp, records it in the manifest, and sends the prompt + negative prompt', async () => {
      reply = n => webpHeader(1024, 1536, n)
      const r = await runAsync(['--only=CHR-0045,CHR-0001'])
      expect(r.code).toBe(0)
      expect(readdirSync(dir).sort()).toEqual(['CHR-0001.webp', 'CHR-0045.webp', 'manifest.json'])
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
      expect(manifest['CHR-0045']).toMatchObject({ file: 'CHR-0045.webp', provider: 'openai', model: 'gpt-image-1', width: 1024, height: 1536 })
      expect(requests[0]).toMatchObject({ model: 'gpt-image-1', size: '1024x1536', output_format: 'webp', n: 1 })
      const sent = requests.map(q => q.prompt as string)
      expect(sent.find(p => p.includes('named Paati'))).toContain('white cotton saree with a checked border')
      expect(sent.every(p => p.includes('Avoid: cartoon, illustration'))).toBe(true)
      expect(r.out).toContain('Generated and verified: 2')
      // a second run skips what's already verified
      const again = await runAsync(['--only=CHR-0045'])
      expect(again.out).toContain('already has a verified portrait')
    })

    it('refuses wrong sizes, non-images and the same image for two characters — nothing is saved for those', async () => {
      reply = () => webpHeader(1024, 1536, 7) // identical bytes every time
      const r = await runAsync(['--only=CHR-0001,CHR-0002'])
      expect(r.code).toBe(1)
      expect(r.out).toContain("identical to CHR-0001's portrait — not saved")
      expect(readdirSync(dir).sort()).toEqual(['CHR-0001.webp', 'manifest.json'])
      reply = () => webpHeader(512, 512)
      expect((await runAsync(['--only=CHR-0003'])).out).toContain('got 512×512, expected 1024×1536')
      reply = () => Buffer.from('<svg/>'.padEnd(60))
      expect((await runAsync(['--only=CHR-0004'])).out).toContain('did not return a WebP image')
      expect(readdirSync(dir).sort()).toEqual(['CHR-0001.webp', 'manifest.json'])
    })
  })
})
