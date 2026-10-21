/**
 * Shown where a character has no real portrait yet. Deliberately not a face: no drawing, avatar, emoji or
 * stand-in photo — just a clear "no portrait yet" frame.
 */
export function NoPortrait({ size, label }: { size: 'chip' | 'large'; label: string }) {
  if (size === 'chip') {
    return (
      <span className="w-10 h-10 rounded-full border border-dashed flex items-center justify-center flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.15)' }}
        role="img" aria-label={`${label}: no portrait yet`} data-testid="no-portrait">
        <CameraIcon className="w-4 h-4" />
      </span>
    )
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center" role="img" aria-label={`${label}: no portrait yet`} data-testid="no-portrait">
      <CameraIcon className="w-9 h-9" />
      <p className="text-xs text-zinc-500">No portrait yet</p>
    </div>
  )
}

/** The demo film's sample photos are stock photos — say so, so they're never mistaken for AI portraits. */
export function StockBadge() {
  return (
    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'rgba(9,9,11,0.8)', color: '#fbbf24' }} data-testid="stock-badge">
      Stock sample photo
    </span>
  )
}

function CameraIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

/**
 * A storyboard shot that has no frame yet. Not a picture of the shot: a tinted card in the chosen visual style
 * with the shot's own description and the portraits of the characters in it.
 */
export function NoFrame({ tint, styleName, children }: { tint: string; styleName?: string; children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0 transition-[background] duration-500" style={{ background: tint }} data-testid="no-frame" role="img" aria-label="No frame yet">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pb-8">
        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" className="w-7 h-7" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M7 5v4M12 5v4M17 5v4" />
        </svg>
        <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>No frame yet</p>
        {styleName && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Drawn in {styleName} when frames are generated</p>}
      </div>
      {children}
    </div>
  )
}
