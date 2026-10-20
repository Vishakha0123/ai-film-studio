import { useState } from 'react'
import { DEMO_MODE, approveStep, assertCompleted, editProject, waitForJob, type EditAction } from '../api'
import { useFilm, useStudio } from '../studio'
import { useFilmEdit } from '../lib/useFilmEdit'
import DirectAI, { EditButton, SaveCancel, fieldCls } from '../components/DirectAI'

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
  const edit = useFilmEdit()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ logline: '', tone: '', story: '' })
  const startEdit = () => {
    setDraft({ logline: f.logline, tone: f.tone, story: f.story })
    setEditing(true)
  }
  const saveEdit = async () => {
    if (await edit.save('Saving your story…', { logline: draft.logline.trim(), tone: draft.tone.trim(), story: draft.story.trim() })) {
      setEditing(false)
      setAccepted(false)
    }
  }

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
          <div className="flex items-center gap-2 flex-shrink-0">
          {!editing && <EditButton onClick={startEdit} />}
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

        {editing ? (
          <div className="px-5 py-5 rounded-xl space-y-4" style={{ backgroundColor: '#111113', border: '1px solid rgba(212,168,75,0.25)' }} data-testid="story-edit">
            <label className="block">
              <span className="text-xs text-zinc-500">Logline</span>
              <textarea aria-label="Logline" rows={2} value={draft.logline} onChange={e => setDraft(d => ({ ...d, logline: e.target.value }))} className={`${fieldCls} mt-1 resize-y`} />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500">Tone</span>
              <input aria-label="Tone" value={draft.tone} onChange={e => setDraft(d => ({ ...d, tone: e.target.value }))} className={`${fieldCls} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-500">Story <span className="text-zinc-700">(leave a blank line between paragraphs)</span></span>
              <textarea aria-label="Story text" rows={12} value={draft.story} onChange={e => setDraft(d => ({ ...d, story: e.target.value }))} className={`${fieldCls} mt-1 resize-y leading-relaxed`} />
            </label>
            <SaveCancel onSave={() => void saveEdit()} onCancel={() => setEditing(false)} saving={!!edit.working} saveLabel="Save story" />
            {edit.error && <p role="alert" className="text-xs text-red-300">{edit.error}</p>}
          </div>
        ) : (
          <>
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
          </>
        )}

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

        <DirectAI
          target="story"
          appliesTo="changes the whole story"
          suggestions={['Make it more mysterious', 'Set it in Mumbai', 'Add a twist', 'Give it a happy ending']}
          placeholder='Try "Set it in Tokyo" or "Make the hero a woman"'
          onDone={() => setAccepted(false)}
        />
      </div>
    </div>
  )
}
