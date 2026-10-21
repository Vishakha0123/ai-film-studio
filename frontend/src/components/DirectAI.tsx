import { useState } from 'react'
import type { EditAction, EditScope } from '../api'
import { useFilmEdit, type EditTarget } from '../lib/useFilmEdit'

interface Props {
  /** Which part of the film the AI changes */
  target: EditTarget
  /** Shown after "Direct the AI —", e.g. "applies to the whole story" */
  appliesTo: string
  suggestions: string[]
  placeholder: string
  /** Narrows the change (a selected passage or one item) */
  scope?: EditScope
  /** Extra context added to the instruction (e.g. which scene is open) */
  context?: string
  action?: EditAction
  onDone?: () => void
}

/** "Direct the AI" box — type what to change in this section in plain words (any language) and Apply. */
export default function DirectAI({ target, appliesTo, suggestions, placeholder, scope = {}, context = '', action = 'transform', onDone }: Props) {
  const { working, error, ai } = useFilmEdit()
  const [command, setCommand] = useState('')

  const apply = async () => {
    const text = command.trim()
    if (!text) return
    const ok = await ai('Applying your direction…', target, action, context ? `${text}\n\n${context}` : text, scope)
    if (ok) {
      setCommand('')
      onDone?.()
    }
  }

  return (
    <div data-testid={`direct-ai-${target}`}>
      <p className="text-xs text-zinc-600 mb-3">
        Direct the AI <span style={{ color: '#71717a' }}>— {appliesTo}</span>
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {suggestions.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setCommand(s)}
            className="text-xs px-3 py-1.5 rounded-full border transition-all"
            style={{
              borderColor: command === s ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)',
              color: command === s ? '#d4a84b' : '#a1a1aa',
              backgroundColor: command === s ? 'rgba(212,168,75,0.07)' : 'transparent',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={e => { e.preventDefault(); void apply() }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border"
        style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <input
          type="text"
          aria-label="Direct the AI"
          placeholder={placeholder}
          value={command}
          onChange={e => setCommand(e.target.value)}
          disabled={!!working}
          className="flex-1 min-w-0 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none disabled:opacity-60"
        />
        <button type="submit" disabled={!command.trim() || !!working} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
          {working ? 'Working…' : 'Apply'}
        </button>
      </form>
      {working && <p className="mt-2 text-xs" style={{ color: '#d4a84b' }} data-testid="direct-ai-working">{working}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}

/** Small "Edit" pencil button used at the top of each section. */
export function EditButton({ onClick, label = 'Edit', ariaLabel, disabled }: { onClick: () => void; label?: string; ariaLabel?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:text-zinc-200 disabled:opacity-50 flex-shrink-0"
      style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a1a1aa' }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  )
}

export const fieldCls = 'w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-600'

/** Save / Cancel row for hand edits. */
export function SaveCancel({ onSave, onCancel, saving, saveLabel = 'Save' }: { onSave: () => void; onCancel: () => void; saving?: boolean; saveLabel?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
        {saving ? 'Saving…' : saveLabel}
      </button>
      <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200">
        Cancel
      </button>
    </div>
  )
}
