import { useState } from 'react'
import { useFilm } from '../studio'

const SECTIONS = ['Verse', 'Pre-Chorus', 'Chorus', 'Bridge'] as const
type Section = typeof SECTIONS[number]

const INITIAL_LYRICS: Record<Section, string> = {
  Verse: `Between the rests, I still remain
In the silence after rain
Every measure, every note
The words that you could never quote`,
  'Pre-Chorus': `Listen close — the score explains
What the living can't contain`,
  Chorus: `I am the music in the walls
The echo down your hallway's halls
Play the final page and see
I never left — I cannot leave`,
  Bridge: `Andante — slow, like grief descends
Fortissimo — where longing ends
The key is not in major light
The answer lives in B-flat night`,
}

const ACTIONS = ['Complete Lyrics', 'Improve Rhyme', 'Increase Emotion', 'Add Verse', 'Generate Chorus', 'Translate', 'Regenerate']

export default function Lyrics() {
  const film = useFilm()
  const [activeSection, setActiveSection] = useState<Section>('Verse')
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [content, setContent] = useState<Record<Section, string>>(INITIAL_LYRICS)

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-lyrics">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Lyrics Studio</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            Between the Rests
          </h2>
          <p className="text-sm text-zinc-500">Main theme · {film.title} · Dark Classical</p>
        </div>

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
            {ACTIONS.map(a => (
              <button
                key={a}
                onClick={() => setActiveAction(activeAction === a ? null : a)}
                className="px-3 py-2 rounded-lg text-xs font-medium border transition-all"
                style={
                  activeAction === a
                    ? { backgroundColor: 'rgba(212,168,75,0.1)', borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b' }
                    : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }
                }
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
