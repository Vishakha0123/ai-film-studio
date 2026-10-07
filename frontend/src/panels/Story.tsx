import { useState } from 'react'
import { DEMO_MODE, approveStep, assertCompleted, editProject, waitForJob, type EditAction } from '../api'
import { useFilm, useStudio } from '../studio'

const ACTIONS = ['Accept', 'Rewrite', 'Continue', 'Make Darker', 'Change Ending', 'Regenerate']

/** What each AI action asks the backend to do to the story. */
const ACTION_REQUESTS: Record<string, { action: EditAction; instruction: string }> = {
  Rewrite: { action: 'transform', instruction: 'Rewrite the story with fresh wording, keeping the same events and characters.' },
  Continue: { action: 'continue', instruction: 'Continue the story with one more paragraph.' },
  'Make Darker': { action: 'improve', instruction: 'Make the story darker and more unsettling.' },
  'Change Ending': { action: 'transform', instruction: 'Change the ending to a different, surprising one.' },
  Regenerate: { action: 'transform', instruction: 'Write a completely new version of the story for the same idea.' },
}

export default function Story() {
  const [accepted, setAccepted] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { project, refreshProject } = useStudio()

  const handleAction = async (action: string) => {
    setActiveAction(action)
    setError(null)
    if (action === 'Accept') {
      setAccepted(true)
      if (project) await approveStep(project.id, 'story').catch(() => undefined)
      return
    }
    if (DEMO_MODE || !project) return
    const req = ACTION_REQUESTS[action]
    setWorking(true)
    try {
      assertCompleted(await waitForJob(await editProject(project.id, req.action, 'story', req.instruction)))
      await refreshProject()
      setAccepted(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The story could not be updated.')
    } finally {
      setWorking(false)
    }
  }

  const f = useFilm()

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-story">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>AI Generated Story</p>
            <h2 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
              {f.title}
            </h2>
          </div>
          {accepted && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Accepted
            </div>
          )}
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Genre', value: f.genre },
            { label: 'Tone', value: f.tone },
            { label: 'Duration', value: '10 seconds' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-xs text-zinc-600">{m.label}</span>
              <span className="text-xs font-medium" style={{ color: '#d4d4d8' }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Logline */}
        <div className="px-5 py-4 rounded-xl" style={{ backgroundColor: 'rgba(212,168,75,0.06)', border: '1px solid rgba(212,168,75,0.15)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Logline</p>
          <p className="text-sm leading-relaxed italic" style={{ color: '#e4e0da' }}>{f.logline}</p>
        </div>

        {/* Story */}
        <div className="px-5 py-5 rounded-xl space-y-4" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#52525b' }}>Story</p>
          {f.story.split('\n\n').map((para, i) => (
            <p key={i} className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{para}</p>
          ))}
        </div>

        {/* Action buttons */}
        <div>
          <p className="text-xs text-zinc-600 mb-3">AI Actions</p>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map(action => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                disabled={working}
                className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80"
                style={
                  activeAction === action && action === 'Accept'
                    ? { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' }
                    : activeAction === action
                    ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b' }
                    : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }
                }
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {working && <p className="text-xs" style={{ color: '#d4a84b' }} data-testid="story-working">Revising the story…</p>}
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

        {/* Edit via chat */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" className="w-4 h-4 flex-shrink-0">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs text-zinc-600">All content editable via chat — "Make it more mysterious", "Set it in Tokyo", "Add a twist"</p>
        </div>
      </div>
    </div>
  )
}
