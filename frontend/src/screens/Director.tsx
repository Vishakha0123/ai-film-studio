import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Panel, NavFn, ChatMessage } from '../types'
import Sidebar from '../components/Sidebar'
import Chat from '../panels/Chat'
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
import { DEMO_MODE } from '../api'

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
  replyDelay?: number
}

export default function Director({ navigate, panel, setPanel, progress, setProgress, messages, setMessages, genres, onNewFilm, replyDelay }: DirectorProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const film = useFilm()
  const { project } = useStudio()
  const routerNavigate = useNavigate()
  // Live mode with no planned film yet: panels explain how to start instead of showing the sample film.
  const needsFilm = !DEMO_MODE && !project?.memory && panel !== 'chat' && panel !== 'music'

  const advance = () => {
    const next = PANEL_ORDER[progress]
    setProgress(progress + 1)
    if (next) setTimeout(() => setPanel(next), 100)
  }

  const handleGenerate = () => navigate('generation')

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
                onClick={() => setPanel('chat')}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 sm:px-3 py-1.5 rounded-lg hover:bg-zinc-800/40"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                  <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Chat
              </button>
            )}
            <div className="w-px h-4 bg-zinc-800" />
            <button
              onClick={handleGenerate}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80 whitespace-nowrap"
              style={{ backgroundColor: 'rgba(212,168,75,0.1)', color: '#d4a84b', border: '1px solid rgba(212,168,75,0.2)' }}
            >
              Generate Teaser
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden">
          {panel === 'chat' && (
            <Chat
              progress={progress}
              onAdvance={advance}
              onGenerate={handleGenerate}
              onOpenPanel={setPanel}
              genres={genres}
              messages={messages}
              setMessages={setMessages}
              replyDelay={replyDelay}
            />
          )}
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
      </div>
    </div>
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
