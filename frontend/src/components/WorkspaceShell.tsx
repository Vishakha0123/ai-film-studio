import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar, { type WorkspaceSection } from './Sidebar'
import type { NavFn, Panel } from '../types'

interface Props {
  section: WorkspaceSection
  title: string
  progress: number
  navigate: NavFn
  /** Optional controls on the right of the top bar */
  actions?: ReactNode
  children: ReactNode
}

/** Layout for Projects, Assets and Settings: the Director sidebar plus a top bar, matching the Director screen. */
export default function WorkspaceShell({ section, title, progress, navigate, actions, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const nav = useNavigate()
  const setPanel = (p: Panel) => nav(p === 'chat' ? '/director' : `/director/${p}`)

  return (
    <div className="flex h-full overflow-hidden" data-testid={`screen-${section}`}>
      <Sidebar
        panel={null}
        section={section}
        setPanel={setPanel}
        progress={progress}
        navigate={navigate}
        onGenerate={() => navigate('generation')}
        onNewFilm={() => nav('/new')}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
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
            <h1 className="text-sm font-semibold truncate" style={{ color: '#d4d4d8' }} data-testid="page-title">{title}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
