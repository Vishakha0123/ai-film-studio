import { useState } from 'react'
import type { NavFn } from '../types'
import { signInWithProvider, DEMO_MODE, AUTH_PROVIDER, type AuthProvider } from '../api'

const FilmIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <rect x="2" y="7" width="20" height="10" rx="1" />
    <path d="M7 7V4M17 7V4M7 17v3M17 17v3M2 12h20" />
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
    <path d="M16.37 12.73c-.02-2.35 1.92-3.48 2.01-3.53-1.1-1.6-2.8-1.82-3.4-1.85-1.44-.15-2.82.85-3.55.85-.74 0-1.86-.83-3.06-.81-1.57.02-3.02.92-3.83 2.33-1.64 2.84-.42 7.04 1.17 9.35.78 1.13 1.7 2.39 2.91 2.35 1.17-.05 1.61-.75 3.02-.75 1.41 0 1.8.75 3.04.73 1.26-.02 2.05-1.15 2.82-2.28.89-1.3 1.25-2.57 1.27-2.63-.03-.01-2.43-.93-2.46-3.69zM14.05 5.83c.64-.78 1.08-1.86.96-2.94-.93.04-2.05.62-2.72 1.4-.6.69-1.12 1.79-.98 2.85 1.04.08 2.1-.53 2.74-1.31z" />
  </svg>
)

const Spinner = () => (
  <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
  </svg>
)

const PROVIDERS: { id: AuthProvider; label: string; icon: () => React.ReactElement }[] = [
  { id: 'google', label: 'Continue with Google', icon: GoogleIcon },
  { id: 'apple', label: 'Continue with Apple', icon: AppleIcon },
]

export default function Login({ navigate }: { navigate: NavFn }) {
  const [pending, setPending] = useState<AuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handle = async (provider: AuthProvider) => {
    setError(null)
    setPending(provider)
    try {
      await signInWithProvider(provider)
      navigate('onboarding')
    } catch (err) {
      const name = provider === 'google' ? 'Google' : 'Apple'
      setError(err instanceof Error ? `${name} sign-in didn't work: ${err.message}` : `${name} sign-in didn't work. Try again.`)
      setPending(null)
    }
  }

  return (
    <div className="relative flex items-center justify-center h-full bg-zinc-950 overflow-hidden" data-testid="screen-login">
      {/* Subtle background */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=800&fit=crop&auto=format&q=60"
          alt=""
          aria-hidden
          className="w-full h-full object-cover"
          style={{ opacity: 0.06 }}
        />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(212,168,75,0.04) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6 animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <button
            onClick={() => navigate('landing')}
            aria-label="Back to home"
            className="mb-4 p-3 rounded-xl"
            style={{ backgroundColor: 'rgba(212,168,75,0.12)', color: '#d4a84b' }}
          >
            <FilmIcon />
          </button>
          <h1 className="text-xl font-semibold" style={{ color: '#f4f0ea' }}>Cinéma AI</h1>
          <p className="text-sm text-zinc-500 mt-1">Welcome, director. Sign in to start your film.</p>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => handle(p.id)}
              disabled={pending !== null}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors text-sm font-medium text-zinc-200 disabled:opacity-50"
            >
              {pending === p.id ? <Spinner /> : <p.icon />}
              {pending === p.id ? 'Connecting…' : p.label}
            </button>
          ))}
        </div>

        {error && <p role="alert" className="text-xs text-red-400 mt-4 text-center">{error}</p>}

        <p className="text-center text-xs text-zinc-600 mt-6 leading-relaxed">
          New here? Continuing creates your account.
        </p>

        {DEMO_MODE && (
          <p className="text-center text-[10px] text-zinc-700 mt-6 tracking-wide">Demo mode — no backend connected</p>
        )}
        {AUTH_PROVIDER === 'dev' && (
          <p className="text-center text-[10px] text-zinc-700 mt-6 tracking-wide">Dev login — each button signs in a local test user (Supabase not configured)</p>
        )}
      </div>
    </div>
  )
}
