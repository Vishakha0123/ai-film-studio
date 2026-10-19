import { useEffect, useRef, useState } from 'react'
import { useFilm } from '../studio'
import { useFilmEdit } from '../lib/useFilmEdit'
import type { EditAction } from '../api'

/** What each AI action asks the story model to do (it keeps the film's language and format). */
const AI_ACTIONS: Record<string, { action: EditAction; instruction: string }> = {
  Continue: { action: 'continue', instruction: 'Continue the screenplay with the next scene, in proper screenplay format.' },
  Rewrite: { action: 'transform', instruction: 'Rewrite with fresh wording, keeping the same events, characters and format.' },
  'Add Scene': { action: 'continue', instruction: 'Add one new scene that fits the story where it belongs, in proper screenplay format.' },
  'Add Dialogue': { action: 'improve', instruction: 'Add dialogue where the characters would naturally speak, with character names in caps and parentheticals where useful.' },
  Improve: { action: 'improve', instruction: 'Improve the writing: sharper action lines, stronger dialogue, better pacing. Keep the events.' },
  Shorten: { action: 'improve', instruction: 'Make it shorter and tighter, keeping every important beat.' },
  Expand: { action: 'improve', instruction: 'Expand it with more detail in the action lines and a little more dialogue.' },
  'Make Cinematic': { action: 'improve', instruction: 'Make it more cinematic: vivid visual action lines, camera-aware moments, mood and sound cues.' },
}

export type LineKind = 'title' | 'heading' | 'transition' | 'character' | 'parenthetical' | 'blank' | 'action'

/** Classifies a screenplay line so it can be formatted in proper screenplay layout. */
export function classifyLine(line: string, i: number): LineKind {
  const trimmed = line.trim()
  if (trimmed === '') return 'blank'
  if (i === 0 && line.toUpperCase() === line) return 'title'
  if (/^(EXT\.|INT\.|EXT\/INT\.)/.test(line)) return 'heading'
  if (/^(FADE IN:|FADE OUT|FADE TO BLACK|CUT TO:|SMASH CUT TO)/.test(line)) return 'transition'
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return 'parenthetical'
  if (line === line.toUpperCase() && trimmed.length < 40 && i > 0) return 'character'
  return 'action'
}

export const LINE_STYLES: Record<LineKind, React.CSSProperties> = {
  title: { color: '#f4f0ea', fontWeight: '600', textAlign: 'center', fontSize: '15px' },
  heading: { color: '#f4f0ea', fontWeight: '600', marginTop: '24px', fontSize: '13px' },
  transition: { color: '#71717a', textAlign: 'right', marginTop: '16px' },
  character: { color: '#f4f0ea', fontWeight: '600', paddingLeft: '40%', marginTop: '16px', fontSize: '12px' },
  parenthetical: { color: '#71717a', paddingLeft: '30%', fontSize: '12px', fontStyle: 'italic' },
  blank: { color: 'transparent', minHeight: '12px', display: 'block' },
  action: { color: '#9ca3af' },
}

export default function Screenplay() {
  const film = useFilm()
  const lines = film.screenplay.split('\n')
  const { working, error, ai } = useFilmEdit()
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [draft, setDraft] = useState(1)
  const [selection, setSelection] = useState('')
  const textRef = useRef<HTMLDivElement>(null)
  const pages = Math.max(1, Math.round(lines.length / 55))

  // Text selected inside the screenplay narrows the next action to that passage.
  // (mouse, keyboard or touch — any selection change inside the script counts; clicking a button keeps it)
  useEffect(() => {
    const capture = () => {
      const sel = window.getSelection?.()
      const text = sel?.toString().trim() ?? ''
      if (text && sel?.anchorNode && textRef.current?.contains(sel.anchorNode)) setSelection(text.replace(/\u00a0/g, '').slice(0, 4000))
    }
    document.addEventListener('selectionchange', capture)
    return () => document.removeEventListener('selectionchange', capture)
  }, [])

  const run = async (name: string) => {
    const req = AI_ACTIONS[name]
    setActiveAction(name)
    // A selection is sent as the passage: the AI rewrites only that part (much faster than the whole script).
    const ok = await ai(`${name}…`, 'screenplay', req.action, req.instruction, selection ? { passage: selection } : {})
    if (ok) {
      setDraft(d => d + 1)
      setSelection('')
    }
    setActiveAction(null)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="panel-screenplay">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b flex-shrink-0 overflow-x-auto sm:flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0e0e10' }}>
        <span className="text-xs text-zinc-600 mr-1 flex-shrink-0">AI Actions:</span>
        {Object.keys(AI_ACTIONS).map(a => (
          <button
            key={a}
            onClick={() => void run(a)}
            disabled={!!working}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0 whitespace-nowrap hover:text-zinc-200 disabled:opacity-50"
            style={
              activeAction === a
                ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b' }
                : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.07)', color: '#a1a1aa' }
            }
          >
            {a}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#d4a84b' }}>Screenplay</p>
              <h2 className="text-xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
                {film.title}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-600">{pages} {pages === 1 ? 'page' : 'pages'}</p>
              <p className="text-xs text-zinc-700" data-testid="screenplay-draft">Draft {draft}</p>
            </div>
          </div>

          {selection && (
            <div className="mb-3 flex items-start gap-3 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: 'rgba(212,168,75,0.06)', border: '1px solid rgba(212,168,75,0.25)' }} data-testid="screenplay-selection">
              <span className="flex-1 min-w-0 text-zinc-300">
                <span style={{ color: '#d4a84b' }}>Selected:</span> “{selection.length > 140 ? `${selection.slice(0, 140)}…` : selection}” — the next AI action changes only this part.
              </span>
              <button onClick={() => setSelection('')} aria-label="Clear selection" className="text-zinc-500 hover:text-zinc-200">✕</button>
            </div>
          )}
          {working && <p className="mb-3 text-xs" style={{ color: '#d4a84b' }} data-testid="screenplay-working">{working}</p>}
          {error && <p role="alert" className="mb-3 text-xs text-red-300">{error}</p>}

          <div
            ref={textRef}
            className="screenplay-text px-5 sm:px-8 py-8 rounded-xl transition-opacity"
            style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)', lineHeight: '1.8', opacity: working ? 0.5 : 1 }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                data-kind={classifyLine(line, i)}
                className="transition-colors hover:bg-zinc-800/20 rounded px-1 -mx-1 cursor-text"
                style={{ lineHeight: '1.8', ...LINE_STYLES[classifyLine(line, i)] }}
              >
                {line || ' '}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void run('Continue')}
              disabled={!!working}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
              style={{ borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b', backgroundColor: 'rgba(212,168,75,0.06)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
              Continue Screenplay
            </button>
            <p className="text-xs text-zinc-700">Select any text to apply AI actions to that section</p>
          </div>
        </div>
      </div>
    </div>
  )
}
