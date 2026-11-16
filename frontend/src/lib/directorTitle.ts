/** "Vishakha's AI Director" when the creator set a display name in Settings, else "AI Director". */
export function directorTitle(displayName?: string): string {
  const first = (displayName ?? '').trim().split(/\s+/)[0]
  return first ? `${first}’s AI Director` : 'AI Director'
}
