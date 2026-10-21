import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_MODE, getHealth, listProjectJobs, makePortraits, waitForJob } from '../api'
import { useStudio } from '../studio'

let imageModel: Promise<string> | null = null
/** Which image model the studio uses ("mock" = none — characters keep their drawn portraits). */
const imageProvider = () => (imageModel ??= getHealth().then(h => h?.providers.image ?? 'mock').catch(() => 'mock'))

/**
 * Photo portraits of the cast. The backend takes them on its own after a film is planned and when a
 * character is added or their age, gender or look changes; this follows those jobs (so the faces
 * appear without a reload) and asks for a new photo on request.
 */
export function usePortraits() {
  const { project, refreshProject } = useStudio()
  const [stage, setStage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState<boolean | null>(DEMO_MODE ? false : null)
  const watching = useRef(false)
  const refresh = useRef(refreshProject)
  refresh.current = refreshProject
  const projectId = project?.id

  useEffect(() => {
    if (!DEMO_MODE) void imageProvider().then(p => setLive(p !== 'mock'))
  }, [])

  /** Follow any portraits job still running for this film, refreshing the faces when it's done. */
  const watch = useCallback(async () => {
    if (DEMO_MODE || !projectId || watching.current) return
    watching.current = true
    try {
      for (let round = 0; round < 5; round++) {
        const job = (await listProjectJobs(projectId, true).catch(() => [])).find(j => j.task === 'portraits')
        if (!job) break
        setStage(job.stage || 'Getting the camera ready')
        const done = await waitForJob(job, j => setStage(j.stage || 'Getting the camera ready'))
        await refresh.current()
        if (done.status !== 'completed') setError(`Photo portraits didn't work: ${done.error || done.status}`)
      }
    } finally {
      watching.current = false
      setStage(null)
    }
  }, [projectId])

  useEffect(() => { void watch() }, [watch])

  /** A new photo for these characters (or everyone without one). */
  const newPhoto = async (characterIds?: string[]) => {
    setError(null)
    if (DEMO_MODE || !projectId) {
      setError('Photo portraits need the studio backend and an image model.')
      return
    }
    try {
      await makePortraits(projectId, characterIds)
      await watch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the photo.')
    }
  }

  return { stage, error, live, watch, newPhoto }
}
