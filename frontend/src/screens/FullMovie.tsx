import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { nearestFilmLength, requestedMinutes } from '../lib/filmLength'
import {
  ApiError, DEMO_MODE, generateLongFilm, getLongFilm, getLongFilmScene, getProject, pauseLongFilm, planLongFilm,
  renderLongFilm, retryLongFilmScene, retryLongFilmShot, updateLongFilm, editLongFilmScene, rewriteLongFilmScene,
  waitForJob, assertCompleted, writeLongFilmScripts, downloadLongFilmScript,
} from '../api'
import { fieldCls, SaveCancel } from '../components/DirectAI'
import LockIcon, { ComingSoonButton } from '../components/LockIcon'
import { isVideoLocked } from '../features'
import type { LongFilmShot } from '../types'
import type { LongFilm, LongFilmScene, LongFilmSceneSummary, ProjectData } from '../types'

export const LENGTHS = [
  { minutes: 10, label: '10 min', note: 'Pilot — check the look first' },
  { minutes: 30, label: '30 min', note: 'Short feature' },
  { minutes: 60, label: '1 hour', note: 'Feature' },
  { minutes: 120, label: '2 hours', note: 'Full feature' },
]
const BUSY = new Set(['planning', 'writing', 'generating', 'rendering'])
const card = { backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }
const gold = '#d4a84b'

const STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planning scenes', color: gold },
  planned: { label: 'Scenes planned', color: gold },
  writing: { label: 'Writing the script', color: gold },
  generating: { label: 'Making scenes', color: '#8b7cf6' },
  paused: { label: 'Paused', color: '#a1a1aa' },
  budget_reached: { label: 'Budget cap reached', color: '#f59e0b' },
  generated: { label: 'All scenes ready', color: '#8b7cf6' },
  rendering: { label: 'Rendering the film', color: '#8b7cf6' },
  rendered: { label: 'Rendered', color: '#10b981' },
  failed: { label: 'Needs attention', color: '#f87171' },
}
const SCENE_STATUS: Record<string, { label: string; color: string }> = {
  planned: { label: 'Planned', color: '#71717a' },
  generating: { label: 'Making…', color: '#8b7cf6' },
  done: { label: 'Ready', color: '#10b981' },
  failed: { label: 'Failed', color: '#f87171' },
}

