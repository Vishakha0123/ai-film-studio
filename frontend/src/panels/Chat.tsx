import { useState, useRef, useEffect } from 'react'
import type { Panel, ChatMessage, FilmProject } from '../types'
import { filmSeconds } from '../types'
import { DEMO_MODE, assertCompleted, createProject, getProject, planProject, saveBrief, waitForJob } from '../api'
import { useFilm, useStudio } from '../studio'

const AI_RESPONSES: Record<number, { text: string; card: ChatMessage['card'] }> = {
  0: {
    text: "Beautiful premise. I've built out a complete story around this idea — a psychological horror with strong atmospheric tension and an emotionally complex protagonist. The story has a clear three-act structure with a twist ending that recontextualizes everything.\n\nReview the story below, then I'll generate your cast of characters.",
    card: 'story',
  },
  1: {
    text: "Three characters, fully realized. Elena is your compass — fragile but brilliant. Thomas exists in the negative space between scenes. James carries the conspiracy with uncomfortable calm.\n\nI've given each character a distinct visual identity and psychological arc. Ready to move into screenplay?",
    card: 'characters',
  },
  2: {
    text: "I've written a 12-page screenplay in proper format. The opening four pages are particularly strong — the discovery sequence in the study builds genuine dread without resorting to cheap scares.\n\nNow let me refine the dialogue. I want Elena's voice to feel distinct from James's — two very different relationships to the truth.",
    card: 'dialogue',
  },
  3: {
    text: "The dialogue is working. Elena's lines are clipped and searching. James is controlled — every word chosen. Thomas exists only in music, which is the right choice.\n\nWant me to write lyrics for the symphony fragment that plays in the key scene? It would elevate the whole piece.",
    card: 'lyrics',
  },
  4: {
    text: "Lyrics complete. 'Between the rests, I still remain / Listen close — the score explains.' Simple, haunting, thematically precise.\n\nI've broken the story into four scenes, each with a distinct mood and precise timing. The total is 10 seconds. Ready to storyboard?",
    card: 'scenes',
  },
  5: {
    text: "Four shots storyboarded. I've chosen camera language that supports the psychological tension — very slow push-ins, static frames that feel like they're watching Elena rather than following her.\n\nVisual style: Dark Cinema. Desaturated palette with warm amber practical lights. Everything is ready.",
    card: 'storyboard',
  },
  6: {
    text: "Everything is in place.\n\n✓ Story ✓ Characters ✓ Screenplay ✓ Dialogue ✓ Lyrics ✓ Scenes ✓ Storyboard ✓ Visual Style\n\nYour 10-second cinematic teaser is ready to generate. This will take approximately 60 seconds.",
    card: 'generate',
  },
}

const SUGGESTIONS = [
  'Make it darker',
  'Add a twist ending',
  'Change the protagonist',
  'Make it more emotional',
  'Add a haunting theme',
  'Set it in Paris instead',
]

const WELCOME: ChatMessage = {
  id: '0',
  role: 'ai',
  content: "Welcome to your AI Film Director. Describe the film you want to create — a single sentence or a detailed idea. I'll handle the rest.\n\nWhat's your story?",
}

interface ChatProps {
  progress: number
  onAdvance: () => void
  onGenerate: () => void
  onOpenPanel?: (p: Panel) => void
  genres?: string[]
  messages: ChatMessage[]
  setMessages: (fn: (m: ChatMessage[]) => ChatMessage[]) => void
  /** ms the AI "types" before replying (Figma prototype: 1600) */
  replyDelay?: number
}

