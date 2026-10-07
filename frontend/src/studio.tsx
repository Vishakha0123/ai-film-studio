import { createContext, useContext } from 'react'
import { DEFAULT_PREFERENCES, FILM_PROJECT, type FilmProject, type Preferences, type ProjectData } from './types'

export interface StudioContextValue {
  /** The current film project (null until one is planned or opened in live mode) */
  project: ProjectData | null
  setProject: (p: ProjectData | null) => void
  /** Reloads the project from the backend (after jobs finish) */
  refreshProject: () => Promise<ProjectData | null>
  /** Makes a saved project current and opens all its Director stages */
  openProject: (p: ProjectData) => void
  /** Clears the workspace for a new film */
  newFilm: () => void
  /** Creator defaults from Settings */
  preferences: Preferences
  setPreferences: (p: Preferences) => void
}

export const StudioContext = createContext<StudioContextValue>({
  project: null,
  setProject: () => {},
  refreshProject: async () => null,
  openProject: () => {},
  newFilm: () => {},
  preferences: DEFAULT_PREFERENCES,
  setPreferences: () => {},
})

export const useStudio = () => useContext(StudioContext)

/** The film shown on every screen: the live project's memory, or the design's sample film. */
export function useFilm(): FilmProject {
  const { project } = useStudio()
  return project?.memory ?? FILM_PROJECT
}