export function duration(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`
}
const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Button({ children, onClick, primary, disabled, testId }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-testid={testId}
      className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
      style={primary ? { backgroundColor: gold, color: '#09090b' } : { border: '1px solid rgba(255,255,255,0.12)', color: '#d4d4d8' }}>
      {children}
    </button>
  )
}

/** Choose the length, budget cap and quality, then plan the scenes. */
function Setup({ film, busy, asked, onPlan, onCancel }: { film: LongFilm | null; busy: boolean; asked: number | null; onPlan: (minutes: number, cap: number, quality: 'draft' | 'final') => void; onCancel?: () => void }) {
  const [minutes, setMinutes] = useState(asked ?? (film ? Math.round(film.targetSeconds / 60) : 10))
  const [cap, setCap] = useState(String(film?.budgetCap ?? 25))
  const [quality, setQuality] = useState<'draft' | 'final'>(film?.quality ?? 'draft')
  const capValue = Number(cap)
  return (
    <section className="rounded-xl p-5 sm:p-6" style={card} data-testid="movie-setup">
      <h3 className="text-lg font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>How long should the film be?</h3>
      {asked && <p className="text-xs mb-2" style={{ color: gold }} data-testid="movie-asked">You asked for this length in your idea — it's selected below.</p>}
      <p className="text-xs text-zinc-500 mb-4">The story, cast and look come from the film you planned. {isVideoLocked() ? "It's grown into a full-length story with its cast, then written scene by scene." : "It's written and made scene by scene, so you can watch each scene as it's ready."}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5" role="radiogroup" aria-label="Film length">
        {LENGTHS.map(l => (
          <button key={l.minutes} type="button" role="radio" aria-checked={minutes === l.minutes} onClick={() => setMinutes(l.minutes)}
            className="text-left px-3 py-3 rounded-lg border transition-all"
            style={{ borderColor: minutes === l.minutes ? 'rgba(212,168,75,0.5)' : 'rgba(255,255,255,0.08)', backgroundColor: minutes === l.minutes ? 'rgba(212,168,75,0.07)' : 'transparent' }}>
            <span className="block text-sm" style={{ color: minutes === l.minutes ? gold : '#e4e4e7' }}>{l.label}</span>
            <span className="block text-[11px] text-zinc-500">{l.note}</span>
          </button>
        ))}
      </div>
      {isVideoLocked() ? (
        <p className="flex items-center gap-2 text-xs text-zinc-500 mb-5" data-testid="movie-budget-locked">
          <LockIcon /> Budget cap and video quality — <span className="uppercase tracking-wider text-[10px] text-zinc-600">Coming soon</span> (with video). Planning writes the story, cast and scenes only.
        </p>
      ) : (
      <div className="flex flex-wrap gap-4 mb-5">
        <label className="text-xs text-zinc-400">
          <span className="block mb-1">Budget cap (USD) — work stops before going over it</span>
          <input type="number" min={0} step={1} value={cap} onChange={e => setCap(e.target.value)} aria-label="Budget cap in US dollars"
            className="w-36 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600" />
        </label>
        <label className="text-xs text-zinc-400">
          <span className="block mb-1">Video quality</span>
          <select value={quality} onChange={e => setQuality(e.target.value as 'draft' | 'final')} aria-label="Video quality"
            className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 text-sm focus:outline-none">
            <option value="draft">Draft (cheaper)</option>
            <option value="final">Final</option>
          </select>
        </label>
      </div>
      )}
      {film && film.scenes.length > 0 && <p className="text-[11px] text-amber-300/80 mb-3">Planning again replaces the current scenes and everything made from them.</p>}
      <div className="flex gap-2">
        <Button primary disabled={busy || !(capValue >= 0) || cap === ''} onClick={() => onPlan(minutes, capValue, quality)} testId="movie-plan">
          {busy ? 'Planning…' : 'Plan the scenes'}
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </div>
    </section>
  )
}

type DraftShot = Pick<LongFilmShot, 'id' | 'number' | 'description' | 'camera' | 'movement' | 'dialogue'>

/** Hand edit: the scene's text, and each shot's picture (description, camera, movement) and dialogue. */
function SceneEditor({ projectId, detail, onSaved, onCancel }: { projectId: string; detail: LongFilmScene; onSaved: (s: LongFilmScene) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(detail.title)
  const [summary, setSummary] = useState(detail.summary)
  const [script, setScript] = useState(detail.script)
  const [shots, setShots] = useState<DraftShot[]>(detail.shots.map(s => ({ ...s, dialogue: s.dialogue.map(d => ({ ...d })) })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setShot = (i: number, patch: Partial<DraftShot>) => setShots(all => all.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const setLine = (i: number, k: number, patch: Partial<{ character: string; text: string }>) =>
    setShot(i, { dialogue: shots[i].dialogue.map((d, j) => (j === k ? { ...d, ...patch } : d)) })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const before = new Map(detail.shots.map(s => [s.id, s]))
      const changed = shots.filter(s => {
        const b = before.get(s.id)!
        return s.description !== b.description || s.camera !== b.camera || s.movement !== b.movement || JSON.stringify(s.dialogue) !== JSON.stringify(b.dialogue)
      })
      onSaved(await editLongFilmScene(projectId, detail.number, {
        title, summary, script,
        shots: changed.map(s => ({ id: s.id, description: s.description, camera: s.camera, movement: s.movement, dialogue: s.dialogue.filter(d => d.text.trim()) })),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 space-y-3" data-testid={`movie-scene-editor-${detail.number}`}>
      <label className="block text-[11px] text-zinc-500">Title<input className={fieldCls} value={title} onChange={e => setTitle(e.target.value)} aria-label="Scene title" /></label>
      <label className="block text-[11px] text-zinc-500">What happens<textarea className={fieldCls} rows={2} value={summary} onChange={e => setSummary(e.target.value)} aria-label="Scene summary" /></label>
      <label className="block text-[11px] text-zinc-500">Script<textarea className={`${fieldCls} font-mono`} rows={6} value={script} onChange={e => setScript(e.target.value)} aria-label="Scene script" /></label>
      <p className="text-[11px] text-zinc-500">The shots are what gets filmed. Only the shots you change here are made again.</p>
      {shots.map((s, i) => (
        <div key={s.id} className="rounded-lg p-3 space-y-2" style={{ border: '1px solid rgba(255,255,255,0.06)' }} data-testid={`movie-shot-editor-${s.number}`}>
          <div className="flex gap-2 items-center">
            <span className="text-[11px] font-mono text-zinc-600 w-14">Shot {s.number}</span>
            <input className={fieldCls} value={s.camera} onChange={e => setShot(i, { camera: e.target.value })} aria-label={`Shot ${s.number} camera`} />
            <input className={fieldCls} value={s.movement} onChange={e => setShot(i, { movement: e.target.value })} aria-label={`Shot ${s.number} movement`} />
          </div>
          <textarea className={fieldCls} rows={2} value={s.description} onChange={e => setShot(i, { description: e.target.value })} aria-label={`Shot ${s.number} description`} />
          {s.dialogue.map((d, k) => (
            <div key={k} className="flex gap-2">
              <input className={`${fieldCls} !w-36`} value={d.character} placeholder="Who" onChange={e => setLine(i, k, { character: e.target.value })} aria-label={`Shot ${s.number} line ${k + 1} character`} />
              <input className={fieldCls} value={d.text} placeholder="Line" onChange={e => setLine(i, k, { text: e.target.value })} aria-label={`Shot ${s.number} line ${k + 1}`} />
              <button type="button" className="text-xs text-zinc-500 hover:text-red-300 px-2" aria-label={`Remove shot ${s.number} line ${k + 1}`} onClick={() => setShot(i, { dialogue: s.dialogue.filter((_, j) => j !== k) })}>✕</button>
            </div>
          ))}
          {s.dialogue.length < 8 && (
            <button type="button" className="text-[11px]" style={{ color: gold }} onClick={() => setShot(i, { dialogue: [...s.dialogue, { character: s.dialogue[0]?.character ?? '', text: '' }] })}>+ Add a line</button>
          )}
        </div>
      ))}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <SaveCancel onSave={() => void save()} onCancel={onCancel} saving={saving} saveLabel="Save changes" />
    </div>
  )
}

/** "Direct the AI" for one scene: the AI rewrites its script and shots; only this scene is made again. */
function SceneDirector({ projectId, number, onDone }: { projectId: string; number: number; onDone: () => void }) {
  const [text, setText] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const apply = async () => {
    if (!text.trim()) return
    setError(null)
    setWorking('Rewriting the scene…')
    try {
      assertCompleted(await waitForJob(await rewriteLongFilmScene(projectId, number, text.trim()), j => setWorking(j.stage || 'Rewriting the scene…')))
      setText('')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rewrite the scene.')
    } finally {
      setWorking(null)
    }
  }
  return (
    <form onSubmit={e => { e.preventDefault(); void apply() }} className="mt-4" data-testid={`movie-scene-direct-${number}`}>
      <p className="text-[11px] text-zinc-500 mb-2">Direct the AI — rewrites this scene's script and shots (in any language)</p>
      <div className="flex gap-2">
        <input className={fieldCls} value={text} onChange={e => setText(e.target.value)} disabled={!!working}
          placeholder="e.g. Make it rain, and let Paati sing softly to calm him" aria-label={`Direct the AI for scene ${number}`} />
        <button type="submit" disabled={!text.trim() || !!working} className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40" style={{ backgroundColor: gold, color: '#09090b' }}>
          {working ? 'Working…' : 'Apply'}
        </button>
      </div>
      {working && <p className="text-xs mt-2" style={{ color: gold }}>{working}</p>}
      {error && <p role="alert" className="text-xs text-red-300 mt-2">{error}</p>}
    </form>
  )
}

function SceneRow({ projectId, scene, canRetry, onChanged, onError, onRefresh }: { projectId: string; scene: LongFilmSceneSummary; canRetry: boolean; onChanged: (f: LongFilm) => void; onError: (m: string) => void; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [detail, setDetail] = useState<LongFilmScene | null>(null)
  const st = SCENE_STATUS[scene.status] ?? SCENE_STATUS.planned
  const load = useCallback(() => getLongFilmScene(projectId, scene.number).then(setDetail).catch(() => {}), [projectId, scene.number])
  useEffect(() => { if (open) void load() }, [open, load, scene.status, scene.shotsDone])
  const retry = async (fn: () => Promise<LongFilm>) => {
    try { onChanged(await fn()) } catch (e) { onError(e instanceof Error ? e.message : 'Retry failed.') }
  }
  return (
    <li className="rounded-lg" style={card} data-testid={`movie-scene-${scene.number}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <span className="text-xs font-mono text-zinc-600 w-8 flex-shrink-0">{String(scene.number).padStart(2, '0')}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-zinc-200 truncate">{scene.title}</span>
          <span className="block text-[11px] text-zinc-500 truncate">Act {scene.act} · {scene.location || 'Location TBD'} · {duration(scene.targetSeconds)}</span>
        </span>
        {isVideoLocked() ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={scene.scripted ? { backgroundColor: '#10b98122', color: '#10b981' } : { backgroundColor: '#71717a22', color: '#71717a' }}>
            {scene.scripted ? `Script ready · ${scene.shots} shots` : 'Outline'}
          </span>
        ) : (
          <>
            <span className="text-[11px] text-zinc-500 hidden sm:block">{scene.shots ? `${scene.shotsDone}/${scene.shots} shots` : ''}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${st.color}22`, color: st.color }}>{st.label}</span>
          </>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-xs text-zinc-400 leading-relaxed mt-3">{scene.summary}</p>
          {scene.error && <p className="text-xs text-red-300 mt-2">{scene.error}</p>}
          {scene.previewUrl && <video controls preload="none" src={scene.previewUrl} className="w-full max-w-xl mt-3 rounded-lg bg-black" data-testid={`movie-scene-preview-${scene.number}`} />}
          {scene.status === 'failed' && canRetry && !isVideoLocked() && (
            <div className="mt-3"><Button onClick={() => void retry(() => retryLongFilmScene(projectId, scene.number))} testId={`movie-retry-scene-${scene.number}`}>Retry this scene</Button></div>
          )}
          {detail && canRetry && !editing && (
            <div className="mt-3 flex gap-2">
              <Button onClick={() => setEditing(true)} testId={`movie-edit-scene-${scene.number}`}>Edit scene</Button>
            </div>
          )}
          {detail && editing && (
            <SceneEditor projectId={projectId} detail={detail} onCancel={() => setEditing(false)}
              onSaved={d => { setDetail(d); setEditing(false); onRefresh() }} />
          )}
          {detail && canRetry && !editing && <SceneDirector projectId={projectId} number={scene.number} onDone={() => { void load(); onRefresh() }} />}
          {detail && !editing && detail.script && (
            <details className="mt-4">
              <summary className="text-[11px] text-zinc-500 cursor-pointer">Script</summary>
              <pre className="mt-2 text-xs text-zinc-400 whitespace-pre-wrap font-mono" data-testid={`movie-scene-script-${scene.number}`}>{detail.script}</pre>
            </details>
          )}
          {detail && !editing && detail.shots.length > 0 && (
            <ol className="mt-4 space-y-2">
              {detail.shots.map(sh => (
                <li key={sh.id} className="flex items-start gap-3 text-xs" data-testid={`movie-shot-${scene.number}-${sh.number}`}>
                  <span className="font-mono text-zinc-600 w-6 flex-shrink-0">{sh.number}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-zinc-300">{sh.camera} · {sh.movement} · {sh.seconds}s</span>
                    <span className="block text-zinc-500">{sh.description}</span>
                    {sh.dialogue.map((d, i) => <span key={i} className="block text-zinc-400 italic">{d.character}: “{d.text}”</span>)}
                    {sh.error && <span className="block text-red-300">{sh.error}</span>}
                  </span>
                  {!isVideoLocked() && sh.clipKind === 'test' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Test clip</span>}
                  {!isVideoLocked() && <span className="text-[10px] text-zinc-500 w-14 text-right">{sh.status}</span>}
                  {sh.status === 'failed' && canRetry && !isVideoLocked() && (
                    <button type="button" onClick={() => void retry(() => retryLongFilmShot(projectId, sh.id))} className="text-[11px]" style={{ color: gold }} data-testid={`movie-retry-shot-${scene.number}-${sh.number}`}>Retry</button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  )
}

/** The full-length film (10 minutes – 2 hours): plan, cost, make scene by scene, watch, render, download. */
export default function FullMovie() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [film, setFilm] = useState<LongFilm | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [replanning, setReplanning] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'pdf' | 'txt' | null>(null)
  const [search] = useSearchParams()

  useEffect(() => {
    let alive = true
    Promise.all([getProject(id), getLongFilm(id)])
      .then(([p, f]) => { if (alive) { setProject(p); setFilm(f) } })
      .catch(e => alive && setError(e instanceof Error ? e.message : 'Could not open the film.'))
    return () => { alive = false }
  }, [id])

  // While work runs in the background, refresh every few seconds (it keeps going if this page is closed)
  const busy = !!film && (BUSY.has(film.status) || film.job?.status === 'queued' || film.job?.status === 'running')
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => { getLongFilm(id).then(f => f && setFilm(f)).catch(() => {}) }, 2500)
    return () => clearInterval(t)
  }, [busy, id])

  const act = async (fn: () => Promise<LongFilm>) => {
    setWorking(true)
    setError(null)
    try {
      setFilm(await fn())
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 402 && /confirmation/i.test(e.message)) setConfirm(e.message)
      else setError(e instanceof Error ? e.message : 'Something went wrong.')
      return false
    } finally {
      setWorking(false)
    }
  }

  if (DEMO_MODE) return <p className="px-6 py-10 text-sm text-zinc-400">A full-length film needs the studio backend — it can’t be made in demo mode.</p>
  if (error && film === undefined) return <p role="alert" className="px-6 py-10 text-sm text-red-300">{error}</p>
  if (!project || film === undefined) return <p className="px-6 py-10 text-xs text-zinc-600">Loading…</p>

  const planned = !!project.memory
  const st = film ? STATUS[film.status] ?? { label: film.status, color: '#71717a' } : null
  const est = film?.estimate
  const noVideo = est ? !est.liveProviders.video : false
  const canRetry = !!film && !busy
  const written = film ? film.scenes.filter(sc => sc.scripted).length : 0
  const saveBlob = ({ blob, filename }: { blob: Blob; filename: string }) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-16" data-testid="full-movie">
      <button onClick={() => nav(`/projects/${encodeURIComponent(id)}`)} className="text-xs text-zinc-500 hover:text-zinc-300 mb-5">← {project.title}</button>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h2 className="text-2xl sm:text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Full-length film</h2>
        {st && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${st.color}22`, color: st.color }} data-testid="movie-status">{st.label}</span>}
      </div>
      <p className="text-sm text-zinc-500 mb-6">{film ? `${duration(film.targetSeconds)} · ${film.scenes.length} scenes · ${film.estimate.shots} shots of ~${film.shotSeconds}s` : 'From 10 minutes to 2 hours, made scene by scene.'}</p>

      {!planned && <p className="text-sm text-zinc-400">Plan the film’s story in the AI Director first — the full-length version is built from it.</p>}

      {planned && (noVideo || !film) && !isVideoLocked() && (
        <div className="rounded-lg px-4 py-3 mb-5 text-xs leading-relaxed" style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: '#fcd34d' }} data-testid="movie-test-notice">
          No video model is connected, so every shot is a labelled <b>TEST CLIP</b> card (the shot’s description, with test voice tones) — not real footage.
          It shows the film’s scenes, timing and assembly. Real footage needs a video model and an image model set up on the server.
        </div>
      )}

      {error && <p role="alert" className="text-xs text-red-300 mb-4">{error}</p>}

      {planned && (!film || replanning || (film.status === 'failed' && film.scenes.length === 0)) && (
        <Setup film={film} busy={working} asked={(() => {
          // the length chosen in the AI Director (?minutes=120), else one written in the idea ("a 2-hour film")
          const n = Number(search.get('minutes')) || requestedMinutes(String(project.brief?.prompt ?? ''))
          return n && !replanning ? nearestFilmLength(n) : null
        })()} onCancel={film && replanning ? () => setReplanning(false) : undefined}
          onPlan={(m, cap, q) => void act(() => planLongFilm(id, m, cap, q)).then(ok => ok && setReplanning(false))} />
      )}

      {film && film.status === 'planning' && (
        <p className="text-sm mb-5" style={{ color: gold }} data-testid="movie-planning">{film.job?.stage || 'Writing the scene outline…'}</p>
      )}
      {film && film.status === 'failed' && film.scenes.length === 0 && film.error && <p className="text-xs text-amber-300 mb-4">{film.error}</p>}

      {film && !replanning && film.scenes.length > 0 && est && (
        <>
          {/* The feature-length story and cast */}
          {film.story && (
            <section className="rounded-xl p-5 mb-5" style={card} data-testid="movie-story">
              <h3 className="text-sm text-zinc-200 mb-1">Feature story</h3>
              <p className="text-[11px] text-zinc-500 mb-3">Your film's idea, grown into a {duration(film.targetSeconds)} story — the scenes are written from it.</p>
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto pr-2" data-testid="movie-story-text">{film.story.story}</div>
              {film.story.subplots.length > 0 && (
                <p className="text-xs text-zinc-400 mt-3"><span className="text-zinc-500">Subplots: </span>{film.story.subplots.join(' · ')}</p>
              )}
              <div className="mt-4">
                <p className="text-[11px] text-zinc-500 mb-2">Cast · {film.story.cast.length} characters{film.story.newCharacters.length ? ` (${film.story.newCharacters.length} added for the full-length story)` : ''}</p>
                <div className="flex flex-wrap gap-2" data-testid="movie-cast">
                  {film.story.cast.map(c => {
                    const isNew = film.story!.newCharacters.includes(c.name)
                    return (
                      <span key={c.name} className="text-xs px-2.5 py-1 rounded-full border" title={c.role}
                        style={{ borderColor: isNew ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.1)', color: isNew ? gold : '#d4d4d8' }}>
                        {c.name}{c.age ? ` · ${c.age}` : ''}{isNew ? ' · new' : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Script only — no video */}
          <section className="rounded-xl p-5 mb-5" style={card} data-testid="movie-script">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm text-zinc-200">Script only</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Write every scene's script, shots and dialogue — no video, pictures or voices are made.
                  <span className="text-zinc-400" data-testid="movie-script-count"> {written}/{film.scenes.length} scenes written.</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {written < film.scenes.length && !busy && (
                  <Button primary disabled={working} onClick={() => void act(() => writeLongFilmScripts(id))} testId="movie-write-script">
                    {written ? 'Write the rest of the script' : 'Write the full script'}
                  </Button>
                )}
                {written > 0 && (['pdf', 'txt'] as const).map(fmt => (
                  <Button key={fmt} disabled={working || downloading === fmt}
                    onClick={() => {
                      setDownloading(fmt)
                      void downloadLongFilmScript(id, fmt).then(saveBlob)
                        .catch(e => setError(e instanceof Error ? e.message : 'Download failed.'))
                        .finally(() => setDownloading(null))
                    }}
                    testId={`movie-download-script-${fmt}`}>
                    {downloading === fmt ? 'Preparing…' : `Download ${fmt.toUpperCase()}`}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          {/* While video is locked: progress, pause and length only — no cost, budget or video controls */}
          {isVideoLocked() && (
            <section className="rounded-xl p-5 mb-5" style={card} data-testid="movie-video-locked">
              {busy && film.job && (
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] text-zinc-500 mb-1"><span data-testid="movie-stage">{film.job.stage || 'Starting…'}</span><span>{film.job.progress}%</span></div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${film.job.progress}%`, backgroundColor: gold }} /></div>
                </div>
              )}
              {!busy && film.error && <p className="text-xs text-amber-300 mb-3" data-testid="movie-error">{film.error}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <ComingSoonButton label="Make the video" className="px-4 py-2 text-xs" testId="movie-generate-locked" />
                {film.status === 'writing' && (
                  <Button disabled={film.pauseRequested || working} onClick={() => void act(() => pauseLongFilm(id))} testId="movie-pause">
                    {film.pauseRequested ? 'Pausing after this scene…' : 'Pause'}
                  </Button>
                )}
                {!busy && <Button disabled={working} onClick={() => setReplanning(true)} testId="movie-replan">Change length</Button>}
              </div>
              <p className="text-[11px] text-zinc-600 mt-3">Video, voices, cost estimate and budget cap are coming soon. The story, cast, scenes and scripts are ready to use now.</p>
            </section>
          )}

          {/* Cost and controls */}
          {!isVideoLocked() && (
          <section className="rounded-xl p-5 mb-5" style={card} data-testid="movie-estimate">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-xs">
              <div><span className="block text-zinc-500">Still to make</span><span className="text-zinc-200 text-sm">{est.remainingShots} shots · {duration(est.videoSeconds)}</span></div>
              <div><span className="block text-zinc-500">Estimated cost now</span><span className="text-zinc-200 text-sm" data-testid="movie-cost">{usd(est.estimatedCost)}</span></div>
              <div><span className="block text-zinc-500">With real video, images & voices</span><span className="text-zinc-200 text-sm">{usd(est.fullProviderCost)}</span></div>
              <div><span className="block text-zinc-500">Spent / budget cap</span><span className="text-zinc-200 text-sm">{usd(film.spent)} / {usd(film.budgetCap)}</span></div>
            </div>
            {busy && film.job && (
              <div className="mb-4">
                <div className="flex justify-between text-[11px] text-zinc-500 mb-1"><span data-testid="movie-stage">{film.job.stage || 'Starting…'}</span><span>{film.progress.percent}%</span></div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${film.status === 'generating' ? film.progress.percent : film.job.progress}%`, backgroundColor: gold }} /></div>
              </div>
            )}
            {!busy && film.error && <p className="text-xs text-amber-300 mb-3" data-testid="movie-error">{film.error}</p>}
            {film.status === 'paused' && film.progress.scenesDone < film.progress.scenes && (
              <p className="text-xs text-zinc-400 mb-3" data-testid="movie-continue-hint">Click Continue to make the changed or unfinished scenes — finished scenes are kept.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {['planned', 'paused', 'budget_reached', 'failed'].includes(film.status) && (
                <Button primary disabled={working} onClick={() => void act(() => generateLongFilm(id))} testId="movie-generate">
                  {film.status === 'planned' ? 'Make the scenes' : 'Continue'}
                </Button>
              )}
              {(film.status === 'generating' || film.status === 'writing') && (
                <Button disabled={film.pauseRequested || working} onClick={() => void act(() => pauseLongFilm(id))} testId="movie-pause">
                  {film.pauseRequested ? (film.status === 'writing' ? 'Pausing after this scene…' : 'Pausing after this shot…') : 'Pause'}
                </Button>
              )}
              {(film.status === 'generated' || film.status === 'rendered') && (
                <Button primary disabled={working} onClick={() => void act(() => renderLongFilm(id))} testId="movie-render">
                  {film.status === 'rendered' ? 'Render again' : 'Render the film'}
                </Button>
              )}
              {film.status === 'budget_reached' && (
                <Button disabled={working} onClick={() => {
                  const v = window.prompt('New budget cap (USD)', String(Math.ceil(film.budgetCap * 2)))
                  if (v && Number(v) >= 0) void act(() => updateLongFilm(id, { budgetCap: Number(v) }))
                }}>Raise the cap</Button>
              )}
              {!busy && <Button disabled={working} onClick={() => setReplanning(true)} testId="movie-replan">Change length</Button>}
            </div>
            {confirm && (
              <div className="mt-4 rounded-lg px-4 py-3 text-xs" style={{ backgroundColor: 'rgba(212,168,75,0.07)', border: '1px solid rgba(212,168,75,0.3)' }} data-testid="movie-confirm">
                <p className="text-zinc-200 mb-2">{confirm}. Work stops before the budget cap ({usd(film.budgetCap)}) is passed.</p>
                <div className="flex gap-2">
                  <Button primary onClick={() => { setConfirm(null); void act(() => generateLongFilm(id, true)) }} testId="movie-confirm-yes">Yes, make it</Button>
                  <Button onClick={() => setConfirm(null)}>Not now</Button>
                </div>
              </div>
            )}
          </section>
          )}

          {/* The finished film */}
          {film.final && (
            <section className="rounded-xl p-5 mb-5" style={card} data-testid="movie-final">
              <h3 className="text-sm text-zinc-200 mb-3">Your film · {duration(film.final.seconds)}{film.hasTestClips && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">contains test clips</span>}</h3>
              <video controls preload="metadata" src={film.final.url} className="w-full rounded-lg bg-black mb-3" />
              <a href={film.final.url} download={`${project.title || 'film'}.mp4`} className="inline-block px-4 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: gold, color: '#09090b' }} data-testid="movie-download">
                Download MP4
              </a>
            </section>
          )}

          {/* Scenes */}
          <h3 className="text-sm text-zinc-300 mb-3">Scenes <span className="text-zinc-600">· {isVideoLocked() ? `${written}/${film.scenes.length} scripts written` : `${film.progress.scenesDone}/${film.progress.scenes} ready`}</span></h3>
          <ol className="space-y-2" data-testid="movie-scenes">
            {film.scenes.map(sc => <SceneRow key={sc.number} projectId={id} scene={sc} canRetry={canRetry} onChanged={setFilm} onError={setError}
              onRefresh={() => { getLongFilm(id).then(f => f && setFilm(f)).catch(() => {}) }} />)}
          </ol>
        </>
      )}
    </div>
  )
}
