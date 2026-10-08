import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_MODE, deleteProject, listProjects, renameProject } from '../api'
import { useStudio } from '../studio'
import type { ProjectSummary } from '../types'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#71717a' },
  planned: { label: 'Planned', color: '#d4a84b' },
  generated: { label: 'Generated', color: '#8b7cf6' },
  rendered: { label: 'Rendered', color: '#10b981' },
}

const FALLBACK_STILL = 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=640&h=360&fit=crop&auto=format&q=70'

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { project: current, openProject, newFilm } = useStudio()
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    listProjects().then(setProjects).catch(e => setError(e instanceof Error ? e.message : 'Could not load projects.'))
  }, [])

  useEffect(load, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (projects ?? []).filter(p => !q || `${p.title} ${p.genre} ${p.logline}`.toLowerCase().includes(q))
  }, [projects, query])

  // Opening a project shows the whole film; "Open in Director" there continues editing.
  const open = (id: string) => navigate(`/projects/${encodeURIComponent(id)}`)

  const saveTitle = async (id: string) => {
    const title = draftTitle.trim()
    setRenaming(null)
    if (!title) return
    setBusy(id)
    try {
      const updated = await renameProject(id, title)
      setProjects(ps => ps?.map(p => (p.id === id ? { ...p, title: updated.title } : p)) ?? null)
      if (current?.id === id) openProject({ ...current, title: updated.title, memory: updated.memory ?? current.memory })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not rename the project.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (id: string) => {
    setConfirmDelete(null)
    setBusy(id)
    try {
      await deleteProject(id)
      setProjects(ps => ps?.filter(p => p.id !== id) ?? null)
      if (current?.id === id) newFilm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the project.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Your Studio</p>
            <h2 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Projects</h2>
            <p className="text-sm text-zinc-500 mt-1">
              {projects ? `${projects.length} ${projects.length === 1 ? 'film' : 'films'}` : 'Loading…'}
              {DEMO_MODE && ' · Demo mode shows the sample film'}
            </p>
          </div>
          <button
            onClick={() => navigate('/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            New Film
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border max-w-md" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0"><path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" /></svg>
          <input
            type="search"
            aria-label="Search projects"
            placeholder="Search by title, genre or logline"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        {projects && projects.length === 0 && (
          <div className="px-6 py-14 rounded-xl text-center" style={{ backgroundColor: '#111113', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <p className="text-lg font-light mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>No films yet</p>
            <p className="text-sm text-zinc-500 mb-5">Describe an idea to the AI Director and your first project appears here.</p>
            <button onClick={() => navigate('/new')} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
              Start a film
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="project-grid">
          {visible.map(p => {
            const status = STATUS_LABEL[p.status] ?? { label: p.status, color: '#71717a' }
            const isCurrent = current?.id === p.id
            return (
              <article
                key={p.id}
                data-testid="project-card"
                className="rounded-xl overflow-hidden border flex flex-col transition-all"
                style={{ backgroundColor: '#111113', borderColor: isCurrent ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)' }}
              >
                <button onClick={() => open(p.id)} className="relative aspect-video bg-zinc-900 text-left" aria-label={`Open ${p.title}`}>
                  <img src={p.thumbnailUrl ?? FALLBACK_STILL} alt="" className="w-full h-full object-cover" style={{ filter: 'grayscale(30%) contrast(1.1)', opacity: 0.85 }} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(9,9,11,0.85) 0%, transparent 60%)' }} />
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${status.color}22`, color: status.color }}>
                    {status.label}
                  </span>
                  {isCurrent && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(212,168,75,0.15)', color: '#d4a84b' }}>
                      Open now
                    </span>
                  )}
                </button>

                <div className="px-4 py-3 flex-1 flex flex-col gap-2">
                  {renaming === p.id ? (
                    <form onSubmit={e => { e.preventDefault(); void saveTitle(p.id) }} className="flex gap-2">
                      <input
                        autoFocus
                        aria-label="Project title"
                        value={draftTitle}
                        onChange={e => setDraftTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Escape' && setRenaming(null)}
                        maxLength={300}
                        className="flex-1 min-w-0 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-700 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                      />
                      <button type="submit" className="text-xs px-2 rounded-md" style={{ color: '#d4a84b' }}>Save</button>
                    </form>
                  ) : (
                    <h3 className="text-base font-medium leading-snug" style={{ color: '#f4f0ea', fontFamily: 'Fraunces, Georgia, serif' }}>{p.title}</h3>
                  )}
                  <p className="text-xs text-zinc-500">{p.genre || 'No genre yet'} · {p.assetCount} assets · {timeAgo(p.updatedAt)}</p>
                  {p.logline && <p className="text-xs leading-relaxed text-zinc-400 line-clamp-2">{p.logline}</p>}

                  <div className="mt-auto pt-2 flex items-center gap-2">
                    <button
                      onClick={() => open(p.id)}
                      disabled={busy === p.id}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80 disabled:opacity-50"
                      style={{ borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b', backgroundColor: 'rgba(212,168,75,0.07)' }}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => { setRenaming(p.id); setDraftTitle(p.title) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
                      style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}
                    >
                      Rename
                    </button>
                    {!DEMO_MODE && (confirmDelete === p.id ? (
                      <button onClick={() => remove(p.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                        Confirm delete
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(p.id)}
                        aria-label={`Delete ${p.title}`}
                        className="px-2.5 py-1.5 rounded-lg text-xs border transition-all hover:text-red-400"
                        style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
