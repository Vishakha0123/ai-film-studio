import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEMO_MODE, assertCompleted, listAssets, listProjects, regenerateAsset, waitForJob } from '../api'
import { useStudio } from '../studio'
import type { AssetListItem, ProjectSummary } from '../types'

const TYPES: { id: string; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'character_image', label: 'Portraits' },
  { id: 'storyboard_image', label: 'Storyboard' },
  { id: 'video_clip', label: 'Video' },
  { id: 'voice', label: 'Voice' },
  { id: 'render', label: 'Teasers' },
]

const TYPE_LABEL: Record<string, string> = {
  character_image: 'Portrait',
  storyboard_image: 'Frame',
  video_clip: 'Clip',
  voice: 'Voice',
  render: 'Teaser',
}

function refLabel(a: AssetListItem): string {
  if (a.type === 'storyboard_image' || a.type === 'video_clip') return `Shot ${a.ref}`
  if (a.type === 'character_image') return String(a.meta?.name ?? `Character ${a.ref}`)
  if (a.type === 'voice') return String(a.meta?.character ?? `Line ${a.ref}`)
  if (a.type === 'render') return String(a.ref).replace('-', ' · ')
  return a.ref
}

function Preview({ asset }: { asset: AssetListItem }) {
  if (asset.type === 'video_clip' || asset.type === 'render') {
    return <video src={asset.url} controls preload="metadata" className="absolute inset-0 w-full h-full object-cover bg-black" />
  }
  if (asset.type === 'voice') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4" style={{ background: 'radial-gradient(ellipse at center, rgba(139,124,246,0.12), transparent 70%)' }}>
        <p className="text-xs italic text-zinc-400 text-center line-clamp-2" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>
          {asset.meta?.text ? `"${String(asset.meta.text)}"` : 'Voice line'}
        </p>
        <audio src={asset.url} controls preload="none" className="w-full h-8" />
      </div>
    )
  }
  return <img src={asset.url} alt={refLabel(asset)} className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'grayscale(20%) contrast(1.1)' }} />
}

export default function AssetsPage() {
  const { project: current, refreshProject } = useStudio()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectId, setProjectId] = useState<string>('')
  const [type, setType] = useState('')
  const [assets, setAssets] = useState<AssetListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => {
    listProjects().then(setProjects).catch(() => undefined)
  }, [])

  const load = useCallback(() => {
    setError(null)
    listAssets({ projectId: projectId || undefined, type: type || undefined })
      .then(setAssets)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load assets.'))
  }, [projectId, type])

  useEffect(load, [load])

  const counts = useMemo(() => {
    const ready = assets?.filter(a => a.status === 'ready').length ?? 0
    return { ready, outdated: (assets?.length ?? 0) - ready }
  }, [assets])

  const regenerate = async (a: AssetListItem) => {
    setWorking(a.id)
    setError(null)
    try {
      assertCompleted(await waitForJob(await regenerateAsset(a.id)))
      load()
      if (current?.id === a.projectId) await refreshProject()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not regenerate this asset.')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Asset Library</p>
          <h2 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Assets</h2>
          <p className="text-sm text-zinc-500 mt-1" data-testid="asset-count">
            {assets ? `${counts.ready} ready${counts.outdated ? ` · ${counts.outdated} outdated` : ''}` : 'Loading…'}
            {DEMO_MODE && ' · Demo mode shows the sample stills'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}>
            <span className="text-xs text-zinc-600">Project</span>
            <select
              aria-label="Filter by project"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer max-w-[220px]"
            >
              <option value="" className="bg-zinc-900">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id} className="bg-zinc-900">{p.title}</option>)}
            </select>
          </label>
          <div role="tablist" className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
            {TYPES.map(t => (
              <button
                key={t.id || 'all'}
                role="tab"
                aria-selected={type === t.id}
                onClick={() => setType(t.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: type === t.id ? 'rgba(255,255,255,0.07)' : 'transparent', color: type === t.id ? '#f4f0ea' : '#71717a' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

        {assets && assets.length === 0 && (
          <div className="px-6 py-14 rounded-xl text-center" style={{ backgroundColor: '#111113', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <p className="text-lg font-light mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Nothing here yet</p>
            <p className="text-sm text-zinc-500">Portraits, storyboard frames, clips, voice lines and rendered teasers appear here once you generate a teaser.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="asset-grid">
          {assets?.map(a => (
            <article key={a.id} data-testid="asset-card" data-type={a.type} className="rounded-xl overflow-hidden border flex flex-col" style={{ backgroundColor: '#111113', borderColor: a.status === 'outdated' ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.07)' }}>
              <div className="relative bg-zinc-900 aspect-video overflow-hidden">
                <Preview asset={a} />
                <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(9,9,11,0.8)', color: '#a1a1aa' }}>
                  {TYPE_LABEL[a.type] ?? a.type}
                </span>
                {a.status === 'outdated' && (
                  <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24' }} title="Something it depends on changed — regenerate to update it">
                    Outdated
                  </span>
                )}
              </div>
              <div className="px-4 py-3 flex flex-col gap-1 flex-1">
                <p className="text-sm font-medium text-zinc-200">{refLabel(a)}</p>
                <p className="text-[11px] text-zinc-600">{a.projectTitle} · v{a.version} · {a.provider}</p>
                <div className="mt-auto pt-3 flex gap-2">
                  {!DEMO_MODE && a.type !== 'render' && (
                    <button
                      onClick={() => regenerate(a)}
                      disabled={working !== null}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80 disabled:opacity-40"
                      style={{ borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b', backgroundColor: 'rgba(212,168,75,0.07)' }}
                    >
                      {working === a.id ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  )}
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium border text-center transition-all hover:opacity-80"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}
                  >
                    Download
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
