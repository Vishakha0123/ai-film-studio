import { useState, useRef, useEffect } from 'react'
import type { Panel, ChatMessage, FilmProject } from '../types'
import { filmSeconds } from '../types'
import { ATTACHMENT_ACCEPT, DEMO_MODE, MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, assertCompleted, createProject, getProject, planProject, saveBrief, uploadDocument, waitForJob } from '../api'
import { useDictation } from '../lib/useDictation'
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

export function initialMessages(genres: string[] = []): ChatMessage[] {
  if (!genres.length) return [WELCOME]
  const g = genres.length === 1 ? genres[0] : `${genres.slice(0, -1).join(', ')} & ${genres[genres.length - 1]}`
  return [{ ...WELCOME, content: `Let's make a new ${g} film. Describe your idea — a single sentence or a detailed treatment — or attach a script, story or lyrics. I'll handle the rest.\n\nWhat's your story?` }]
}

export default function Chat({ progress, onAdvance, onGenerate, onOpenPanel, genres, messages, setMessages, replyDelay = 1600 }: ChatProps) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [status, setStatus] = useState('')
  const { project, setProject, preferences } = useStudio()
  const film = useFilm()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // False once this chat is replaced (New Film) — late replies from the old film are dropped.
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [files, setFiles] = useState<File[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputValue = useRef(input)
  inputValue.current = input
  const dictation = useDictation({ language: preferences.language, getText: () => inputValue.current, setText: setInput })

  // Grow the textarea with its content (up to max-height), so the controls stay aligned on one line.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const addFiles = (list: FileList | File[]) => {
    const accepted = ATTACHMENT_ACCEPT.split(',')
    const next = [...files]
    const problems: string[] = []
    for (const f of Array.from(list)) {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase()
      if (!accepted.includes(ext)) problems.push(`${f.name}: use PDF, Word, text or an image`)
      else if (f.size > MAX_ATTACHMENT_BYTES) problems.push(`${f.name}: larger than 10 MB`)
      else if (next.length >= MAX_ATTACHMENTS) problems.push(`Up to ${MAX_ATTACHMENTS} files per message`)
      else if (!next.some(x => x.name === f.name && x.size === f.size)) next.push(f)
    }
    setFiles(next)
    setNotice(problems.length ? [...new Set(problems)].join(' · ') : null)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const sendMessage = () => {
    const text = input.trim()
    if ((!text && files.length === 0) || isTyping) return
    if (dictation.state === 'listening') dictation.toggle()

    const attached = files
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, attachments: attached.map(f => f.name) }
    setMessages(m => [...m, userMsg])
    setInput('')
    setFiles([])
    setNotice(null)
    setIsTyping(true)

    const uploadAll = async (projectId: string) => {
      for (const [i, f] of attached.entries()) {
        setStatus(`Reading ${f.name} (${i + 1}/${attached.length})`)
        await uploadDocument(projectId, f)
      }
    }

    // Files added to an existing film become source material for its next plan or edit.
    if (!DEMO_MODE && project && progress > 0 && attached.length && !text) {
      uploadAll(project.id)
        .then(() => alive.current && setMessages(m => [...m, { id: `${Date.now()}`, role: 'ai', content: `Added ${attached.length === 1 ? attached[0].name : `${attached.length} files`} to "${project.title}". I'll use ${attached.length === 1 ? 'it' : 'them'} as source material for the next revision.` }]))
        .catch((err: unknown) => alive.current && setMessages(m => [...m, { id: `${Date.now()}`, role: 'ai', content: `I couldn't read that file: ${err instanceof Error ? err.message : 'unknown error'}` }]))
        .finally(() => { if (alive.current) { setIsTyping(false); setStatus('') } })
      return
    }

    // Live mode: the first idea creates the project, saves the brief and runs the plan job.
    const backendCall: Promise<FilmProject | null> =
      !DEMO_MODE && progress === 0
        ? (async () => {
            setStatus('Creating your project')
            const created = await createProject(genres ?? [], preferences.language)
            await uploadAll(created.id)
            const prompt = text || `Turn the attached ${attached.length === 1 ? 'file' : 'files'} into a teaser.`
            await saveBrief(created.id, { prompt, genres, language: preferences.language, teaserSeconds: preferences.teaserSeconds, aspectRatio: preferences.aspectRatio })
            const job = await waitForJob(await planProject(created.id), j => alive.current && setStatus(j.stage || 'Queued'))
            assertCompleted(job)
            const fresh = await getProject(created.id)
            if (alive.current) setProject(fresh)
            return fresh.memory
          })()
        : !DEMO_MODE && project && attached.length
          ? uploadAll(project.id).then(() => null)
          : Promise.resolve(null)

    const minDelay = new Promise<void>(resolve => {
      timerRef.current = setTimeout(resolve, replyDelay)
    })

    Promise.all([backendCall, minDelay])
      .then(([planned]) => {
        if (!alive.current) return
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
        if (!alive.current) return
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

  const canSend = (input.trim() !== '' || files.length > 0) && !isTyping

  return (
    <div
      className="relative flex flex-col h-full"
      data-testid="panel-chat"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragging(false) }}
      onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}
    >
      {dragging && (
        <div className="absolute inset-3 z-20 rounded-2xl border-2 border-dashed flex items-center justify-center pointer-events-none" style={{ borderColor: 'rgba(212,168,75,0.5)', backgroundColor: 'rgba(9,9,11,0.85)' }}>
          <p className="text-sm" style={{ color: '#d4a84b' }}>Drop your story, script, lyrics or reference images</p>
        </div>
      )}
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
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className={`flex flex-wrap gap-1.5 ${msg.content ? 'mt-2' : ''}`}>
                    {msg.attachments.map(name => (
                      <span key={name} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#d4d4d8' }}>
                        <PaperclipIcon className="w-3 h-3" />{name}
                      </span>
                    ))}
                  </div>
                )}
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
        <div className="rounded-2xl border transition-colors focus-within:border-zinc-600" style={{ backgroundColor: '#111113', borderColor: dictation.state === 'listening' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.09)' }}>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3" data-testid="attachment-chips">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-2 max-w-[240px] pl-2.5 pr-1 py-1 rounded-lg text-xs" style={{ backgroundColor: '#1a1a1e', border: '1px solid rgba(255,255,255,0.07)', color: '#d4d4d8' }}>
                  <PaperclipIcon className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500" />
                  <span className="truncate">{f.name}</span>
                  <span className="text-zinc-600 flex-shrink-0">{f.size < 1024 * 1024 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`}</span>
                  <button aria-label={`Remove ${f.name}`} onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} className="w-5 h-5 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1 p-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              data-testid="file-input"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
            />
            <button
              aria-label="Attach files"
              title="Attach a story, script, lyrics (PDF, Word, text) or reference images"
              onClick={() => fileRef.current?.click()}
              disabled={isTyping}
              className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors disabled:opacity-40"
            >
              <PaperclipIcon className="w-5 h-5" />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              onPaste={e => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files) } }}
              aria-label="Message the AI Director"
              placeholder={dictation.state === 'listening' ? 'Listening… speak your idea' : files.length ? 'Add a note about these files (optional)…' : 'Describe the film you want to create…'}
              className="flex-1 min-w-0 self-center bg-transparent text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none px-1.5 py-2 leading-5 max-h-40 overflow-y-auto"
            />

            <button
              aria-label={dictation.state === 'listening' ? 'Stop voice input' : 'Voice input'}
              aria-pressed={dictation.state === 'listening'}
              title={dictation.mode === 'server' ? 'Speak — transcribed by Sarvam' : 'Speak your idea'}
              onClick={dictation.toggle}
              disabled={dictation.state === 'transcribing' || isTyping}
              data-testid="mic-button"
              className={`relative w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 ${dictation.state === 'listening' ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'}`}
            >
              {dictation.state === 'listening' && <span className="absolute inset-1 rounded-lg animate-ping bg-red-500/20" aria-hidden />}
              {dictation.state === 'transcribing' ? (
                <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 relative">
                  <path d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            <button
              aria-label="Send"
              onClick={sendMessage}
              disabled={!canSend}
              className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: canSend ? '#d4a84b' : '#27272a', color: canSend ? '#09090b' : '#52525b' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        {(notice || dictation.error) && (
          <p role="alert" className="text-xs text-red-300 mt-2 px-1">{notice ?? dictation.error}</p>
        )}
        <p className="text-center text-[10px] text-zinc-700 mt-2 hidden sm:block">Enter to send · Shift+Enter for a new line · Attach or drop PDF, Word, text or images · Mic for voice</p>
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

function PaperclipIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
      <path d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
