import { useEffect, useState } from 'react'
import { DEMO_MODE, assertCompleted, editProject, waitForJob, type EditAction } from '../api'
import { useFilm, useStudio } from '../studio'
import type { Lyrics as LyricsData } from '../types'

const SECTIONS = ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge'] as const
type Section = typeof SECTIONS[number]

/** What each AI action asks the story model to do to the song (it keeps the film's language). */
const ACTIONS: Record<string, { action: EditAction; instruction: string }> = {
  'Complete Lyrics': { action: 'continue', instruction: 'Complete the song: make sure the verse, pre-chorus, chorus and bridge are all full and finished.' },
  'Improve Rhyme': { action: 'improve', instruction: 'Improve the rhyme and rhythm of the song while keeping its meaning.' },
  'Increase Emotion': { action: 'improve', instruction: 'Make the song more emotional and moving.' },
  'Add Verse': { action: 'continue', instruction: 'Add a second verse after the first one (in the "verse" section, separated by a blank line).' },
  'Generate Chorus': { action: 'transform', instruction: 'Write a new, more memorable chorus. Keep the other sections.' },
  Regenerate: { action: 'transform', instruction: "Write a completely new theme song for this film." },
}

const toContent = (l?: LyricsData): Record<Section, string> =>
  ({ Verse: l?.verse ?? '', 'Pre-Chorus': l?.preChorus ?? '', Chorus: l?.chorus ?? '', Bridge: l?.bridge ?? '' })

export default function Lyrics() {
  const film = useFilm()
  const { project, refreshProject } = useStudio()
  const song = film.lyrics
  const [activeSection, setActiveSection] = useState<Section>('Verse')
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [content, setContent] = useState<Record<Section, string>>(() => toContent(song))
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A new song from the AI (plan, edit, another language) replaces what's on screen.
  useEffect(() => setContent(toContent(song)), [song])

  const run = async (name: string, req: { action: EditAction; instruction: string }) => {
    setActiveAction(name)
    setError(null)
    if (DEMO_MODE || !project) return
    setWorking(true)
    try {
      assertCompleted(await waitForJob(await editProject(project.id, req.action, 'lyrics', req.instruction)))
      await refreshProject()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The song could not be updated.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-lyrics">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Lyrics Studio</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }} data-testid="song-title">
            {song?.title || 'Theme song'}
          </h2>
          <p className="text-sm text-zinc-500">Main theme · {film.title}{song?.style ? ` · ${song.style}` : ''}</p>
        </div>

        {!song ? (
          <div className="px-6 py-10 rounded-xl text-center" style={{ backgroundColor: '#111113', border: '1px dashed rgba(255,255,255,0.08)' }} data-testid="no-song">
            <p className="text-sm text-zinc-400 mb-1">This film doesn't have a song yet.</p>
            <p className="text-xs text-zinc-600 mb-5">Films made before songs were written automatically need one written now — in the film's language.</p>
            <button
              onClick={() => run('Write the song', { action: 'transform', instruction: 'Write the theme song for this film.' })}
              disabled={working || DEMO_MODE || !project}
              className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
            >
              {working ? 'Writing the song…' : 'Write the song'}
            </button>
          </div>
        ) : (
          <>
            {/* Section tabs */}
            <div role="tablist" className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
              {SECTIONS.map(s => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={activeSection === s}
                  onClick={() => setActiveSection(s)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: activeSection === s ? 'rgba(255,255,255,0.07)' : 'transparent',
                    color: activeSection === s ? '#f4f0ea' : '#71717a',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Lyrics editor */}
            <div className="px-5 sm:px-6 py-6 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#52525b' }}>{activeSection}</p>
              <textarea
                aria-label={`${activeSection} lyrics`}
                value={content[activeSection]}
                onChange={e => setContent(c => ({ ...c, [activeSection]: e.target.value }))}
                rows={6}
                className="w-full bg-transparent text-sm leading-loose resize-none focus:outline-none"
                style={{ color: '#d4d4d8', fontFamily: 'Fraunces, Georgia, serif', fontSize: '15px', lineHeight: '2' }}
              />
            </div>

            {/* Full lyrics preview */}
            <div className="px-5 sm:px-6 py-6 rounded-xl" style={{ backgroundColor: 'rgba(212,168,75,0.04)', border: '1px solid rgba(212,168,75,0.12)' }}>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#d4a84b' }}>Full Song</p>
              {SECTIONS.map(section => (
                <div key={section} className="mb-5">
                  <p className="text-[10px] text-zinc-600 mb-1 uppercase tracking-widest">{section}</p>
                  <p className="text-sm leading-loose italic" style={{ color: '#9ca3af', fontFamily: 'Fraunces, Georgia, serif', whiteSpace: 'pre-wrap' }}>
                    {content[section]}
                  </p>
                </div>
              ))}
            </div>

            {/* AI Actions */}
            <div>
              <p className="text-xs text-zinc-600 mb-3">AI Actions</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ACTIONS).map(([name, req]) => (
                  <button
                    key={name}
                    onClick={() => run(name, req)}
                    disabled={working}
                    className="px-3 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                    style={
                      activeAction === name
                        ? { backgroundColor: 'rgba(212,168,75,0.1)', borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b' }
                        : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {working && song && <p className="text-xs" style={{ color: '#d4a84b' }} data-testid="lyrics-working">Rewriting the song…</p>}
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      </div>
    </div>
  )
}
