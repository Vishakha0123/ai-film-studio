import { useState } from 'react'
import type { NavFn } from '../types'
import { signIn, signInWithGoogle, DEMO_MODE, AUTH_PROVIDER } from '../api'

const FilmIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
    <rect x="2" y="7" width="20" height="10" rx="1" />
    <path d="M7 7V4M17 7V4M7 17v3M17 17v3M2 12h20" />
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

export default function Login({ navigate }: { navigate: NavFn }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password, mode)
      navigate('onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
      navigate('onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed')
      setLoading(false)
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
          <p className="text-sm text-zinc-500 mt-1">
            {mode === 'login' ? 'Welcome back, director.' : 'Begin your first film.'}
          </p>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors text-sm font-medium text-zinc-200 mb-5 disabled:opacity-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600">or</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              type="email"
              aria-label="Email address"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              aria-label="Password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-400 px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 mt-2"
            style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                Signing in…
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600 mt-5">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
            onClick={() => setMode(m => (m === 'login' ? 'signup' : 'login'))}
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>

        {DEMO_MODE && (
          <p className="text-center text-[10px] text-zinc-700 mt-6 tracking-wide">Demo mode — no backend connected</p>
        )}
        {AUTH_PROVIDER === 'dev' && (
          <p className="text-center text-[10px] text-zinc-700 mt-6 tracking-wide">Dev login — any email works (Supabase not configured)</p>
        )}
      </div>
    </div>
  )
}
