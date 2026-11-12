#!/usr/bin/env node
/**
 * Records and encodes the home page's "Watch Demo" video.
 *   npm run demo:record
 * 1. Plays through the real app (playwright.demo.config.ts → e2e/record-demo.demo.ts), recording the screen.
 * 2. Cuts it from the first chapter to the end, encodes H.264 MP4 + a poster image into public/demo/.
 * 3. Writes the chapter start times to src/demo.chapters.json (used by src/demo.ts).
 * Needs FFmpeg and the backend's .venv (like the live e2e tests).
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const results = join(root, '.demo-results')
const markersFile = join(results, 'markers.json')

execFileSync('npx', ['playwright', 'test', '-c', 'playwright.demo.config.ts'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, DEMO_MARKERS: markersFile },
})

const findVideo = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { const v = findVideo(p); if (v) return v }
    else if (name.endsWith('.webm')) return p
  }
  return null
}
const raw = findVideo(results)
if (!raw) throw new Error('No recording found in .demo-results')
const marks = JSON.parse(readFileSync(markersFile, 'utf8'))
const from = Math.max(0, marks.idea - 0.2)
const length = marks.end - from

mkdirSync(join(root, 'public/demo'), { recursive: true })
const mp4 = join(root, 'public/demo/cinema-ai-demo.mp4')
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', from.toFixed(2), '-i', raw, '-t', length.toFixed(2),
  '-vf', 'scale=1280:720:flags=lanczos,fps=25', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' })
const chapters = {
  idea: 0,
  story: +(marks.story - from).toFixed(1),
  full: +(marks.full - from).toFixed(1),
  languages: +(marks.languages - from).toFixed(1),
  script: +(marks.script - from).toFixed(1),
  duration: +length.toFixed(1),
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(chapters.story + 1.5), '-i', mp4, '-frames:v', '1', '-q:v', '4',
  join(root, 'public/demo/cinema-ai-demo.jpg')], { stdio: 'inherit' })
writeFileSync(join(root, 'src/demo.chapters.json'), `${JSON.stringify(chapters, null, 2)}\n`)
console.log(`Demo: ${(statSync(mp4).size / 1e6).toFixed(1)} MB, ${chapters.duration}s`, chapters)
