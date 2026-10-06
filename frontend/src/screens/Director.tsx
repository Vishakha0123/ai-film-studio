import { useState } from 'react'
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
                Echoes of the Forgotten
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
          {panel === 'story' && <Story />}
          {panel === 'characters' && <Characters />}
          {panel === 'screenplay' && <Screenplay />}
          {panel === 'dialogue' && <Dialogue />}
          {panel === 'lyrics' && <Lyrics />}
          {panel === 'scenes' && <Scenes onGenerate={handleGenerate} />}
          {panel === 'storyboard' && <Storyboard onGenerate={handleGenerate} />}
          {panel === 'audio' && <Audio />}
          <div className={panel === 'music' ? 'h-full' : 'hidden'}><Music active={panel === 'music'} /></div>
        </div>
      </div>
    </div>
  )
}
