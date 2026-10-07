import { useCallback, useEffect, useRef, useState } from 'react'
import type { CostEstimate, Job, NavFn } from '../types'
import { filmSeconds } from '../types'
import { DEMO_MODE, assertCompleted, estimateCost, startGeneration, waitForJob } from '../api'
import { useFilm, useStudio } from '../studio'

const STEPS = [
  { id: 'understand', label: 'Understanding', desc: 'Analyzing story, characters, and tone' },
  { id: 'write', label: 'Writing', desc: 'Finalizing screenplay and dialogue' },
  { id: 'design', label: 'Designing', desc: 'Applying Dark Cinema visual language' },
  { id: 'storyboard', label: 'Storyboarding', desc: 'Composing 4 cinematic shots' },
  { id: 'visuals', label: 'Generating Visuals', desc: 'Rendering photorealistic frames' },
  { id: 'video', label: 'Generating Video', desc: 'Creating 10-second motion sequence' },
  { id: 'voice', label: 'Creating Voice', desc: "Synthesizing Elena's voice performance" },
  { id: 'audio', label: 'Music & SFX', desc: 'Composing dark symphony + atmosphere' },
  { id: 'render', label: 'Rendering', desc: 'Final composite at 1080p 16:9' },
]

export const GENERATION_STEP_COUNT = STEPS.length

interface Props {
  navigate: NavFn
  /** Milliseconds per step. Defaults to the Figma prototype pacing. */
  stepDuration?: number
  /** Live mode: how often to poll the job (ms) */
  pollMs?: number
}

interface GenState {
  currentStep: number
  stepProgress: number
  done: boolean
  /** Live mode: what the backend is doing right now */
  stage?: string
  error?: string
  /** Live mode: cost estimate waiting for the creator's confirmation */
  confirm?: CostEstimate
  start?: () => void
}

/** Figma prototype pacing — used in demo mode. */
function useDemoGeneration(stepDuration: number, enabled: boolean): GenState {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done || !enabled) return

    const progressInterval = setInterval(() => {
      setStepProgress(p => {
        if (p >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return p + 4
      })
    }, stepDuration / 25)

    const stepTimer = setTimeout(() => {
      setStepProgress(0)
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(s => s + 1)
      } else {
        setDone(true)
      }
    }, stepDuration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(stepTimer)
    }
  }, [currentStep, done, stepDuration, enabled])

  return { currentStep, stepProgress, done }
}

/** Live mode: estimate cost, start the generate job, and follow its progress. */
function useLiveGeneration(enabled: boolean, pollMs: number): GenState {
  const { project, refreshProject } = useStudio()
  const [job, setJob] = useState<Job | null>(null)
  const [confirm, setConfirm] = useState<CostEstimate | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [done, setDone] = useState(false)
  const started = useRef(false)

  const run = useCallback(async (confirmCost: boolean) => {
    if (!project) return
    setConfirm(undefined)
    setError(undefined)
    try {
      const first = await startGeneration(project.id, 'draft', confirmCost)
      const finished = await waitForJob(first, setJob, { intervalMs: pollMs })
      assertCompleted(finished)
      await refreshProject()
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.')
    }
  }, [project, refreshProject, pollMs])

  useEffect(() => {
    if (!enabled || started.current) return
    started.current = true
    if (!project) {
      setError('Start a film in the AI Director first — there is nothing to generate yet.')
      return
    }
    estimateCost(project.id, 'draft')
      .then(est => (est.requiresConfirmation ? setConfirm(est) : run(false)))
      .catch(e => setError(e instanceof Error ? e.message : 'Could not estimate the cost.'))
  }, [enabled, project, run])

  const progress = done ? 100 : job?.progress ?? 0
  const exact = (progress / 100) * STEPS.length
  return {
    currentStep: Math.min(STEPS.length - 1, Math.floor(exact)),
    stepProgress: Math.round((exact % 1) * 100),
    done,
    stage: job?.stage,
    error,
    confirm,
    start: () => run(true),
  }
}