/** Director replies for a live project, written from the generated film rather than the sample. */
function liveResponse(stage: number, f: FilmProject): { text: string; card: ChatMessage['card'] } | undefined {
  const names = f.characters.map(c => c.name.split(' ')[0])
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? 'your lead'
  const secs = filmSeconds(f)
  switch (stage) {
    case 0: return { text: `I've built "${f.title}" around your idea — ${f.genre.toLowerCase() || 'a cinematic teaser'} with a ${f.tone.toLowerCase() || 'distinct'} tone.\n\n${f.logline}\n\nReview the story, then I'll introduce your cast.`, card: 'story' }
    case 1: return { text: `${f.characters.length} characters, each with a look, a personality and an arc: ${list}.\n\nReady to move into the screenplay?`, card: 'characters' }
    case 2: return { text: `The screenplay is written in proper format. Next, let's sharpen the dialogue so each character sounds like themselves.`, card: 'dialogue' }
    case 3: return { text: `Dialogue is in place. Want lyrics for a theme that plays under the key scene?`, card: 'lyrics' }
    case 4: return { text: `I've broken the story into ${f.scenes.length} scenes with timing and mood. Ready to storyboard?`, card: 'scenes' }
    case 5: return { text: `${f.shots.length} shots storyboarded — about ${secs} seconds in total, with camera and movement for each.\n\nEverything is ready for visuals.`, card: 'storyboard' }
    case 6: return { text: `Everything is in place.\n\n✓ Story ✓ Characters ✓ Screenplay ✓ Dialogue ✓ Scenes ✓ Storyboard\n\nGenerate the teaser when you're ready — you'll see the estimated cost first.`, card: 'generate' }
    default: return undefined
  }
}

export function initialMessages(): ChatMessage[] {
  return [WELCOME]
}

