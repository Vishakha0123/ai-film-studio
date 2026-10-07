import { useState } from 'react'
import { useFilm } from '../studio'

const SUGGESTIONS = [
  { id: '1', character: 'Elena', text: '"Thomas… you told me the score was finished. You told me you were finished."', tone: 'Grief' },
  { id: '2', character: 'Elena', text: '"I hear it differently every time I play it. Like it\'s trying to tell me something I\'m not ready to hear."', tone: 'Fear' },
  { id: '3', character: 'Elena', text: '"The notation changed. I know what I wrote. This — this isn\'t what I wrote."', tone: 'Horror' },
]

const COMMANDS = ['Make it emotional', 'Make it scarier', 'Make it quieter', 'Add subtext', 'Make it ambiguous']

export default function Dialogue() {
  const film = useFilm()
  // Live projects carry their own key lines; the design's sample lines are used otherwise.
  const live = film.dialogue && film.dialogue.length > 0
  const suggestions = live
    ? film.dialogue!.map((d, i) => ({ id: String(i + 1), character: d.character, text: `"${d.text.replace(/^"|"$/g, '')}"`, tone: d.tone }))
    : SUGGESTIONS
  const scene = live ? film.scenes.find(sc => sc.characters.length > 0) ?? film.scenes[0] : undefined
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [command, setCommand] = useState('')
  const [accepted, setAccepted] = useState<string[]>([])

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-dialogue">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Dialogue Workspace</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            {scene ? `Scene ${scene.number} — ${scene.location}` : 'Scene 2 — Study Interior'}
          </h2>
          <p className="text-sm text-zinc-500">{scene ? `${scene.description} · Mood: ${scene.mood}` : 'Elena discovers the changed notation · Mood: Unsettling'}</p>
        </div>

        {/* Context card */}
        <div className="px-4 py-4 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#52525b' }}>Scene Context</p>
          <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
            {scene ? film.logline : "Elena is alone in the study late at night. She has been playing Thomas's unfinished symphony for hours. She notices the notation has changed — something she did not write. This is the first moment she speaks aloud in the film."}
          </p>
        </div>

        {/* AI Suggestions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium" style={{ color: '#d4d4d8' }}>AI Dialogue Suggestions</p>
            <button className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Generate More</button>
          </div>

          <div className="space-y-3">
            {suggestions.map(s => {
              const isAccepted = accepted.includes(s.id)
              return (
                <div
                  key={s.id}
                  data-testid={`dialogue-${s.id}`}
                  className="px-5 py-4 rounded-xl border transition-all cursor-pointer"
                  style={{
                    borderColor: selectedId === s.id ? 'rgba(212,168,75,0.4)' : isAccepted ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: selectedId === s.id ? 'rgba(212,168,75,0.05)' : isAccepted ? 'rgba(16,185,129,0.04)' : '#111113',
                  }}
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: '#d4a84b' }}>{s.character}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#1a1a1e', color: '#71717a' }}>{s.tone}</span>
                    </div>
                    {isAccepted && <span className="text-[10px] font-medium" style={{ color: '#10b981' }}>Used ✓</span>}
                  </div>

                  <p className="text-sm italic leading-relaxed" style={{ color: '#d4d4d8', fontFamily: 'Fraunces, Georgia, serif' }}>{s.text}</p>

                  {selectedId === s.id && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setAccepted(a => (a.includes(s.id) ? a : [...a, s.id])) }}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}
                      >
                        Use This
                      </button>
                      <button onClick={e => e.stopPropagation()} className="px-4 py-1.5 rounded-lg text-xs font-medium border transition-all" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }}>
                        Edit
                      </button>
                      <button onClick={e => e.stopPropagation()} className="px-4 py-1.5 rounded-lg text-xs font-medium border transition-all" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }}>
                        Generate More
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Command input */}
        <div>
          <p className="text-xs text-zinc-600 mb-3">Direct the AI</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMANDS.map(cmd => (
              <button
                key={cmd}
                onClick={() => setCommand(cmd)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all"
                style={{
                  borderColor: command === cmd ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)',
                  color: command === cmd ? '#d4a84b' : '#71717a',
                  backgroundColor: command === cmd ? 'rgba(212,168,75,0.07)' : 'transparent',
                }}
              >
                {cmd}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              aria-label="Direct the AI"
              placeholder='Try "Make Elena sound more desperate" or "Add a pause for effect"'
              value={command}
              onChange={e => setCommand(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
            />
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
