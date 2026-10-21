import { useState } from 'react'
import { DEMO_MODE, assertCompleted, editProject, patchMemory, waitForJob, type EditAction, type EditScope, type MemoryPatch } from '../api'
import { useStudio } from '../studio'

export const NEEDS_BACKEND = 'This needs the studio backend — the demo film can’t be changed.'

export type EditTarget = 'story' | 'screenplay' | 'characters' | 'scenes' | 'shots' | 'dialogue' | 'lyrics'

/**
 * One place for a panel's AI actions and hand edits: runs the job or the save, refreshes the film,
 * and exposes what's happening (`working`) and what went wrong (`error`).
 */
export function useFilmEdit() {
  const { project, setProject, refreshProject } = useStudio()
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const canEdit = !DEMO_MODE && !!project

  const run = async (label: string, fn: () => Promise<void>): Promise<boolean> => {
    setError(null)
    if (!canEdit) {
      setError(NEEDS_BACKEND)
      return false
    }
    setWorking(label)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work. Try again.')
      return false
    } finally {
      setWorking(null)
    }
  }

  /** Ask the story model to change one part of the film (it keeps the film's language). */
  const ai = (label: string, target: EditTarget, action: EditAction, instruction: string, scope: EditScope = {}) =>
    run(label, async () => {
      assertCompleted(await waitForJob(await editProject(project!.id, action, target, instruction, scope)))
      await refreshProject()
    })

  /** Save the creator's own change. */
  const save = (label: string, patch: MemoryPatch) =>
    run(label, async () => {
      setProject(await patchMemory(project!.id, patch))
    })

  return { working, error, canEdit, ai, save, clearError: () => setError(null) }
}
