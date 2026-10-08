import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProject, listDocuments } from '../api'
import { useStudio } from '../studio'
import { classifyLine, LINE_STYLES } from '../panels/Screenplay'
import { filmSeconds, photoUrl } from '../types'
import type { Panel, ProjectData, ProjectDocument } from '../types'

const SECTIONS: { id: string; label: string; panel: Panel }[] = [
  { id: 'story', label: 'Story', panel: 'story' },
  { id: 'characters', label: 'Characters', panel: 'characters' },
  { id: 'screenplay', label: 'Screenplay', panel: 'screenplay' },
  { id: 'dialogue', label: 'Dialogue', panel: 'dialogue' },
  { id: 'scenes', label: 'Scenes', panel: 'scenes' },
  { id: 'storyboard', label: 'Storyboard', panel: 'storyboard' },
]

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#71717a' },
  planned: { label: 'Planned', color: '#d4a84b' },
  generated: { label: 'Generated', color: '#8b7cf6' },
  rendered: { label: 'Rendered', color: '#10b981' },
}

const card = { backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }

function Section({ id, title, count, onEdit, children }: { id: string; title: string; count?: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section id={`section-${id}`} data-testid={`overview-${id}`} className="scroll-mt-28">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="flex items-baseline gap-3">
          <h3 className="text-xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>{title}</h3>
          {count && <span className="text-xs text-zinc-600">{count}</span>}
        </div>
        <button onClick={onEdit} className="text-xs whitespace-nowrap transition-opacity hover:opacity-80" style={{ color: '#d4a84b' }} aria-label={`Edit ${title} in the Director`}>
          Edit in Director →
        </button>
      </div>
      {children}
    </section>
  )
}

