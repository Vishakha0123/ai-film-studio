import { useState } from 'react'
import { FILM_PROJECT } from '../types'

const AI_ACTIONS = ['Continue', 'Rewrite', 'Add Scene', 'Add Dialogue', 'Improve', 'Shorten', 'Expand', 'Make Cinematic']

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

const LINE_STYLES: Record<LineKind, React.CSSProperties> = {
  title: { color: '#f4f0ea', fontWeight: '600', textAlign: 'center', fontSize: '15px' },
  heading: { color: '#f4f0ea', fontWeight: '600', marginTop: '24px', fontSize: '13px' },
  transition: { color: '#71717a', textAlign: 'right', marginTop: '16px' },
  character: { color: '#f4f0ea', fontWeight: '600', paddingLeft: '40%', marginTop: '16px', fontSize: '12px' },
  parenthetical: { color: '#71717a', paddingLeft: '30%', fontSize: '12px', fontStyle: 'italic' },
  blank: { color: 'transparent', minHeight: '12px', display: 'block' },
  action: { color: '#9ca3af' },
}

export default function Screenplay() {
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const lines = FILM_PROJECT.screenplay.split('\n')

  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="panel-screenplay">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b flex-shrink-0 overflow-x-auto sm:flex-wrap" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0e0e10' }}>
        <span className="text-xs text-zinc-600 mr-1 flex-shrink-0">AI Actions:</span>
        {AI_ACTIONS.map(a => (
          <button
            key={a}
            onClick={() => setActiveAction(activeAction === a ? null : a)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0 whitespace-nowrap"
            style={
              activeAction === a
                ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b' }
                : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.07)', color: '#71717a' }
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
                Echoes of the Forgotten
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-600">12 pages</p>
              <p className="text-xs text-zinc-700">Draft 1</p>
            </div>
          </div>

          <div className="screenplay-text px-5 sm:px-8 py-8 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)', lineHeight: '1.8' }}>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-all"
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
