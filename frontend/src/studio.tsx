import { createContext, useContext } from 'react'
import { FILM_PROJECT, type FilmProject, type ProjectData } from './types'

export interface StudioContextValue {
  /** The current film project (null until the AI Director plans one in live mode) */
  project: ProjectData | null
  setProject: (p: ProjectData | null) => void
  /** Reloads the project from the backend (after jobs finish) */
  refreshProject: () => Promise<ProjectData | null>
}

export const StudioContext = createContext<StudioContextValue>({
  project: null,
  setProject: () => {},
  refreshProject: async () => null,
})

export const useStudio = () => useContext(StudioContext)

/** The film shown on every screen: the live project's memory, or the design's sample film. */
export function useFilm(): FilmProject {
  const { project } = useStudio()
  return project?.memory ?? FILM_PROJECT
}
