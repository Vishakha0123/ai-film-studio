import { useEffect, useRef, useState } from 'react'
import { useFilm } from '../studio'
import { useFilmEdit } from '../lib/useFilmEdit'
import type { DialogueLine } from '../types'

// Shown in demo mode (the sample film has no stored dialogue lines).
const SAMPLE: DialogueLine[] = [
  { character: 'Elena', text: 'Thomas… you told me the score was finished. You told me you were finished.', tone: 'Grief', scene: 2 },
  { character: 'Elena', text: "I hear it differently every time I play it. Like it's trying to tell me something I'm not ready to hear.", tone: 'Fear', scene: 2 },
  { character: 'Elena', text: "The notation changed. I know what I wrote. This — this isn't what I wrote.", tone: 'Horror', scene: 2 },
]

const COMMANDS = ['Make it emotional', 'Make it scarier', 'Make it quieter', 'Add subtext', 'Make it ambiguous']

const clean = (t: string) => t.replace(/^"|"$/g, '')

export default function Dialogue() {
  const film = useFilm()
  const live = !!film.dialogue && film.dialogue.length > 0
  const lines: DialogueLine[] = live ? film.dialogue! : SAMPLE
  const scenes = [...film.scenes].sort((a, b) => a.number - b.number)
  const firstScene = scenes[0]?.number ?? 1
  const sceneOf = (l: DialogueLine) => l.scene ?? firstScene // lines from before scenes were tracked sit in the first
  const [current, setCurrent] = useState<number>(() => (lines.find(l => l.scene)?.scene ?? firstScene))
  const scene = scenes.find(sc => sc.number === current)
  const visible = lines.map((l, i) => ({ l, i })).filter(({ l }) => sceneOf(l) === current)
  const countIn = (n: number) => lines.filter(l => sceneOf(l) === n).length
  const { working, error, ai, save } = useFilmEdit()
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<DialogueLine>({ character: '', text: '', tone: '' })
  const [command, setCommand] = useState('')
  const [used, setUsed] = useState<number[]>([])
  const firstName = (visible[0]?.l ?? lines[0])?.character || scene?.characters[0] || 'the lead'

  // After an AI change, jump to the scene that gained lines (e.g. "give me scene 2's dialogue" asked from scene 1).
  const countsBefore = useRef<Record<number, number> | null>(null)
  const snapshot = () => { countsBefore.current = Object.fromEntries(scenes.map(sc => [sc.number, countIn(sc.number)])) }
  useEffect(() => {
    const before = countsBefore.current
    if (!before) return
    countsBefore.current = null
    const grew = scenes.find(sc => countIn(sc.number) > (before[sc.number] ?? 0) && sc.number !== current)
    if (grew && countIn(current) <= (before[current] ?? 0)) setCurrent(grew.number)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [film.dialogue])

  const switchScene = (n: number) => { setCurrent(n); setSelected(null); setEditing(null) }
  const where = scene ? `scene ${scene.number} (${scene.location}: ${scene.description})` : `scene ${current}`

  const describe = (i: number) => `${lines[i].character}: "${clean(lines[i].text)}"`

  const generateMore = () => {
    snapshot()
    return ai(`Writing lines for scene ${current}…`, 'dialogue', 'continue',
      `Write 3 new dialogue lines for ${where}, spoken by the characters in it, in the film's language. Give each new line "scene": ${current}. Keep all the existing lines exactly as they are.`)
  }

  const alternatives = (i: number) =>
    ai('Writing alternatives…', 'dialogue', 'continue',
      'Add 2 alternative versions of this line right after it: same character, different wording.', { item: String(i + 1) })

  const useLine = async (i: number) => {
    const ok = await ai('Adding the line to the screenplay…', 'screenplay', 'improve',
      `Work this dialogue line into the screenplay where it fits best, as ${lines[i].character}'s line in proper screenplay format, keeping everything else as it is: ${describe(i)}`)
    if (ok) setUsed(u => (u.includes(i) ? u : [...u, i]))
  }

  const startEdit = (i: number) => {
    setEditing(i)
    setDraft({ character: lines[i].character, text: clean(lines[i].text), tone: lines[i].tone })
  }

  const saveEdit = async (i: number) => {
    const next = lines.map((l, j) => (j === i ? { ...l, ...draft, text: draft.text.trim() } : l))
    if (await save('Saving…', { dialogue: next })) setEditing(null)
  }

  const apply = async () => {
    const cmd = command.trim()
    if (!cmd) return
    const ok = selected !== null
      ? await ai('Applying…', 'dialogue', 'improve', `Rewrite this line: ${cmd}. Keep who says it.`, { item: String(selected + 1) })
      : (snapshot(), await ai('Applying…', 'dialogue', 'improve',
          `${cmd}\n(The creator is looking at ${where}. Unless they name another scene, this is about that scene's lines; lines for a scene carry "scene": its number. Keep every other scene's lines exactly as they are.)`))
    if (ok) setCommand('')
  }

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-dialogue">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Dialogue Workspace</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
            {scene ? `Scene ${scene.number} — ${scene.location}` : `Scene ${current}`}
          </h2>
          {scene && <p className="text-sm text-zinc-500">{scene.description} · Mood: {scene.mood}</p>}
        </div>

        {/* One tab per scene, with how many lines it has */}
        {scenes.length > 1 && (
          <div role="tablist" aria-label="Scenes" className="flex gap-2 overflow-x-auto pb-1" data-testid="scene-tabs">
            {scenes.map(sc => (
              <button
                key={sc.number}
                role="tab"
                aria-selected={sc.number === current}
                onClick={() => switchScene(sc.number)}
                className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-all"
                style={sc.number === current
                  ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.4)', color: '#d4a84b' }
                  : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}
              >
                Scene {sc.number} <span className="text-zinc-600">· {countIn(sc.number)} {countIn(sc.number) === 1 ? 'line' : 'lines'}</span>
              </button>
            ))}
          </div>
        )}

        {/* Context card */}
        <div className="px-4 py-4 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#52525b' }}>Scene Context</p>
          <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>
            {live ? film.logline : "Elena is alone in the study late at night. She has been playing Thomas's unfinished symphony for hours. She notices the notation has changed — something she did not write. This is the first moment she speaks aloud in the film."}
          </p>
        </div>

        {/* AI Suggestions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium" style={{ color: '#d4d4d8' }}>AI Dialogue Suggestions</p>
            <button onClick={() => void generateMore()} disabled={!!working} className="text-xs transition-colors disabled:opacity-50" style={{ color: '#d4a84b' }}>
              Generate More
            </button>
          </div>
          {working && <p className="text-xs mb-3" style={{ color: '#d4a84b' }} data-testid="dialogue-working">{working}</p>}
          {error && <p role="alert" className="text-xs text-red-300 mb-3">{error}</p>}

          <div className="space-y-3">
            {visible.length === 0 && (
              <p className="text-sm text-zinc-500 px-1" data-testid="no-lines">No lines in this scene yet — click <span style={{ color: '#d4a84b' }}>Generate More</span> to write some.</p>
            )}
            {visible.map(({ l: s, i }) => {
              const isUsed = used.includes(i)
              const isSel = selected === i
              return (
                <div
                  key={i}
                  data-testid={`dialogue-${i + 1}`}
                  data-scene={sceneOf(s)}
                  className="px-5 py-4 rounded-xl border transition-all cursor-pointer"
                  style={{
                    borderColor: isSel ? 'rgba(212,168,75,0.4)' : isUsed ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: isSel ? 'rgba(212,168,75,0.05)' : isUsed ? 'rgba(16,185,129,0.04)' : '#111113',
                  }}
                  onClick={() => editing === null && setSelected(isSel ? null : i)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: '#d4a84b' }}>{s.character}</span>
                      {s.tone && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#1a1a1e', color: '#71717a' }}>{s.tone}</span>}
                    </div>
                    {isUsed && <span className="text-[10px] font-medium" style={{ color: '#10b981' }}>Used ✓</span>}
                  </div>

                  {editing === i ? (
                    <div className="space-y-2" onClick={e => e.stopPropagation()}>
                      <textarea
                        aria-label="Line"
                        value={draft.text}
                        onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
                      />
                      <div className="flex gap-2">
                        <input aria-label="Character" value={draft.character} onChange={e => setDraft(d => ({ ...d, character: e.target.value }))} className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none" />
                        <input aria-label="Tone" value={draft.tone} onChange={e => setDraft(d => ({ ...d, tone: e.target.value }))} className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => void saveEdit(i)} disabled={!!working || !draft.text.trim()} className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>Save</button>
                        <button onClick={() => setEditing(null)} className="px-4 py-1.5 rounded-lg text-xs text-zinc-400">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm italic leading-relaxed" style={{ color: '#d4d4d8', fontFamily: 'Fraunces, Georgia, serif' }}>“{clean(s.text)}”</p>
                  )}

                  {isSel && editing !== i && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={e => { e.stopPropagation(); void useLine(i) }}
                        disabled={!!working}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                        style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}
                        title="Adds this line to the screenplay"
                      >
                        Use This
                      </button>
                      <button onClick={e => { e.stopPropagation(); startEdit(i) }} className="px-4 py-1.5 rounded-lg text-xs font-medium border transition-all hover:text-zinc-200" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
                        Edit
                      </button>
                      <button onClick={e => { e.stopPropagation(); void alternatives(i) }} disabled={!!working} className="px-4 py-1.5 rounded-lg text-xs font-medium border transition-all hover:text-zinc-200 disabled:opacity-50" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
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
          <p className="text-xs text-zinc-600 mb-3">
            Direct the AI {selected !== null ? <span style={{ color: '#d4a84b' }}>— applies to the selected line ({lines[selected]?.character})</span> : <span>— applies to scene {current} (select a line to change just that; name another scene to write for it)</span>}
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMANDS.map(cmd => (
              <button
                key={cmd}
                onClick={() => setCommand(cmd)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all"
                style={{
                  borderColor: command === cmd ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)',
                  color: command === cmd ? '#d4a84b' : '#a1a1aa',
                  backgroundColor: command === cmd ? 'rgba(212,168,75,0.07)' : 'transparent',
                }}
              >
                {cmd}
              </button>
            ))}
          </div>
          <form onSubmit={e => { e.preventDefault(); void apply() }} className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              aria-label="Direct the AI"
              placeholder={`Try "Make ${firstName} sound more desperate" or "Add a pause for effect"`}
              value={command}
              onChange={e => setCommand(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
            />
            <button type="submit" disabled={!command.trim() || !!working} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
              Apply
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
