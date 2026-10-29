import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFullFilm } from '../api'
import { useStudio } from '../studio'
import type { FullFilmText } from '../types'
import { duration } from '../screens/FullMovie'
import { classifyLine, LINE_STYLES } from '../panels/Screenplay'

export type FullFilmKind = 'screenplay' | 'dialogue' | 'scenes' | 'storyboard'

const BUSY = new Set(['planning', 'writing', 'generating', 'rendering'])
const gold = '#d4a84b'
const card = { backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }

// The creator's choice (Full film / Teaser) is kept while they move between sections
let chosenView: 'full' | 'teaser' = 'full'

/** The project's full-length film as text; refreshed every few seconds while it's still being written. */
export function useFullFilm(projectId: string | undefined): FullFilmText | null {
  const [film, setFilm] = useState<FullFilmText | null>(null)
  useEffect(() => {
    if (!projectId) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => getFullFilm(projectId).then(f => {
      if (!alive) return
      setFilm(f)
      if (f && (BUSY.has(f.status) || f.job)) timer = setTimeout(load, 4000)
    }).catch(() => {})
    void load()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [projectId])
  return film
}

function Progress({ film }: { film: FullFilmText }) {
  const written = film.scenes.filter(s => s.script).length
  const working = BUSY.has(film.status) || !!film.job
  if (!working && written === film.scenes.length) return null
  return (
    <p className="text-xs mb-4" style={{ color: gold }} data-testid="full-film-progress">
      {working ? `${film.job?.stage || 'Writing the full-length film'}… ` : ''}
      {film.scenes.length ? `${written}/${film.scenes.length} scene scripts written` : ''}
      {!working && written < film.scenes.length ? ' — open the full-length film to write the rest.' : ''}
    </p>
  )
}

function Heading({ title, film }: { title: string; film: FullFilmText }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: gold }}>Full-length film · {duration(film.targetSeconds)}</p>
      <h2 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>{title}</h2>
      <p className="text-sm text-zinc-500 mt-1">{film.scenes.length} scenes · {film.scenes.reduce((n, s) => n + s.shots.length, 0)} shots</p>
    </div>
  )
}

function FullView({ kind, film, onOpenScene }: { kind: FullFilmKind; film: FullFilmText; onOpenScene: () => void }) {
  const titles: Record<FullFilmKind, string> = { screenplay: 'Screenplay', dialogue: 'Dialogue', scenes: 'Scenes', storyboard: 'Storyboard' }
  const editLink = (
    <button type="button" onClick={onOpenScene} className="text-xs whitespace-nowrap" style={{ color: gold }}>Edit scenes →</button>
  )
  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid={`full-film-${kind}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-3"><Heading title={titles[kind]} film={film} />{editLink}</div>
        <Progress film={film} />
        {film.scenes.length === 0 && <p className="text-sm text-zinc-500">The scenes are being planned…</p>}

        {kind === 'scenes' && (
          <ol className="space-y-2">
            {film.scenes.map(sc => (
              <li key={sc.number} className="rounded-lg px-4 py-3" style={card}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-zinc-200"><span className="font-mono text-zinc-600 mr-2">{String(sc.number).padStart(2, '0')}</span>{sc.title}</p>
                  <span className="text-[11px] text-zinc-500 whitespace-nowrap">Act {sc.act} · {duration(sc.targetSeconds)}</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">{sc.location}{sc.characters.length ? ` · ${sc.characters.join(', ')}` : ''}</p>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{sc.summary}</p>
              </li>
            ))}
          </ol>
        )}

        {kind === 'screenplay' && film.scenes.map(sc => (
          <section key={sc.number} className="mb-8">
            <p className="text-[11px] font-mono text-zinc-600 mb-2">SCENE {sc.number} · {sc.title}</p>
            {sc.script ? (
              <div className="rounded-xl px-6 py-5 font-mono text-sm" style={card}>
                {sc.script.split('\n').map((line, i) => {
                  const kindOfLine = classifyLine(line, i)
                  return <p key={i} style={{ color: '#a1a1aa', fontSize: '13px', ...LINE_STYLES[kindOfLine] }}>{line || '\u00a0'}</p>
                })}
              </div>
            ) : <p className="text-xs text-zinc-600 italic">Not written yet — {sc.summary}</p>}
          </section>
        ))}

        {kind === 'dialogue' && film.scenes.map(sc => {
          const lines = sc.shots.flatMap(sh => sh.dialogue)
          return (
            <section key={sc.number} className="mb-6">
              <p className="text-[11px] font-mono text-zinc-600 mb-2">SCENE {sc.number} · {sc.title}</p>
              {lines.length ? (
                <div className="rounded-xl px-5 py-4 space-y-2" style={card}>
                  {lines.map((d, i) => (
                    <p key={i} className="text-sm"><span className="text-xs font-semibold mr-2" style={{ color: gold }}>{d.character}</span><span className="text-zinc-300">{d.text}</span></p>
                  ))}
                </div>
              ) : <p className="text-xs text-zinc-600 italic">{sc.script ? 'No dialogue in this scene.' : 'Not written yet.'}</p>}
            </section>
          )
        })}

        {kind === 'storyboard' && (
          <>
            <p className="text-xs text-zinc-500 mb-4">Every shot of the film. Frames are drawn when an image model is connected.</p>
            {film.scenes.map(sc => (
              <section key={sc.number} className="mb-6">
                <p className="text-[11px] font-mono text-zinc-600 mb-2">SCENE {sc.number} · {sc.title}</p>
                {sc.shots.length ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {sc.shots.map(sh => (
                      <div key={sh.id} className="rounded-lg px-4 py-3" style={card}>
                        <p className="text-[11px] text-zinc-500">Shot {sh.number} · {sh.camera} · {sh.movement} · {sh.seconds}s</p>
                        <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{sh.description}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-xs text-zinc-600 italic">Not written yet.</p>}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Wraps a Director section. When the film has a full-length version, the section shows it (with a switch back to
 * the teaser); otherwise it shows the section as before.
 */
export default function FullFilmGate({ kind, children }: { kind: FullFilmKind; children: ReactNode }) {
  const { project } = useStudio()
  const navigate = useNavigate()
  const film = useFullFilm(project?.id)
  const [view, setView] = useState(chosenView)
  if (!film || !project) return <>{children}</>
  const choose = (v: 'full' | 'teaser') => { chosenView = v; setView(v) }
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-4 sm:px-6 pt-3" role="tablist" aria-label="Which version">
        {(['full', 'teaser'] as const).map(v => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => choose(v)} data-testid={`view-${v}`}
            className="px-3 py-1.5 rounded-lg text-xs border transition-all"
            style={{ borderColor: view === v ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.08)', color: view === v ? gold : '#a1a1aa', backgroundColor: view === v ? 'rgba(212,168,75,0.07)' : 'transparent' }}>
            {v === 'full' ? `Full film · ${duration(film.targetSeconds)}` : 'Teaser'}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {view === 'full'
          ? <FullView kind={kind} film={film} onOpenScene={() => navigate(`/projects/${encodeURIComponent(project.id)}/movie`)} />
          : children}
      </div>
    </div>
  )
}
