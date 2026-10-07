import { useNavigate } from 'react-router-dom'
import type { Panel, NavFn } from '../types'

export const WORKFLOW = [
  { id: 'chat' as Panel, label: 'Director', icon: ChatIcon, stage: -1 },
  { id: 'story' as Panel, label: 'Story', icon: StoryIcon, stage: 0 },
  { id: 'characters' as Panel, label: 'Characters', icon: CharIcon, stage: 1 },
  { id: 'screenplay' as Panel, label: 'Screenplay', icon: ScriptIcon, stage: 2 },
  { id: 'dialogue' as Panel, label: 'Dialogue', icon: DialogueIcon, stage: 3 },
  { id: 'lyrics' as Panel, label: 'Lyrics', icon: LyricsIcon, stage: 4 },
  { id: 'scenes' as Panel, label: 'Scenes', icon: ScenesIcon, stage: 5 },
  { id: 'storyboard' as Panel, label: 'Storyboard', icon: BoardIcon, stage: 6 },
  { id: 'audio' as Panel, label: 'Audio', icon: AudioIcon, stage: 7 },
  { id: 'music' as Panel, label: 'Music', icon: LyricsIcon, stage: 7 },
]

/** A workflow stage is complete once the AI Director has progressed past it (shown with a check). */
export function isStageComplete(stage: number, progress: number) {
  return stage !== -1 && stage < progress
}

export type WorkspaceSection = 'projects' | 'assets' | 'settings'

const SECTIONS: { id: WorkspaceSection; label: string; icon: () => React.ReactElement }[] = [
  { id: 'projects', label: 'Projects', icon: ProjectsIcon },
  { id: 'assets', label: 'Assets', icon: AssetsIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

function ProjectsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function AssetsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zm10.5-11.25h.008v.008h-.008V9.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function ChatIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function StoryIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function CharIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ScriptIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function DialogueIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function LyricsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ScenesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125v-7.5A1.125 1.125 0 013.375 10.5m0 9v-9m0 9h1.5m15.75 0v-7.5A1.125 1.125 0 0019.5 10.5m1.875 9h-1.5m1.5.125v-7.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function BoardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function AudioIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const FilmIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <rect x="2" y="7" width="20" height="10" rx="1" />
    <path d="M7 7V4M17 7V4M7 17v3M17 17v3M2 12h20" />
  </svg>
)

interface SidebarProps {
  /** Active Director panel, or null on a workspace page */
  panel: Panel | null
  /** Active workspace page (Projects / Assets / Settings) */
  section?: WorkspaceSection
  setPanel: (p: Panel) => void
  progress: number
  navigate: NavFn
  onGenerate: () => void
  onNewFilm: () => void
  /** Mobile drawer state (ignored at md+ where the sidebar is always visible) */
  open: boolean
  onClose: () => void
}

export default function Sidebar({ panel, section, setPanel, progress, navigate, onGenerate, onNewFilm, open, onClose }: SidebarProps) {
  const routerNavigate = useNavigate()
  const choose = (p: Panel) => {
    setPanel(p)
    onClose()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden
          data-testid="sidebar-backdrop"
        />
      )}

      <nav
        aria-label="Film workflow"
        data-testid="sidebar"
        data-open={open}
        className={`flex flex-col h-full border-r flex-shrink-0 fixed md:static inset-y-0 left-0 z-40 transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 220, backgroundColor: '#0e0e10', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div style={{ color: '#d4a84b' }}><FilmIcon /></div>
          <span className="text-xs font-semibold tracking-widest uppercase flex-1" style={{ color: '#a1a1aa', letterSpacing: '0.15em' }}>Cinéma AI</span>
          <button onClick={onClose} aria-label="Close menu" className="md:hidden text-zinc-500 hover:text-zinc-300 text-lg leading-none">×</button>
        </div>

        {/* New Film */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => { onNewFilm(); onClose() }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all hover:bg-zinc-800/50"
            style={{ color: '#d4a84b', backgroundColor: 'rgba(212,168,75,0.08)', border: '1px solid rgba(212,168,75,0.15)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New Film
          </button>
        </div>

        {/* Workflow stages */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="text-[10px] font-semibold tracking-widest uppercase px-2 mb-2" style={{ color: '#3f3f46' }}>Current Project</p>

          <div className="space-y-0.5">
            {WORKFLOW.map(item => {
              const isActive = panel === item.id
              const isComplete = isStageComplete(item.stage, progress)

              return (
                <button
                  key={item.id}
                  data-testid={`nav-${item.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => choose(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all hover:bg-zinc-800/40"
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.07)' : undefined,
                    color: isActive ? '#f4f0ea' : '#a1a1aa',
                  }}
                >
                  <span style={{ color: isActive ? '#d4a84b' : isComplete ? '#6b7280' : 'inherit' }}>
                    <item.icon />
                  </span>
                  <span className="text-xs font-medium flex-1">{item.label}</span>
                  {isComplete && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" className="w-3 h-3 flex-shrink-0">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>

          {progress >= 6 && (
            <div className="mt-4">
              <button
                onClick={onGenerate}
                className="w-full py-2.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 glow-accent"
                style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
              >
                Generate Teaser ▶
              </button>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="px-3 py-4 border-t space-y-0.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {SECTIONS.map(item => {
            const isActive = section === item.id
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => { routerNavigate(`/${item.id}`); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium hover:text-zinc-300 hover:bg-zinc-800/40 transition-all"
                style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.07)' : undefined, color: isActive ? '#f4f0ea' : '#71717a' }}
              >
                <span style={{ color: isActive ? '#d4a84b' : 'inherit' }}><item.icon /></span>
                {item.label}
              </button>
            )
          })}
          <button
            onClick={() => navigate('landing')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-400 transition-all mt-1"
          >
            <span>←</span>
            Exit
          </button>
        </div>
      </nav>
    </>
  )
}
