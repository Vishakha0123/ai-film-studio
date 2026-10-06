import { useState, useEffect } from 'react'
import type { NavFn } from '../types'

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
}

export default function Generation({ navigate, stepDuration = 900 }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [stepProgress, setStepProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return

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
  }, [currentStep, done, stepDuration])

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
            Echoes of the Forgotten
          </h1>
          <p className="text-sm text-zinc-500">Horror / Psychological Thriller · 10 seconds</p>
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
                  {isActive && <p className="text-[10px] text-zinc-600 mt-0.5">{step.desc}</p>}
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
