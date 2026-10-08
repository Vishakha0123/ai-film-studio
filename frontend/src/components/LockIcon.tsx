export default function LockIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden data-testid="lock-icon">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 118 0v3" strokeLinecap="round" />
    </svg>
  )
}

/** Stand-in for an action that isn't released yet: greyed out, a lock, and "Soon". */
export function ComingSoonButton({ label, className = 'px-6 py-2.5 text-sm', testId }: { label: string; className?: string; testId?: string }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      title={`${label} — Coming soon`}
      data-testid={testId}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold cursor-not-allowed whitespace-nowrap ${className}`}
      style={{ backgroundColor: '#18181b', color: '#71717a', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <LockIcon />
      {label}
      <span className="text-[9px] uppercase tracking-wider text-zinc-600">Soon</span>
    </button>
  )
}
