import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { ChatMessage, NavFn, Panel, Preferences, ProjectData, Screen } from './types'
import { DEFAULT_PREFERENCES, FILM_PROJECT, PANELS } from './types'
import { DEMO_MODE, getMe, getProject, getToken } from './api'
import { StudioContext, type StudioContextValue } from './studio'
import { isPanelLocked, isTeaserLocked } from './features'
import Landing from './screens/Landing'
import Login from './screens/Login'
import Onboarding, { NewFilm } from './screens/Onboarding'
import Director from './screens/Director'
import Generation from './screens/Generation'
import Teaser from './screens/Teaser'
import ExportScreen from './screens/Export'
import WorkspaceShell from './components/WorkspaceShell'
import ProjectsPage from './screens/Projects'
import AssetsPage from './screens/Assets'
import SettingsPage from './screens/Settings'
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
  reset: (genres?: string[]) => void
  filmKey: number
}

function DirectorRoute({ studio, replyDelay }: { studio: StudioState; replyDelay?: number }) {
  const navigate = useScreenNavigate()
  const nav = useNavigate()
  const { panel: param } = useParams()
  const panel = (param ?? 'chat') as Panel

  if (!PANELS.includes(panel) || isPanelLocked(panel)) return <Navigate to="/director" replace />

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
      onNewFilm={() => nav('/new')}
      filmKey={studio.filmKey}
      replyDelay={replyDelay}
    />
  )
}

/** Generation, teaser and export are Coming soon: deep links go back to the Director. */
function TeaserGate({ children }: { children: React.ReactElement }) {
  return isTeaserLocked() ? <Navigate to="/director" replace /> : children
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
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const signedIn = !!getToken()

  // Load the creator's saved defaults (Settings) once signed in.
  useEffect(() => {
    if (!signedIn) return
    getMe().then(me => setPreferences(me.preferences)).catch(() => undefined)
  }, [signedIn])

  const setProject = useCallback((p: ProjectData | null) => {
    setProjectState(p)
    writeProjectId(p?.id ?? null)
  }, [])

  const openProject = useCallback((p: ProjectData) => {
    setProject(p)
    setProgress(p.memory ? PLANNED_PROGRESS : 0)
    setMessages(() => [
      ...initialMessages(),
      ...(p.memory
        ? [{ id: `opened-${p.id}`, role: 'ai' as const, content: `"${p.title}" is open — pick any stage on the left, or generate the teaser.`, card: 'generate' as const }]
        : []),
    ])
  }, [setProject])

  const [filmKey, setFilmKey] = useState(0)
  const newFilm = useCallback((nextGenres: string[] = []) => {
    setProgress(0)
    setGenres(nextGenres)
    setMessages(initialMessages(nextGenres))
    setProject(null)
    setFilmKey(k => k + 1) // remounts the chat: clears the draft, attachments and any pending reply
  }, [setProject])

  // Live mode: reopen the last project after a reload (state otherwise lives in memory).
  useEffect(() => {
    if (!restoring) return
    getProject(readProjectId()!)
      .then(openProject)
      .catch(() => writeProjectId(null))
      .finally(() => setRestoring(false))
  }, [restoring, openProject])

  const studioCtx = useMemo<StudioContextValue>(() => ({
    project,
    setProject,
    refreshProject: async () => {
      if (!project) return null
      const fresh = await getProject(project.id)
      setProject(fresh)
      return fresh
    },
    openProject,
    newFilm,
    preferences,
    setPreferences,
  }), [project, setProject, openProject, newFilm, preferences])

  const studio: StudioState = {
    progress,
    setProgress,
    messages,
    setMessages,
    genres,
    setGenres,
    reset: newFilm,
    filmKey,
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
        <Route path="/new" element={<RequireAuth><NewFilm current={progress > 0 ? { title: project?.title || (DEMO_MODE ? FILM_PROJECT.title : 'your current film'), saved: !DEMO_MODE && !!project } : null} onStart={g => { newFilm(g); navigate('director') }} /></RequireAuth>} />
        <Route path="/director" element={<RequireAuth><DirectorRoute studio={studio} replyDelay={replyDelay} /></RequireAuth>} />
        <Route path="/director/:panel" element={<RequireAuth><DirectorRoute studio={studio} replyDelay={replyDelay} /></RequireAuth>} />
        <Route path="/projects" element={<RequireAuth><WorkspaceShell section="projects" title="Projects" progress={progress} navigate={navigate}><ProjectsPage /></WorkspaceShell></RequireAuth>} />
        <Route path="/assets" element={<RequireAuth><WorkspaceShell section="assets" title="Assets" progress={progress} navigate={navigate}><AssetsPage /></WorkspaceShell></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><WorkspaceShell section="settings" title="Settings" progress={progress} navigate={navigate}><SettingsPage /></WorkspaceShell></RequireAuth>} />
        <Route path="/generation" element={<TeaserGate><RequireAuth><Generation navigate={navigate} stepDuration={generationStepMs} /></RequireAuth></TeaserGate>} />
        <Route path="/teaser" element={<TeaserGate><RequireAuth><Teaser navigate={navigate} /></RequireAuth></TeaserGate>} />
        <Route path="/export" element={<TeaserGate><RequireAuth><ExportScreen navigate={navigate} /></RequireAuth></TeaserGate>} />
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