/** The whole film on one page: story, cast, screenplay, dialogue, scenes, storyboard and source files. */
export default function ProjectOverview() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { openProject } = useStudio()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [docs, setDocs] = useState<ProjectDocument[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setProject(null)
    setError(null)
    getProject(id)
      .then(p => alive && setProject(p))
      .catch(e => alive && setError(e instanceof Error ? e.message : 'Could not load the project.'))
    listDocuments(id).then(d => alive && setDocs(d)).catch(() => undefined)
    return () => { alive = false }
  }, [id])

  const openIn = (panel: Panel | 'chat') => {
    if (!project) return
    openProject(project)
    nav(panel === 'chat' ? '/director' : `/director/${panel}`)
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto">
        <p role="alert" className="text-sm text-red-300 mb-4">{error}</p>
        <button onClick={() => nav('/projects')} className="text-xs" style={{ color: '#d4a84b' }}>← All projects</button>
      </div>
    )
  }
  if (!project) return <p className="px-6 py-10 text-xs text-zinc-600" data-testid="overview-loading">Loading project…</p>

  const f = project.memory
  const status = STATUS[project.status] ?? { label: project.status, color: '#71717a' }
  const hero = f?.shots[0] ? photoUrl(f.shots[0], 1280, 540) : null

  return (
    <div className="pb-16" data-testid="project-overview">
      {/* Hero */}
      <div className="relative overflow-hidden border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {hero && <img src={hero} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.18, filter: 'grayscale(40%)' }} />}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #09090b 5%, rgba(9,9,11,0.6) 100%)' }} />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          <button onClick={() => nav('/projects')} className="text-xs text-zinc-500 hover:text-zinc-300 mb-6">← All projects</button>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${status.color}22`, color: status.color }}>{status.label}</span>
            {f?.genre && <span className="text-xs text-zinc-400">{f.genre}</span>}
            {f?.tone && <span className="text-xs text-zinc-600">· {f.tone}</span>}
          </div>
          <h2 className="text-3xl md:text-4xl font-light mb-3" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }} data-testid="overview-title">{project.title}</h2>
          {f?.logline && <p className="text-sm leading-relaxed text-zinc-300 max-w-2xl mb-5">{f.logline}</p>}
          {f && (
            <p className="text-xs text-zinc-500 mb-6" data-testid="overview-stats">
              {f.characters.length} characters · {f.scenes.length} scenes · {f.shots.length} shots · ~{filmSeconds(f)}s teaser{docs.length ? ` · ${docs.length} source ${docs.length === 1 ? 'file' : 'files'}` : ''}
            </p>
          )}
          <button
            onClick={() => openIn('chat')}
            className="px-5 py-2.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
          >
            Open in Director
          </button>
        </div>
      </div>

      {!f ? (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="px-6 py-12 rounded-xl text-center" style={{ ...card, borderStyle: 'dashed' }}>
            <p className="text-lg font-light mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Not planned yet</p>
            <p className="text-sm text-zinc-500 mb-5">Describe the idea to the AI Director and the story, cast, screenplay and storyboard appear here.</p>
            <button onClick={() => openIn('chat')} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>Continue in Director</button>
          </div>
        </div>
      ) : (
        <>
          {/* Section jump bar */}
          <nav aria-label="Project sections" className="sticky top-0 z-10 border-b backdrop-blur" style={{ backgroundColor: 'rgba(9,9,11,0.85)', borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto py-2">
              {[...SECTIONS.filter(s => s.id !== 'dialogue' || (f.dialogue?.length ?? 0) > 0), ...(docs.length ? [{ id: 'files', label: 'Source files' }] : [])].map(s => (
                <a key={s.id} href={`#section-${s.id}`} onClick={e => { e.preventDefault(); document.getElementById(`section-${s.id}`)?.scrollIntoView?.({ behavior: 'smooth' }) }}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 whitespace-nowrap">
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 space-y-14">
            <Section id="story" title="Story" onEdit={() => openIn('story')}>
              <div className="rounded-xl p-5 sm:p-7 space-y-4" style={card}>
                {f.story.split('\n\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="text-sm leading-7 text-zinc-300">{para}</p>
                ))}
              </div>
            </Section>

            <Section id="characters" title="Characters" count={`${f.characters.length}`} onEdit={() => openIn('characters')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {f.characters.map(c => (
                  <article key={c.id} className="rounded-xl overflow-hidden" style={card} data-testid="overview-character">
                    <div className="aspect-[4/3] bg-zinc-900">
                      <img src={photoUrl(c, 480, 360)} alt={c.name} className="w-full h-full object-cover" style={{ filter: 'grayscale(20%) contrast(1.05)' }} />
                    </div>
                    <div className="p-4 space-y-2">
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: '#f4f0ea' }}>{c.name}</h4>
                        <p className="text-xs text-zinc-500">{[c.role, c.age].filter(Boolean).join(' · ')}</p>
                      </div>
                      {c.personality && <p className="text-xs leading-relaxed text-zinc-400">{c.personality}</p>}
                      {c.arc && <p className="text-xs leading-relaxed text-zinc-500"><span className="text-zinc-400">Arc:</span> {c.arc}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </Section>

            <Section id="screenplay" title="Screenplay" onEdit={() => openIn('screenplay')}>
              <div className="screenplay-text rounded-xl px-5 sm:px-10 py-8 max-h-[640px] overflow-y-auto" style={{ ...card, lineHeight: '1.8' }} data-testid="overview-screenplay-text">
                {f.screenplay.split('\n').map((line, i) => (
                  <div key={i} style={{ lineHeight: '1.8', ...LINE_STYLES[classifyLine(line, i)] }}>{line || ' '}</div>
                ))}
              </div>
            </Section>

            {f.dialogue && f.dialogue.length > 0 && (
              <Section id="dialogue" title="Dialogue" count={`${f.dialogue.length} lines`} onEdit={() => openIn('dialogue')}>
                <div className="rounded-xl divide-y" style={{ ...card }}>
                  {f.dialogue.map((d, i) => (
                    <div key={i} className="px-5 py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <span className="text-xs font-semibold w-32 flex-shrink-0" style={{ color: '#d4a84b' }}>{d.character}</span>
                      <span className="text-sm text-zinc-300 flex-1">“{d.text.replace(/^"|"$/g, '')}”</span>
                      {d.tone && <span className="text-[10px] uppercase tracking-wider text-zinc-600">{d.tone}</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section id="scenes" title="Scenes" count={`${f.scenes.length}`} onEdit={() => openIn('scenes')}>
              <ol className="space-y-3">
                {f.scenes.map(s => (
                  <li key={s.id} className="rounded-xl p-4 flex gap-4" style={card} data-testid="overview-scene">
                    <span className="text-2xl font-light w-8 flex-shrink-0 text-zinc-700" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{s.number}</span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold tracking-wide" style={{ color: '#f4f0ea' }}>{s.location} — {s.time}</p>
                      <p className="text-sm leading-relaxed text-zinc-400">{s.description}</p>
                      <p className="text-xs text-zinc-600">{[s.mood, s.duration, s.characters.join(', ')].filter(Boolean).join(' · ')}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="storyboard" title="Storyboard" count={`${f.shots.length} shots`} onEdit={() => openIn('storyboard')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {f.shots.map(s => (
                  <figure key={s.id} className="rounded-xl overflow-hidden" style={card} data-testid="overview-shot">
                    <div className="relative aspect-video bg-zinc-900">
                      <img src={photoUrl(s, 640, 360)} alt={`Shot ${s.number}`} className="absolute inset-0 w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(9,9,11,0.75)', color: '#f4f0ea' }}>Shot {s.number} · {s.duration}</span>
                    </div>
                    <figcaption className="p-4 space-y-1">
                      <p className="text-xs text-zinc-500">{[s.camera, s.movement, s.mood].filter(Boolean).join(' · ')}</p>
                      <p className="text-sm leading-relaxed text-zinc-300">{s.description}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Section>

            {docs.length > 0 && (
              <section id="section-files" data-testid="overview-files" className="scroll-mt-28">
                <h3 className="text-xl font-light mb-4" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Source files</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {docs.map(d => (
                    <li key={d.id} className="rounded-xl p-4" style={card}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        {d.fileUrl ? <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-sm truncate hover:underline" style={{ color: '#f4f0ea' }}>{d.filename}</a>
                          : <span className="text-sm truncate" style={{ color: '#f4f0ea' }}>{d.filename}</span>}
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600 flex-shrink-0">{d.type}</span>
                      </div>
                      {d.preview && <p className="text-xs leading-relaxed text-zinc-500 line-clamp-3">{d.preview}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}
