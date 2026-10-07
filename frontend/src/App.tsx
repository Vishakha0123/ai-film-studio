import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { ChatMessage, NavFn, Panel, ProjectData, Screen } from './types'
import { PANELS } from './types'
import { DEMO_MODE, getProject, getToken } from './api'
import { StudioContext, type StudioContextValue } from './studio'
import Landing from './screens/Landing'
import Login from './screens/Login'
import Onboarding from './screens/Onboarding'
import Director from './screens/Director'
import Generation from './screens/Generation'
import Teaser from './screens/Teaser'
import ExportScreen from './screens/Export'
import { WORKFLOW, isStageUnlocked } from './components/Sidebar'
import { initialMessages } from './panels/Chat'

export const SCREEN_PATHS: Record<Screen, string> = {
  landing: '/',
  login: '/login',
  onboarding: '/onboarding',
  director: '/director',
  generation: '/generation',
  teaser: '/teaser',
  export: '/export',
}

/** Screens after sign-in require a session token. */
function RequireAuth({ children }: { children: React.ReactElement }) {
  return getToken() ? children : <Navigate to="/login" replace />
}

function useScreenNavigate(): NavFn {
  const nav = useNavigate()
  return useCallback((s: Screen) => nav(SCREEN_PATHS[s]), [nav])
}

interface StudioState {
  progress: number
  setProgress: (n: number) => void
  messages: ChatMessage[]
  setMessages: (fn: (m: ChatMessage[]) => ChatMessage[]) => void
  genres: string[]
  setGenres: (fn: (g: string[]) => string[]) => void
  reset: () => void
}

function DirectorRoute({ studio, replyDelay }: { studio: StudioState; replyDelay?: number }) {
  const navigate = useScreenNavigate()
  const nav = useNavigate()
  const { panel: param } = useParams()
  const panel = (param ?? 'chat') as Panel

  if (!PANELS.includes(panel)) return <Navigate to="/director" replace />
  const stage = WORKFLOW.find(w => w.id === panel)?.stage ?? -1
  if (!isStageUnlocked(stage, studio.progress)) return <Navigate to="/director" replace />

  const setPanel = (p: Panel) => nav(p === 'chat' ? '/director' : `/director/${p}`)

  return (
    <Director
      navigate={navigate}
      panel={panel}
      setPanel={setPanel}
      progress={studio.progress}
      setProgress={studio.setProgress}
      messages={studio.messages}
      setMessages={studio.setMessages}
      genres={studio.genres}
      onNewFilm={() => { studio.reset(); setPanel('chat') }}
      replyDelay={replyDelay}
    />
  )
}

const PROJECT_KEY = 'cineai.projectId'
/** Every Director stage is unlocked once a project has been planned. */
const PLANNED_PROGRESS = 8

function readProjectId(): string | null {
  try {
    return localStorage.getItem(PROJECT_KEY)
  } catch {
    return null
  }
}

function writeProjectId(id: string | null) {
  try {
    if (id) localStorage.setItem(PROJECT_KEY, id)
    else localStorage.removeItem(PROJECT_KEY)
  } catch {
    /* storage unavailable */
  }
}

function Screens({ replyDelay, generationStepMs }: AppProps) {
  const navigate = useScreenNavigate()
  const [progress, setProgress] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [genres, setGenres] = useState<string[]>([])
  const [project, setProjectState] = useState<ProjectData | null>(null)
  const [restoring, setRestoring] = useState(() => !DEMO_MODE && !!getToken() && !!readProjectId())

  const setProject = useCallback((p: ProjectData | null) => {
    setProjectState(p)
    writeProjectId(p?.id ?? null)
  }, [])

  // Live mode: reopen the last project after a reload (state otherwise lives in memory).
  useEffect(() => {
    if (!restoring) return
    getProject(readProjectId()!)
      .then(p => {
        setProject(p)
        if (p.memory) setProgress(PLANNED_PROGRESS)
        if (p.memory) setMessages(m => (m.length > 1 ? m : [...m, { id: 'restored', role: 'ai', content: `Welcome back. "${p.title}" is open — pick any stage on the left, or generate the teaser.`, card: 'generate' }]))
      })
      .catch(() => writeProjectId(null))
      .finally(() => setRestoring(false))
  }, [restoring, setProject])

  const studioCtx = useMemo<StudioContextValue>(() => ({
    project,
    setProject,
    refreshProject: async () => {
      if (!project) return null
      const fresh = await getProject(project.id)
      setProject(fresh)
      return fresh
    },
  }), [project, setProject])

  const studio: StudioState = {
    progress,
    setProgress,
    messages,
    setMessages,
    genres,
    setGenres,
    reset: () => { setProgress(0); setMessages(initialMessages()); setProject(null) },
  }

  return (
    <StudioContext.Provider value={studioCtx}>
    <div style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {restoring ? (
        <div className="flex-1 flex items-center justify-center bg-zinc-950 text-xs text-zinc-600" data-testid="restoring">Opening your project…</div>
      ) : (
      <Routes>
        <Route path="/" element={<Landing navigate={navigate} />} />
        <Route path="/login" element={<Login navigate={navigate} />} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding navigate={navigate} selected={genres} setSelected={setGenres} /></RequireAuth>} />
        <Route path="/director" element={<RequireAuth><DirectorRoute studio={studio} replyDelay={replyDelay} /></RequireAuth>} />
        <Route path="/director/:panel" element={<RequireAuth><DirectorRoute studio={studio} replyDelay={replyDelay} /></RequireAuth>} />
        <Route path="/generation" element={<RequireAuth><Generation navigate={navigate} stepDuration={generationStepMs} /></RequireAuth>} />
        <Route path="/teaser" element={<RequireAuth><Teaser navigate={navigate} /></RequireAuth>} />
        <Route path="/export" element={<RequireAuth><ExportScreen navigate={navigate} /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      )}
    </div>
    </StudioContext.Provider>
  )
}

interface AppProps {
  replyDelay?: number
  generationStepMs?: number
}

export default function App(props: AppProps) {
  return (
    <BrowserRouter>
      <Screens {...props} />
    </BrowserRouter>
  )
}

export { Screens }
