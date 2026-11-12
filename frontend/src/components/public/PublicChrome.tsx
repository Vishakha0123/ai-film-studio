import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SITE } from '../../site'

const GOLD = '#d4a84b'

export const FilmIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden>
    <rect x="2" y="7" width="20" height="10" rx="1" />
    <path d="M7 7V4M17 7V4M7 17v3M17 17v3M2 12h20" />
    <circle cx="7" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="4" r="1" fill="currentColor" stroke="none" />
    <circle cx="7" cy="20" r="1" fill="currentColor" stroke="none" />
    <circle cx="17" cy="20" r="1" fill="currentColor" stroke="none" />
  </svg>
)

/** Sections of the home page the top bar and footer jump to. */
export const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'languages', label: 'Languages' },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" style={{ color: GOLD }} aria-label={`${SITE.name} home`}>
      <FilmIcon />
      <span className="text-xs font-semibold uppercase" style={{ color: '#f4f0ea', letterSpacing: '0.18em' }}>{SITE.name}</span>
    </Link>
  )
}

/**
 * Top bar of the public pages. On the home page the section links scroll (`onSection`); elsewhere they go to
 * the home page at that section.
 */
export function PublicNav({ signedIn, onStart, onSignIn, onSection }: {
  signedIn: boolean
  onStart: () => void
  onSignIn: () => void
  onSection?: (id: string) => void
}) {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between gap-4 px-5 sm:px-8 lg:px-16 py-4 border-b border-zinc-900"
      style={{ backgroundColor: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(8px)' }} data-testid="public-nav">
      <Logo />
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="hidden md:flex items-center gap-6">
          {SECTIONS.map(s => onSection
            ? <button key={s.id} type="button" onClick={() => onSection(s.id)} className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">{s.label}</button>
            : <Link key={s.id} to={`/#${s.id}`} className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">{s.label}</Link>)}
          <Link to="/contact" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Contact</Link>
        </div>
        {signedIn ? (
          <button onClick={onStart} className="text-sm px-4 py-2 rounded border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-all" data-testid="landing-open-studio">
            Open Studio
          </button>
        ) : (
          <>
            <button className="text-sm text-zinc-300 hover:text-zinc-100 transition-colors" onClick={onSignIn}>Sign In</button>
            <button onClick={onSignIn} className="text-sm px-4 py-2 rounded border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-all">
              Get Started
            </button>
          </>
        )}
      </div>
    </nav>
  )
}

/** Footer of the public pages: product links, company, legal, copyright and contact email. */
export function PublicFooter({ onSection, onDemo, onSignIn }: { onSection?: (id: string) => void; onDemo?: () => void; onSignIn: () => void }) {
  const linkCls = 'block text-sm text-zinc-400 hover:text-zinc-100 transition-colors mb-2.5 text-left'
  const head = 'text-[11px] font-semibold tracking-[0.18em] uppercase text-zinc-500 mb-4'
  return (
    <footer className="border-t border-zinc-900 px-5 sm:px-8 lg:px-16 pt-12 pb-8" data-testid="public-footer">
      <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-8">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="text-sm text-zinc-500 mt-3 max-w-xs leading-relaxed">AI filmmaking studio — from idea to full-length film, in Indian languages.</p>
        </div>
        <div>
          <p className={head}>Product</p>
          {SECTIONS.slice(0, 2).map(s => onSection
            ? <button key={s.id} type="button" onClick={() => onSection(s.id)} className={linkCls}>{s.label}</button>
            : <Link key={s.id} to={`/#${s.id}`} className={linkCls}>{s.label}</Link>)}
          {onDemo
            ? <button type="button" onClick={onDemo} className={linkCls}>Watch demo</button>
            : <Link to="/?demo=1" className={linkCls}>Watch demo</Link>}
          <button type="button" onClick={onSignIn} className={linkCls}>Sign in</button>
        </div>
        <div>
          <p className={head}>Company</p>
          <Link to="/about" className={linkCls}>About</Link>
          <Link to="/contact" className={linkCls}>Contact us</Link>
        </div>
        <div>
          <p className={head}>Legal</p>
          <Link to="/privacy" className={linkCls}>Privacy Policy</Link>
          <Link to="/terms" className={linkCls}>Terms of Service</Link>
        </div>
      </div>
      <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row gap-2 justify-between text-xs text-zinc-600">
        <span>© {SITE.year} {SITE.name}. All rights reserved.</span>
        <a href={`mailto:${SITE.email}`} className="hover:text-zinc-300">{SITE.email}</a>
      </div>
    </footer>
  )
}

/** Layout for the About, Contact, Privacy and Terms pages: top bar, a readable column, footer. */
export function PublicPage({ title, eyebrow, signedIn, onStart, onSignIn, children, testId }: {
  title: string
  eyebrow: string
  signedIn: boolean
  onStart: () => void
  onSignIn: () => void
  children: ReactNode
  testId: string
}) {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950" data-testid={testId}>
      <PublicNav signedIn={signedIn} onStart={onStart} onSignIn={onSignIn} />
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: GOLD }}>{eyebrow}</p>
        <h1 className="text-4xl sm:text-5xl font-light mb-8" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>{title}</h1>
        <div className="legal text-[15px] leading-relaxed text-zinc-300">{children}</div>
      </main>
      <PublicFooter onSignIn={onSignIn} />
    </div>
  )
}
