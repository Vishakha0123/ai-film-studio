import { useEffect, useRef, useState } from 'react'
import { DEMO } from '../../demo'

const GOLD = '#d4a84b'

/**
 * "Watch Demo": a one-minute recording of the app in a player over the page, with a caption for each step and
 * chapter buttons that jump to it.
 */
export default function DemoVideo({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [time, setTime] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) video.current?.pause()
  }, [open])

  if (!open) return null
  const chapterAt = (t: number) => DEMO.chapters.reduce((cur, c, i) => (t >= c.start ? i : cur), 0)
  const current = chapterAt(time)
  const seek = (start: number) => {
    const v = video.current
    if (!v) return
    v.currentTime = start
    setTime(start)
    void v.play().catch(() => undefined)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
      onClick={onClose} data-testid="demo-modal" role="dialog" aria-modal="true" aria-label="Product demo">
      <div className="w-full max-w-5xl rounded-2xl overflow-hidden border border-zinc-800" style={{ backgroundColor: '#111113' }} onClick={e => e.stopPropagation()}>
        <div className="relative bg-black">
          {failed ? (
            <div className="aspect-video flex items-center justify-center text-sm text-zinc-400" data-testid="demo-missing">The demo video couldn’t load.</div>
          ) : (
            <video
              ref={video}
              src={DEMO.src}
              poster={DEMO.poster}
              className="w-full aspect-video block"
              controls
              autoPlay
              playsInline
              preload="metadata"
              onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
              onError={() => setFailed(true)}
              data-testid="demo-video"
            />
          )}
          {!failed && (
            <p className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-14 sm:bottom-16 px-4 py-2 rounded-md text-sm sm:text-base text-white text-center max-w-[90%]"
              style={{ backgroundColor: 'rgba(0,0,0,0.72)' }} data-testid="demo-caption" aria-live="polite">
              {current + 1} · {DEMO.chapters[current].caption}
            </p>
          )}
          <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close demo"
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-zinc-200 hover:text-white"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} data-testid="demo-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-t border-zinc-800">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Chapters">
            {DEMO.chapters.map((c, i) => (
              <button key={c.label} type="button" onClick={() => seek(c.start)} aria-pressed={i === current}
                className="text-xs px-3 py-1 rounded-full border transition-all"
                style={i === current ? { borderColor: GOLD, color: GOLD } : { borderColor: '#27272a', color: '#a1a1aa' }}
                data-testid={`demo-chapter-${i + 1}`}>
                {i + 1} {c.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onStart} className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90" style={{ backgroundColor: GOLD, color: '#09090b' }} data-testid="demo-try">
            Try it free →
          </button>
        </div>
      </div>
    </div>
  )
}
