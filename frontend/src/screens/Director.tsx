import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Panel, NavFn, ChatMessage } from '../types'
import Sidebar from '../components/Sidebar'
import Chat, { continueReply } from '../panels/Chat'
import Story from '../panels/Story'
import Characters from '../panels/Characters'
import Screenplay from '../panels/Screenplay'
import Dialogue from '../panels/Dialogue'
import Lyrics from '../panels/Lyrics'
import Scenes from '../panels/Scenes'
import Storyboard from '../panels/Storyboard'
import Audio from '../panels/Audio'
import Music from '../panels/Music'
import { useFilm, useStudio } from '../studio'
import { DEMO_MODE, approveStep } from '../api'
import { isPanelLocked, isTeaserLocked } from '../features'
import { ComingSoonButton } from '../components/LockIcon'

export const PANEL_TITLES: Record<Panel, string> = {
  chat: 'AI Director',
  story: 'Story',
  characters: 'Characters',
  screenplay: 'Screenplay',
  dialogue: 'Dialogue',
  lyrics: 'Lyrics Studio',
  scenes: 'Scenes',
  storyboard: 'Storyboard',
  audio: 'Audio',
  music: 'Music',
}

/** Panel the Director opens after each AI step (matches the Figma prototype flow). */
export const PANEL_ORDER: Panel[] = ['story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio']

interface DirectorProps {
  navigate: NavFn
  panel: Panel
  setPanel: (p: Panel) => void
  progress: number
  setProgress: (n: number) => void
  messages: ChatMessage[]
  setMessages: (fn: (m: ChatMessage[]) => ChatMessage[]) => void
  genres: string[]
  onNewFilm: () => void
  /** Changes on New Film so the chat starts clean. */
  filmKey?: number
  replyDelay?: number
}

