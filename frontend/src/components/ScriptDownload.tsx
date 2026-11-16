import { useState } from 'react'
import { downloadFilmScript, downloadLongFilmScript } from '../api'

/** Save a downloaded file in the browser. */
export function saveBlob({ blob, filename }: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * "Download script: PDF · TXT". For the film shown in the sections (any length, a 1-minute short included),
 * or — with `full` — the full-length film's scene-by-scene screenplay.
 */
export default function ScriptDownload({ projectId, full = false }: { projectId: string; full?: boolean }) {
  const [busy, setBusy] = useState<'pdf' | 'txt' | null>(null)
  const [error, setError] = useState('')
  const testId = full ? 'full-script-download' : 'script-download'

  const get = (fmt: 'pdf' | 'txt') => {
    setBusy(fmt)
    setError('')
    void (full ? downloadLongFilmScript(projectId, fmt) : downloadFilmScript(projectId, fmt))
      .then(saveBlob)
      .catch(e => setError(e instanceof Error ? e.message : 'Download failed.'))
      .finally(() => setBusy(null))
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <span className="text-xs text-zinc-500 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5" aria-hidden>
          <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {full ? 'Download the full script' : 'Download script'}
      </span>
      {(['pdf', 'txt'] as const).map(fmt => (
        <button
          key={fmt}
          type="button"
          onClick={() => get(fmt)}
          disabled={!!busy}
          data-testid={`${testId}-${fmt}`}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:opacity-80 disabled:opacity-50"
          style={{ borderColor: 'rgba(212,168,75,0.35)', color: '#d4a84b', backgroundColor: 'rgba(212,168,75,0.06)' }}
        >
          {busy === fmt ? 'Preparing…' : fmt.toUpperCase()}
        </button>
      ))}
      {error && <p role="alert" className="w-full text-xs text-red-300">{error}</p>}
    </div>
  )
}