export default function Chat({ progress, onAdvance, onGenerate, onOpenPanel, genres, messages, setMessages, replyDelay = 1600 }: ChatProps) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [status, setStatus] = useState('')
  const { setProject, preferences } = useStudio()
  const film = useFilm()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const sendMessage = () => {
    const text = input.trim()
    if (!text || isTyping) return

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text }
    setMessages(m => [...m, userMsg])
    setInput('')
    setIsTyping(true)

    // Live mode: the first idea creates the project, saves the brief and runs the plan job.
    const backendCall: Promise<FilmProject | null> =
      !DEMO_MODE && progress === 0
        ? (async () => {
            setStatus('Creating your project')
            const created = await createProject(genres ?? [], preferences.language)
            await saveBrief(created.id, { prompt: text, genres, language: preferences.language, teaserSeconds: preferences.teaserSeconds, aspectRatio: preferences.aspectRatio })
            const job = await waitForJob(await planProject(created.id), j => setStatus(j.stage || 'Queued'))
            assertCompleted(job)
            const fresh = await getProject(created.id)
            setProject(fresh)
            return fresh.memory
          })()
        : Promise.resolve(null)

    const minDelay = new Promise<void>(resolve => {
      timerRef.current = setTimeout(resolve, replyDelay)
    })

    Promise.all([backendCall, minDelay])
      .then(([planned]) => {
        const response = (DEMO_MODE ? AI_RESPONSES[progress] : liveResponse(progress, planned ?? film)) || {
          text: "I've noted that. What else would you like to adjust?",
          card: undefined,
        }
        setMessages(m => [...m, { id: (Date.now() + 1).toString(), role: 'ai', content: response.text, card: response.card }])
        setIsTyping(false)
        setStatus('')
        onAdvance()
      })
      .catch((err: unknown) => {
        setMessages(m => [
          ...m,
          { id: (Date.now() + 1).toString(), role: 'ai', content: `Something went wrong talking to the studio: ${err instanceof Error ? err.message : 'unknown error'} Please try again.` },
        ])
        setIsTyping(false)
        setStatus('')
      })
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canSend = input.trim() !== '' && !isTyping

  return (
    <div className="flex flex-col h-full" data-testid="panel-chat">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 animate-fade-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`} data-role={msg.role}>
            {msg.role === 'ai' && (
              <div
                className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ backgroundColor: 'rgba(212,168,75,0.15)', color: '#d4a84b' }}
              >
                ◈
              </div>
            )}

            <div className={`max-w-2xl min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === 'user'
                    ? { backgroundColor: '#27272a', color: '#f4f0ea', borderRadius: '18px 18px 4px 18px' }
                    : { backgroundColor: '#111113', color: '#d4d4d8', borderRadius: '4px 18px 18px 18px', border: '1px solid rgba(255,255,255,0.06)' }
                }
              >
                {msg.content}
              </div>

              {msg.card && <MessageCard card={msg.card} onGenerate={onGenerate} onOpenPanel={onOpenPanel} />}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 animate-fade-in" data-testid="typing-indicator">
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs mt-0.5"
              style={{ backgroundColor: 'rgba(212,168,75,0.15)', color: '#d4a84b' }}
            >
              ◈
            </div>
            <div
              className="px-4 py-3.5 rounded-2xl flex gap-1.5 items-center"
              style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px 18px 18px 18px' }}
            >
              <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#52525b' }} />
              <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#52525b' }} />
              <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#52525b' }} />
            </div>
            {status && <p className="self-center text-xs text-zinc-500" data-testid="job-status">{status}…</p>}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 sm:px-6 pb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); inputRef.current?.focus() }}
              className="text-xs px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 sm:px-4 pb-4">
        <div className="flex items-end gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-2xl border" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.09)' }}>
          <button aria-label="Attach file" className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors mb-0.5 flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            aria-label="Message the AI Director"
            placeholder="Describe the film you want to create…"
            className="flex-1 min-w-0 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed"
            style={{ maxHeight: 120 }}
          />

          <button aria-label="Voice input" className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors mb-0.5 flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            aria-label="Send"
            onClick={sendMessage}
            disabled={!canSend}
            className="p-2 rounded-xl transition-all flex-shrink-0 disabled:opacity-30"
            style={{ backgroundColor: canSend ? '#d4a84b' : '#27272a', color: canSend ? '#09090b' : '#52525b' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-zinc-700 mt-2 hidden sm:block">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}

const CARD_PANEL: Partial<Record<NonNullable<ChatMessage['card']>, Panel>> = {
  story: 'story',
  characters: 'characters',
  screenplay: 'screenplay',
  dialogue: 'dialogue',
  lyrics: 'lyrics',
  scenes: 'scenes',
  storyboard: 'storyboard',
}

function MessageCard({ card, onGenerate, onOpenPanel }: { card: NonNullable<ChatMessage['card']>; onGenerate: () => void; onOpenPanel?: (p: Panel) => void }) {
  const f = useFilm()
  const secs = filmSeconds(f)
  const configs: Record<string, { label: string; color: string; desc: string }> = {
    story: { label: 'Story Generated', color: '#d4a84b', desc: `${f.title} · ${f.genre}` },
    characters: { label: 'Characters Created', color: '#8b7cf6', desc: `${f.characters.length} fully realized character profiles with portraits` },
    screenplay: { label: 'Screenplay Written', color: '#06b6d4', desc: '12 pages · Proper screenplay format' },
    dialogue: { label: 'Dialogue Refined', color: '#10b981', desc: 'Scene-by-scene dialogue with character voice' },
    lyrics: { label: 'Lyrics Composed', color: '#f59e0b', desc: 'Verse · Chorus · Bridge · Emotionally precise' },
    scenes: { label: 'Scenes Broken Down', color: '#f97316', desc: `${f.scenes.length} scenes · ${secs}s total duration` },
    storyboard: { label: 'Storyboard Ready', color: '#ec4899', desc: `${f.shots.length} shots · Dark Cinema visual style` },
    generate: { label: 'Ready to Generate', color: '#d4a84b', desc: `All components complete · ${secs}s teaser` },
  }

  const config = configs[card]
  if (!config) return null
  const target = CARD_PANEL[card]

  return (
    <div
      className="rounded-xl border p-4 flex items-center justify-between gap-4 animate-fade-up max-w-sm w-full"
      style={{ backgroundColor: '#0e0e10', borderColor: 'rgba(255,255,255,0.07)' }}
      data-testid={`card-${card}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${config.color}18` }}>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: config.color }}>{config.label}</p>
          <p className="text-xs text-zinc-500">{config.desc}</p>
        </div>
      </div>
      <button
        onClick={card === 'generate' ? onGenerate : target && onOpenPanel ? () => onOpenPanel(target) : undefined}
        className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 flex-shrink-0"
        style={{ borderColor: `${config.color}40`, color: config.color, backgroundColor: `${config.color}10` }}
      >
        {card === 'generate' ? 'Generate ▶' : 'View →'}
      </button>
    </div>
  )
}
