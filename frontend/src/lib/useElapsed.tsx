import { useEffect, useRef, useState } from 'react'

/** "8s", "1m 05s", "1h 02m" — how long something took or has been running. */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/**
 * Milliseconds since `active` became true (or since `since`, e.g. when a server job started), ticking every second;
 * 0 while inactive. Like the "Thinking… 12s" timer in Claude.
 */
export function useElapsed(active: boolean, since?: string | number | null): number {
  const start = useRef<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  if (active && start.current === null) start.current = since ? new Date(since).getTime() : Date.now()
  if (!active) start.current = null
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return active && start.current !== null ? Math.max(0, now - start.current) : 0
}

/** A live "· 12s" counter while something is working. */
export function Elapsed({ active, since, className = '' }: { active: boolean; since?: string | number | null; className?: string }) {
  const ms = useElapsed(active, since)
  if (!active) return null
  return <span className={`tabular-nums ${className}`} data-testid="elapsed">{formatElapsed(ms)}</span>
}