export default function Generation({ navigate, stepDuration = 900, pollMs = 1500 }: Props) {
  const demo = useDemoGeneration(stepDuration, DEMO_MODE)
  const live = useLiveGeneration(!DEMO_MODE, pollMs)
  const { currentStep, stepProgress, done, stage, error, confirm, start } = DEMO_MODE ? demo : live
  const film = useFilm()

  // Once every step is complete, hand over to the teaser player.
  useEffect(() => {
    if (!done) return
    const finishTimer = setTimeout(() => navigate('teaser'), 600)
    return () => clearTimeout(finishTimer)
  }, [done, navigate])

  const totalPercent = done ? 100 : Math.round(((currentStep + stepProgress / 100) / STEPS.length) * 100)

  return (
    <div className="relative flex flex-col items-center justify-center h-full bg-zinc-950 overflow-hidden" data-testid="screen-generation">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&h=1080&fit=crop&auto=format&q=60"
          alt=""
          aria-hidden
          className="w-full h-full object-cover"
          style={{ opacity: 0.08 }}
        />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(212,168,75,0.05) 0%, transparent 60%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 sm:px-8 text-center overflow-y-auto max-h-full py-6 md:py-0">
        {/* Title */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#d4a84b' }}>
            {done ? 'Complete' : 'Generating'}
          </p>
          <h1
            className="text-3xl font-light mb-2"
            style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}
          >
            {film.title}
          </h1>
          <p className="text-sm text-zinc-500">{film.genre} · {filmSeconds(film)} seconds</p>
        </div>

        {/* Progress ring */}
        <div className="flex items-center justify-center mb-10">
          <div className="relative">
            <svg viewBox="0 0 120 120" className="w-28 h-28 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke="#d4a84b"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - totalPercent / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.3s ease', filter: 'drop-shadow(0 0 6px rgba(212,168,75,0.5))' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                data-testid="generation-percent"
                className="text-2xl font-semibold"
                style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}
              >
                {totalPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2 mb-10 text-left">
          {STEPS.map((step, i) => {
            const isActive = i === currentStep && !done
            const isComplete = i < currentStep || done

            return (
              <div
                key={step.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                style={{
                  backgroundColor: isActive ? 'rgba(212,168,75,0.07)' : isComplete ? 'rgba(255,255,255,0.02)' : 'transparent',
                  border: isActive ? '1px solid rgba(212,168,75,0.2)' : '1px solid transparent',
                }}
              >
                {/* Status icon */}
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                  {isComplete ? (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" className="w-3 h-3">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ) : isActive ? (
                    <div className="w-5 h-5 rounded-full border-2 spinner" style={{ borderColor: '#d4a84b', borderTopColor: 'transparent' }} />
                  ) : (
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#1a1a1e' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold" style={{ color: isActive ? '#f4f0ea' : isComplete ? '#52525b' : '#3f3f46' }}>
                    {step.label}
                  </p>
                  {isActive && <p className="text-[10px] text-zinc-600 mt-0.5">{stage || step.desc}</p>}
                </div>

                {isActive && (
                  <div className="w-16 flex-shrink-0">
                    <div className="h-0.5 rounded-full" style={{ backgroundColor: '#27272a' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${stepProgress}%`, backgroundColor: '#d4a84b' }} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Live mode: cost confirmation before expensive generation */}
        {confirm && (
          <div className="mb-8 px-5 py-4 rounded-xl text-left" style={{ backgroundColor: 'rgba(212,168,75,0.06)', border: '1px solid rgba(212,168,75,0.2)' }} data-testid="cost-confirm">
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Estimated cost</p>
            <p className="text-sm text-zinc-300 mb-1">
              {confirm.currency === 'USD' ? '$' : ''}{confirm.estimatedCost.toFixed(2)} · {confirm.images} images · {confirm.videoSeconds}s of video · {confirm.voiceLines} voice lines
            </p>
            <p className="text-xs text-zinc-600 mb-4">Draft quality. You can regenerate single shots later without paying for the whole teaser again.</p>
            <button onClick={start} className="px-5 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
              Generate for ${confirm.estimatedCost.toFixed(2)}
            </button>
          </div>
        )}

        {error && (
          <div className="mb-8 px-5 py-4 rounded-xl text-left" role="alert" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <p className="text-sm text-red-300 mb-3">{error}</p>
            <button onClick={() => navigate('director')} className="px-4 py-2 rounded-lg text-xs font-medium border" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#d4d4d8' }}>
              Back to the AI Director
            </button>
          </div>
        )}

        {/* Shot-level note */}
        <p className="text-xs text-zinc-700">
          Each shot generates independently — regenerate any single shot without restarting
        </p>

        {/* Cancel */}
        <button
          onClick={() => navigate('director')}
          className="mt-6 text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
        >
          Cancel and return to editor
        </button>
      </div>
    </div>
  )
}