export default function Director({ navigate, panel, setPanel, progress, setProgress, messages, setMessages, genres, onNewFilm, filmKey = 0, replyDelay }: DirectorProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  // Chat next to sections: open by default on wide screens (remembered), a full-screen sheet on phones.
  const [dockOpen, setDockOpen] = useState(() => readDockPref())
  const [mobileChat, setMobileChat] = useState(false)
  const isWide = () => typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches
  const chatShown = isWide() ? dockOpen : mobileChat
  const toggleChat = () => {
    if (isWide()) { setDockOpen(!dockOpen); writeDockPref(!dockOpen) }
    else setMobileChat(!mobileChat)
  }
  const closeChat = () => {
    setMobileChat(false)
    if (isWide()) { setDockOpen(false); writeDockPref(false) }
  }
  const film = useFilm()
  const { project } = useStudio()
  const routerNavigate = useNavigate()
  // Live mode with no planned film yet: panels explain how to start instead of showing the sample film.
  const needsFilm = !DEMO_MODE && !project?.memory && panel !== 'chat' && panel !== 'music'

  const advance = () => {
    const next = PANEL_ORDER[progress]
    setProgress(progress + 1)
    // Locked stages (Coming soon) still count as done, but the Director stays in the chat.
    if (next && !isPanelLocked(next)) setTimeout(() => setPanel(next), 100)
  }

  const handleGenerate = () => navigate('generation')

  /** Open stages in order (Coming-soon ones are skipped). */
  const steps = PANEL_ORDER.filter(p => !isPanelLocked(p))

  /**
   * "Continue" at the bottom of a section: marks it done, keeps the chat in step (the AI's reply
   * for the next stage) and opens the next section. After the last one it returns to the chat.
   */
  const continueFrom = (p: Panel) => {
    const idx = PANEL_ORDER.indexOf(p)
    const next = steps[steps.indexOf(p) + 1]
    if (project) void approveStep(project.id, p).catch(() => undefined)
    if (progress <= idx + 1) {
      const reply = continueReply(idx + 1, film)
      const label = next ? PANEL_TITLES[next] : 'finish'
      setMessages(m => [
        ...m,
        { id: `continue-${p}-${Date.now()}`, role: 'user', content: next ? `Continue to ${label}` : 'Finish the storyboard' },
        ...(reply && !m.some(x => x.card && x.card === reply.card)
          ? [{ id: `continue-${p}-${Date.now()}-ai`, role: 'ai' as const, content: reply.text, card: reply.card }]
          : []),
      ])
      setProgress(Math.max(progress, idx + 2))
    }
    setPanel(next ?? 'chat')
  }

  return (
    <div className="flex h-full overflow-hidden" data-testid="screen-director">
      <Sidebar
        panel={panel}
        setPanel={setPanel}
        progress={progress}
        navigate={navigate}
        onGenerate={handleGenerate}
        onNewFilm={onNewFilm}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 border-b flex-shrink-0"
          style={{ backgroundColor: '#0c0c0e', borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              data-testid="menu-button"
              className="md:hidden p-1.5 -ml-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" strokeLinecap="round" />
              </svg>
            </button>
            <h1 className="text-sm font-semibold truncate" style={{ color: '#d4d4d8' }} data-testid="panel-title">{PANEL_TITLES[panel]}</h1>
            {progress > 0 && (
              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap" style={{ backgroundColor: 'rgba(212,168,75,0.1)', color: '#d4a84b' }}>
                {film.title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {panel !== 'chat' && (
              <button
                onClick={toggleChat}
                aria-label={chatShown ? 'Hide chat' : 'Show chat'}
                aria-pressed={chatShown}
                data-testid="chat-toggle"
                className="flex items-center gap-1.5 text-xs transition-colors px-2 sm:px-3 py-1.5 rounded-lg hover:bg-zinc-800/40"
                style={{ color: chatShown ? '#d4a84b' : '#71717a' }}
              >
                <ChatBubbleIcon />
                Chat
              </button>
            )}
            <div className="w-px h-4 bg-zinc-800" />
            {isTeaserLocked() ? <ComingSoonButton label="Generate Teaser" className="text-xs px-3 py-1.5" testId="topbar-generate" /> : (
            <button
              onClick={handleGenerate}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80 whitespace-nowrap"
              style={{ backgroundColor: 'rgba(212,168,75,0.1)', color: '#d4a84b', border: '1px solid rgba(212,168,75,0.2)' }}
            >
              Generate Teaser
            </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Section (Story, Characters, …) with its Continue bar. Kept mounted (hidden) on the
              Director page so the Music player keeps its state. */}
          <div className={panel === 'chat' ? 'hidden' : 'flex-1 min-w-0 flex flex-col overflow-hidden'}>
              <div className="flex-1 overflow-hidden">
              {needsFilm && <EmptyPanel title={PANEL_TITLES[panel]} onStart={() => setPanel('chat')} onOpenProjects={() => routerNavigate('/projects')} />}
              {!needsFilm && panel === 'story' && <Story />}
              {!needsFilm && panel === 'characters' && <Characters />}
              {!needsFilm && panel === 'screenplay' && <Screenplay />}
              {!needsFilm && panel === 'dialogue' && <Dialogue />}
              {!needsFilm && panel === 'lyrics' && <Lyrics />}
              {!needsFilm && panel === 'scenes' && <Scenes onGenerate={handleGenerate} />}
              {!needsFilm && panel === 'storyboard' && <Storyboard onGenerate={handleGenerate} />}
              {!needsFilm && panel === 'audio' && <Audio />}
              <div className={panel === 'music' ? 'h-full' : 'hidden'}><Music active={panel === 'music'} /></div>
            </div>

            {!needsFilm && steps.includes(panel) && (
              <ContinueBar
                step={steps.indexOf(panel) + 1}
                total={steps.length}
                prev={steps[steps.indexOf(panel) - 1]}
                next={steps[steps.indexOf(panel) + 1]}
                onBack={p => setPanel(p)}
                onContinue={() => continueFrom(panel)}
              />
            )}
          </div>

          {/* AI Director chat: the whole page on "Director", a side panel next to every section.
              One instance either way, so a reply in progress survives switching sections. */}
          <aside
            aria-label="AI Director chat"
            data-testid={panel === 'chat' ? undefined : 'chat-dock'}
            className={panel === 'chat'
              ? 'flex-1 min-w-0 flex flex-col'
              : `${mobileChat ? 'flex fixed inset-0 z-40' : 'hidden'} lg:static lg:z-auto ${dockOpen ? 'lg:flex' : 'lg:hidden'} flex-col lg:w-[360px] xl:w-[400px] flex-shrink-0 lg:border-l`}
            style={panel === 'chat' ? undefined : { backgroundColor: '#0b0b0d', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            {panel !== 'chat' && (
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#d4d4d8' }}>
                  <span style={{ color: '#d4a84b' }}>◈</span> AI Director
                </span>
                <span className="flex items-center gap-1">
                  <button onClick={() => { setMobileChat(false); setPanel('chat') }} aria-label="Open full chat" title="Open full chat" className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <button onClick={closeChat} aria-label="Close chat" title="Close chat" className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg>
                  </button>
                </span>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <Chat
                key={filmKey}
                docked={panel !== 'chat'}
                progress={progress}
                onAdvance={advance}
                onGenerate={handleGenerate}
                onOpenPanel={p => { setMobileChat(false); setPanel(p) }}
                genres={genres}
                messages={messages}
                setMessages={setMessages}
                replyDelay={replyDelay}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

const DOCK_KEY = 'cineai.chatDock'
function readDockPref(): boolean {
  try {
    return localStorage.getItem(DOCK_KEY) !== 'closed'
  } catch {
    return true
  }
}
function writeDockPref(open: boolean) {
  try {
    localStorage.setItem(DOCK_KEY, open ? 'open' : 'closed')
  } catch {
    /* storage unavailable — preference lasts for this visit */
  }
}

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptyPanel({ title, onStart, onOpenProjects }: { title: string; onStart: () => void; onOpenProjects: () => void }) {
  return (
    <div className="h-full flex items-center justify-center px-6" data-testid="panel-empty">
      <div className="max-w-sm text-center animate-fade-up">
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#d4a84b' }}>{title}</p>
        <h2 className="text-2xl font-light mb-3" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>No film open yet</h2>
        <p className="text-sm text-zinc-500 mb-6">Describe your idea to the AI Director and this stage fills in automatically — or open one of your saved projects.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={onStart} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>Start in the AI Director</button>
          <button onClick={onOpenProjects} className="px-4 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#d4d4d8' }}>Open a project</button>
        </div>
      </div>
    </div>
  )
}

/** Bottom bar on every section: where you are, back, and Continue to the next section. */
function ContinueBar({ step, total, prev, next, onBack, onContinue }: {
  step: number
  total: number
  prev?: Panel
  next?: Panel
  onBack: (p: Panel) => void
  onContinue: () => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3 border-t flex-shrink-0"
      style={{ backgroundColor: '#0c0c0e', borderColor: 'rgba(255,255,255,0.06)' }}
      data-testid="continue-bar"
    >
      <div className="flex items-center gap-3 min-w-0">
        {prev ? (
          <button onClick={() => onBack(prev)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap" aria-label={`Back to ${PANEL_TITLES[prev]}`}>
            ← <span className="hidden sm:inline">{PANEL_TITLES[prev]}</span>
          </button>
        ) : <span />}
        <div className="flex items-center gap-2 min-w-0" aria-label={`Step ${step} of ${total}`}>
          <span className="text-[11px] text-zinc-500 whitespace-nowrap" data-testid="continue-step">Step {step} of {total}</span>
          <span className="hidden sm:flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className="h-1 w-4 rounded-full" style={{ backgroundColor: i < step ? '#d4a84b' : '#27272a' }} />
            ))}
          </span>
        </div>
      </div>
      <button
        onClick={onContinue}
        data-testid="continue-button"
        className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.98] whitespace-nowrap"
        style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
      >
        {next ? `Continue to ${PANEL_TITLES[next]}` : 'Finish — back to Director'}
        <span aria-hidden>→</span>
      </button>
    </div>
  )
}
