import type { Panel } from './types'

/**
 * Features that are built but not released yet. They show a lock and "Coming soon".
 *
 * To unlock everything (local testing, or when they're ready), set in frontend/.env:
 *   VITE_UNLOCK_PREVIEW=true
 * To release one for good, remove it from the lists below.
 */
const LOCKED_PANELS: Panel[] = ['audio', 'music']
const TEASER_LOCKED = true

const unlocked = () => import.meta.env.VITE_UNLOCK_PREVIEW === 'true'

export const isPanelLocked = (p: Panel) => !unlocked() && LOCKED_PANELS.includes(p)
/** Generate Teaser, plus the screens behind it (generation progress, teaser player, export). */
export const isTeaserLocked = () => !unlocked() && TEASER_LOCKED

export const COMING_SOON = 'Coming soon'
