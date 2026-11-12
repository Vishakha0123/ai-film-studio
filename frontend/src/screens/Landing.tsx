import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { NavFn } from '../types'
import { signOut } from '../api'
import { SITE_LANGUAGES } from '../site'
import { PublicFooter, PublicNav } from '../components/public/PublicChrome'
import DemoVideo from '../components/public/DemoVideo'

const GOLD = '#d4a84b'
const serif = { fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }

const ROTATING_PROMPTS = [
  '"I want a 2 hour movie: a Punjabi family and a Tamil family fight over a wedding"',
  '"Create a horror story about an abandoned lighthouse keeper"',
  '"Write a romantic screenplay set in 1940s Buenos Aires"',
  '"Make an action teaser — heist gone catastrophically wrong"',
  '"A grandmother teaches her grandson to swim in the river"',
]

const STEPS = [
  { n: '01', title: 'Describe your idea', text: 'Type or speak it in any language — “a 2-hour Tamil family drama”. Attach a script if you have one.' },
  { n: '02', title: 'AI builds the film', text: 'Story, cast with portraits, screenplay, dialogue, scenes and storyboard — each section ready to edit.' },
  { n: '03', title: 'Direct & export', text: 'Change anything in plain words, then download the full script as PDF or TXT.' },
]

const FEATURES: { icon: string; title: string; text: string; soon?: boolean }[] = [
  { icon: 'M4 5h7v14H4zM13 5h7v14h-7z', title: 'Story & characters', text: 'A full story and cast, each with a matched portrait by age and gender.' },
  { icon: 'M3 7h18v10H3zM7 7V4M17 7V4M7 17v3M17 17v3', title: 'Full-length films', text: '10 minutes to 2 hours — every scene written with script and dialogue.' },
  { icon: 'M4 5h10v7H8l-4 3zM20 10v8l-3-2h-6v-3', title: 'Many languages, one film', text: 'A Punjabi family and a Tamil family — each speaks its own language, with subtitles.' },
  { icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7', title: 'Script PDF', text: 'Download the screenplay as PDF or TXT, in any Indian script.' },
  { icon: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3', title: 'Direct the AI', text: '“Make it darker”, “add a twist” — every section changes on request.' },
  { icon: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z', title: 'Songs & lyrics', text: 'Theme songs written for the story, in the film’s language.' },
  { icon: 'M4 6h12v12H4zM16 10l5-3v10l-5-3', title: 'Teaser & video', text: 'Cinematic teasers and scene-by-scene video.', soon: true },
  { icon: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z', title: 'Private by default', text: 'Your films are yours — only you can see them.' },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
      <path d={d} />
    </svg>
  )
}

/** The home page — everyone sees it first; a signed-in visitor gets "Open Studio" instead of "Sign In". */
export default function Landing({ navigate, signedIn = false }: { navigate: NavFn; signedIn?: boolean }) {
  const start = () => navigate(signedIn ? 'director' : 'login')
  const signIn = () => navigate(signedIn ? 'director' : 'login')
  const location = useLocation()
  const routerNavigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  // Exit sends us here first and we sign out once on this page, so the studio never bounces to the sign-in page.
  const exiting = !!(location.state as { signOut?: boolean } | null)?.signOut
  useEffect(() => {
    if (!exiting) return
    void signOut()
    routerNavigate('/', { replace: true, state: null })
  }, [exiting, routerNavigate])

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

  const toSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  // Arriving from another page at "/#features" (top bar / footer links): scroll to that section
  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50)
  }, [location.hash])

  // "?demo=1" (the footer's Watch demo link on other pages) opens the video
  const demoOpen = search.get('demo') === '1'
  const openDemo = () => setSearch(p => { p.set('demo', '1'); return p }, { replace: true })
  const closeDemo = useCallback(() => setSearch(p => { p.delete('demo'); return p }, { replace: true }), [setSearch])

  return (
    <div className="relative h-full overflow-y-auto bg-zinc-950" data-testid="screen-landing">
      <PublicNav signedIn={signedIn} onStart={start} onSignIn={signIn} onSection={toSection} />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 film-grain" aria-hidden>
          <img
            src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=1920&h=1080&fit=crop&auto=format&q=80"
            alt=""
            className="w-full h-full object-cover"
            style={{ opacity: 0.18 }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(9,9,11,0.6) 0%, rgba(9,9,11,0.5) 50%, rgba(9,9,11,1) 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 20%, rgba(9,9,11,0.7) 100%)' }} />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-20 sm:pt-28 sm:pb-24">
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border animate-fade-up"
            style={{ borderColor: 'rgba(212,168,75,0.25)', backgroundColor: 'rgba(212,168,75,0.06)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD, boxShadow: '0 0 6px rgba(212,168,75,0.8)' }} />
            <span className="tracking-widest uppercase" style={{ color: GOLD, fontSize: '10px' }}>AI-Powered Filmmaking Studio</span>
          </div>
          <h1 className="animate-fade-up text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] mb-6 max-w-4xl" style={{ ...serif, animationDelay: '0.08s' }}>
            Turn Your Ideas<br />
            <em style={{ color: GOLD, fontStyle: 'italic' }}>Into Films.</em>
          </h1>
          <p className="animate-fade-up text-base md:text-lg text-zinc-400 max-w-xl mb-8 leading-relaxed" style={{ animationDelay: '0.16s' }}>
            Describe your idea. AI writes your story, characters, screenplay and scenes — from a teaser to a full 2-hour film, in 10 Indian languages.
          </p>
          <div className="animate-fade-up min-h-7 flex items-center mb-10 max-w-2xl" style={{ animationDelay: '0.22s' }}>
            <p className="text-sm italic text-zinc-500 transition-all duration-300"
              style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(4px)' }}>
              {ROTATING_PROMPTS[promptIdx]}
            </p>
          </div>
          <div className="animate-fade-up flex flex-col sm:flex-row gap-3" style={{ animationDelay: '0.28s' }}>
            <button onClick={start} className="px-8 py-3.5 text-sm font-semibold tracking-wide rounded transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: GOLD, color: '#09090b' }} data-testid="landing-create">
              Create With AI
            </button>
            <button onClick={openDemo} data-testid="landing-watch-demo"
              className="px-8 py-3.5 text-sm font-medium border border-zinc-700 hover:border-zinc-500 rounded text-zinc-300 hover:text-zinc-100 transition-all flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden><path d="M8 5v14l11-7z" /></svg>
              Watch Demo · 1 min
            </button>
          </div>
        </div>
      </header>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 px-5 sm:px-8 lg:px-16 py-20 border-t border-zinc-900" data-testid="landing-how">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-light mb-3" style={serif}>From one line to a full film</h2>
            <p className="text-sm text-zinc-500">Three steps. You stay the director.</p>
          </div>
          <ol className="grid md:grid-cols-3 gap-4">
            {STEPS.map(s => (
              <li key={s.n} className="rounded-2xl p-6 border border-zinc-800/80" style={{ backgroundColor: '#111113' }}>
                <span className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: GOLD }}>{s.n}</span>
                <h3 className="text-base font-semibold mt-3 mb-2" style={{ color: '#f4f0ea' }}>{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 px-5 sm:px-8 lg:px-16 py-20 border-t border-zinc-900" data-testid="landing-features">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-light text-center mb-12" style={serif}>Everything a film needs</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl p-6 border border-zinc-800/80" style={{ backgroundColor: '#111113' }}>
                <Icon d={f.icon} />
                <h3 className="text-base font-semibold mt-3 mb-2 flex items-center gap-2" style={{ color: '#f4f0ea' }}>
                  {f.title}
                  {f.soon && <span className="text-[9px] tracking-[0.18em] uppercase text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5">Soon</span>}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section id="languages" className="scroll-mt-16 px-5 sm:px-8 lg:px-16 py-20 border-t border-zinc-900 text-center" data-testid="landing-languages">
        <h2 className="text-3xl sm:text-4xl font-light mb-3" style={serif}>Made for India’s many voices</h2>
        <p className="text-sm text-zinc-500 mb-8">Write in one language — or let each family speak its own.</p>
        <div className="flex flex-wrap justify-center gap-2.5 max-w-4xl mx-auto">
          {SITE_LANGUAGES.map(l => (
            <span key={l} className="px-4 py-2 rounded-full border border-zinc-800 text-sm text-zinc-200">{l}</span>
          ))}
        </div>
      </section>

      {/* Final call to action */}
      <section className="px-6 py-20 text-center" style={{ background: 'linear-gradient(180deg, #09090b, #1a1408)' }}>
        <h2 className="text-3xl sm:text-4xl font-light mb-8" style={serif}>Your next film starts with one sentence.</h2>
        <button onClick={start} className="px-8 py-3.5 text-sm font-semibold tracking-wide rounded transition-all hover:opacity-90"
          style={{ backgroundColor: GOLD, color: '#09090b' }} data-testid="landing-cta">
          Create With AI — it’s free to try
        </button>
      </section>

      <PublicFooter onSection={toSection} onDemo={openDemo} onSignIn={signIn} />

      <DemoVideo open={demoOpen} onClose={closeDemo} onStart={() => { closeDemo(); start() }} />
    </div>
  )
}
