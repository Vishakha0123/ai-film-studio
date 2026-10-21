import { useState, useEffect } from 'react'
import type { NavFn } from '../types'

const ROTATING_PROMPTS = [
  '"Create a horror story about an abandoned lighthouse keeper"',
  '"Write a romantic screenplay set in 1940s Buenos Aires"',
  '"Make an action teaser — heist gone catastrophically wrong"',
  '"Create emotional dialogue between two estranged sisters"',
  '"Write movie lyrics for a haunting love theme"',
]

const GENRE_CHIPS = ['Horror', 'Romance', 'Action', 'Thriller', 'Drama', 'Sci-Fi', 'Mystery', 'Musical']

const FilmIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <rect x="2" y="7" width="20" height="10" rx="1" />
    <path d="M7 7V4M17 7V4M7 17v3M17 17v3M2 12h20" />
    <circle cx="7" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="7" cy="20" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="20" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export default function Landing({ navigate }: { navigate: NavFn }) {
  const [promptIdx, setPromptIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let inner: ReturnType<typeof setTimeout> | undefined
    const timer = setInterval(() => {
      setVisible(false)
      inner = setTimeout(() => {
        setPromptIdx(i => (i + 1) % ROTATING_PROMPTS.length)
        setVisible(true)
      }, 350)
    }, 3500)
    return () => {
      clearInterval(timer)
      if (inner) clearTimeout(inner)
    }
  }, [])

  return (
    <div className="relative flex flex-col h-full overflow-hidden bg-zinc-950" data-testid="screen-landing">
      {/* Cinematic background */}
      <div className="absolute inset-0 film-grain">
        <img
          src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1920&h=1080&fit=crop&auto=format&q=80"
          alt=""
          aria-hidden
          className="w-full h-full object-cover"
          style={{ opacity: 0.18 }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(9,9,11,0.6) 0%, rgba(9,9,11,0.5) 50%, rgba(9,9,11,0.95) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(9,9,11,0.7) 100%)' }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-5 sm:px-8 py-5">
        <div className="flex items-center gap-2.5" style={{ color: '#d4a84b' }}>
          <FilmIcon />
          <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: '#f4f0ea', letterSpacing: '0.18em' }}>
            Cinéma AI
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            onClick={() => navigate('login')}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('login')}
            className="text-sm px-4 py-2 rounded border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-all"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center overflow-y-auto">
        {/* Badge */}
        <div
          className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border animate-fade-up"
          style={{ borderColor: 'rgba(212,168,75,0.25)', backgroundColor: 'rgba(212,168,75,0.06)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#d4a84b', boxShadow: '0 0 6px rgba(212,168,75,0.8)' }} />
          <span className="text-xs tracking-widest uppercase" style={{ color: '#d4a84b', fontSize: '10px' }}>
            AI-Powered Filmmaking Studio
          </span>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-up text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] mb-6 max-w-4xl"
          style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea', animationDelay: '0.08s' }}
        >
          Turn Your Ideas<br />
          <em style={{ color: '#d4a84b', fontStyle: 'italic' }}>Into Films.</em>
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-up text-base md:text-lg text-zinc-400 max-w-lg mb-10 leading-relaxed"
          style={{ animationDelay: '0.16s' }}
        >
          Describe your idea. AI creates your story, screenplay, characters, and cinematic teaser — in minutes.
        </p>

        {/* Rotating example */}
        <div className="animate-fade-up min-h-7 flex items-center mb-10" style={{ animationDelay: '0.22s' }}>
          <p
            className="text-sm italic text-zinc-500 transition-all duration-300"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)' }}
          >
            {ROTATING_PROMPTS[promptIdx]}
          </p>
        </div>

        {/* CTAs */}
        <div className="animate-fade-up flex flex-col sm:flex-row gap-3 mb-12" style={{ animationDelay: '0.28s' }}>
          <button
            onClick={() => navigate('login')}
            className="px-8 py-3.5 text-sm font-semibold tracking-wide rounded transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
          >
            Create With AI
          </button>
          <button className="px-8 py-3.5 text-sm font-medium border border-zinc-700 hover:border-zinc-500 rounded text-zinc-300 hover:text-zinc-100 transition-all flex items-center justify-center gap-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5v14l11-7z" /></svg>
            Watch Demo
          </button>
        </div>

        {/* Genre chips */}
        <div className="animate-fade-up flex flex-wrap justify-center gap-2 max-w-2xl" style={{ animationDelay: '0.34s' }}>
          {GENRE_CHIPS.map(g => (
            <button
              key={g}
              onClick={() => navigate('login')}
              className="text-xs px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300 transition-all"
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative z-10 flex items-center justify-center gap-1 px-5 sm:px-8 py-5 border-t border-zinc-900 text-center">
        <span className="text-xs text-zinc-700 tracking-widest uppercase">
          Story · Characters · Screenplay · Storyboard · Voice · Music · 10s Teaser
        </span>
      </div>
    </div>
  )
}
