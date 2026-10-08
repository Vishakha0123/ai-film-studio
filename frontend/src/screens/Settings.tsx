import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_PROVIDER, DEMO_MODE, getHealth, getMe, savePreferences, signOut } from '../api'
import { API_BASE } from '../api/client'
import { useStudio } from '../studio'
import type { Health, Me, Preferences } from '../types'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'Tamil' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'bn', label: 'Bengali' },
  { code: 'mr', label: 'Marathi' },
]

const PROVIDER_NAMES: Record<string, Record<string, string>> = {
  story: { sarvam: 'Sarvam-105B', mock: 'Sample film (mock)' },
  image: { openai: 'OpenAI GPT Image', mock: 'Placeholder frames (mock)' },
  video: { seedance: 'Seedance · Atlas Cloud', mock: 'No video (mock)' },
  tts: { sarvam: 'Sarvam Bulbul', mock: 'Test tone (mock)' },
  stt: { sarvam: 'Sarvam Saaras', mock: 'Browser speech (mock server)' },
}

const AUTH_LABEL: Record<string, string> = {
  supabase: 'Supabase Auth',
  dev: 'Dev login (local only)',
  demo: 'Demo mode — no account',
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-5 rounded-xl space-y-4" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#52525b' }}>{eyebrow}</p>
        <h3 className="text-lg font-light mt-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="px-4 py-2 rounded-lg text-xs font-medium border transition-all"
      style={active
        ? { backgroundColor: 'rgba(212,168,75,0.12)', borderColor: 'rgba(212,168,75,0.4)', color: '#d4a84b' }
        : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }}
    >
      {children}
    </button>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { preferences, setPreferences, newFilm } = useStudio()
  const [me, setMe] = useState<Me | null>(null)
  const [form, setForm] = useState<Preferences>(preferences)
  const [health, setHealth] = useState<Health | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    getMe().then(m => { setMe(m); setForm(m.preferences) }).catch(e => setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not load your account.' }))
    getHealth().then(setHealth)
  }, [])

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    setMessage(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const saved = await savePreferences(form)
      setPreferences(saved.preferences)
      setMessage({ ok: true, text: 'Saved. New films use these defaults.' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save settings.' })
    } finally {
      setSaving(false)
    }
  }

  const logOut = async () => {
    await signOut()
    newFilm()
    navigate('/login')
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Studio Settings</p>
          <h2 className="text-3xl font-light" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Settings</h2>
        </div>

        <Section eyebrow="Account" title={me?.preferences.displayName || me?.email || 'Your account'}>
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt className="text-zinc-600">Email</dt>
            <dd className="text-zinc-300 break-all" data-testid="account-email">{me?.email ?? '…'}</dd>
            <dt className="text-zinc-600">Sign-in</dt>
            <dd className="text-zinc-300">{AUTH_LABEL[AUTH_PROVIDER]}</dd>
          </dl>
          <button onClick={logOut} className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#d4d4d8' }}>
            Sign out
          </button>
        </Section>

        <form onSubmit={save}>
          <Section eyebrow="Defaults for new films" title="Creative defaults">
            <label className="block">
              <span className="block text-xs text-zinc-600 mb-2">Display name</span>
              <input
                id="display-name"
                value={form.displayName}
                onChange={e => update('displayName', e.target.value)}
                maxLength={120}
                placeholder="How the AI Director addresses you"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 placeholder-zinc-600 text-sm focus:outline-none focus:border-zinc-600"
              />
            </label>

            <label className="block">
              <span className="block text-xs text-zinc-600 mb-2">Story & voice language</span>
              <select
                id="language"
                value={form.language}
                onChange={e => update('language', e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 cursor-pointer"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label htmlFor="teaser-length" className="text-xs text-zinc-600">Teaser length</label>
                <span className="text-xs font-semibold" style={{ color: '#d4a84b', fontVariantNumeric: 'tabular-nums' }}>{form.teaserSeconds} seconds</span>
              </div>
              <input
                id="teaser-length"
                type="range"
                min={10}
                max={60}
                step={5}
                value={form.teaserSeconds}
                onChange={e => update('teaserSeconds', Number(e.target.value))}
                className="w-full accent-[#d4a84b] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-700 mt-1"><span>10s</span><span>30s</span><span>60s</span></div>
            </div>

            <div>
              <p className="text-xs text-zinc-600 mb-2">Aspect ratio</p>
              <div className="flex flex-wrap gap-2">
                {([['16:9', 'Wide · YouTube'], ['9:16', 'Vertical · Reels'], ['1:1', 'Square']] as const).map(([v, label]) => (
                  <Chip key={v} active={form.aspectRatio === v} onClick={() => update('aspectRatio', v)}>{v} · {label}</Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-600 mb-2">Generation quality</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={form.quality === 'draft'} onClick={() => update('quality', 'draft')}>Draft · cheaper, faster</Chip>
                <Chip active={form.quality === 'final'} onClick={() => update('quality', 'final')}>Final · full quality</Chip>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              {message && (
                <p role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-red-300'}`}>{message.text}</p>
              )}
            </div>
          </Section>
        </form>

        <Section eyebrow="Studio connection" title={DEMO_MODE ? 'Demo mode' : health ? 'Connected' : health === null ? 'Backend unreachable' : 'Checking…'}>
          {DEMO_MODE ? (
            <p className="text-sm text-zinc-500">No backend is connected. Set <code className="text-zinc-300">VITE_API_URL</code> in <code className="text-zinc-300">frontend/.env</code> to use the live studio.</p>
          ) : (
            <>
              <p className="text-xs text-zinc-600 break-all">{API_BASE} {health && `· API v${health.version}`}</p>
              {health && (
                <ul className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }} data-testid="provider-list">
                  {(['story', 'image', 'video', 'tts', 'stt'] as const).map(k => {
                    const id = health.providers[k] ?? 'mock'
                    const live = id !== 'mock'
                    return (
                      <li key={k} className="flex items-center justify-between py-2.5 text-sm" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                        <span className="text-zinc-500">{{ story: 'Story & screenplay', image: 'Images', video: 'Video', tts: 'Voice', stt: 'Voice input' }[k]}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-zinc-300">{PROVIDER_NAMES[k][id] ?? id}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={live ? { backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981' } : { backgroundColor: 'rgba(113,113,122,0.15)', color: '#a1a1aa' }}>
                            {live ? 'Live' : 'Mock'}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="text-xs text-zinc-600">Providers and keys are configured on the server in <code className="text-zinc-400">backend/.env</code>.</p>
            </>
          )}
        </Section>
      </div>
    </div>
  )
}
