import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_PROVIDER, DEMO_MODE, VOICES, deleteAccount, exportMyData, getHealth, getMe, previewVoice, savePreferences, signOut } from '../api'
import { API_BASE } from '../api/client'
import { useStudio } from '../studio'
import { DEFAULT_PREFERENCES, type Health, type Me, type Preferences } from '../types'
import { FILM_LANGUAGES } from '../lib/languages'

const LANGUAGES = FILM_LANGUAGES.map(l => ({ code: l.code, label: l.code === 'en' ? l.label : `${l.label} · ${l.native}` }))

const PROVIDER_NAMES: Record<string, Record<string, string>> = {
  story: { sarvam: 'Sarvam-105B', mock: 'Sample film (mock)' },
  image: { openai: 'OpenAI GPT Image', mock: 'Placeholder frames (mock)' },
  video: { seedance: 'Seedance · Atlas Cloud', mock: 'No video (mock)' },
  tts: { sarvam: 'Sarvam Bulbul', mock: 'Test tone (mock)' },
  stt: { sarvam: 'Sarvam Saaras', mock: 'Browser speech (mock server)' },
}

/** Storyboard looks (same presets as the Storyboard page) with a swatch of each. */
const VISUAL_STYLES: { name: string; swatch: string }[] = [
  { name: 'Dark Cinema', swatch: 'linear-gradient(135deg,#1c1917,#78350f)' },
  { name: 'Photorealistic', swatch: 'linear-gradient(135deg,#475569,#a8a29e)' },
  { name: 'Anime', swatch: 'linear-gradient(135deg,#ec4899,#38bdf8)' },
  { name: '3D Render', swatch: 'linear-gradient(135deg,#6366f1,#fbbf24)' },
  { name: 'Vintage', swatch: 'linear-gradient(135deg,#92400e,#fde68a)' },
]

const FILM_LENGTHS = [
  { value: 'short', label: 'Short', note: '3 scenes · fastest' },
  { value: 'medium', label: 'Medium', note: '5 scenes' },
  { value: 'long', label: 'Long', note: '8 scenes · slower' },
] as const

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)

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
  const [preview, setPreview] = useState<{ state: 'idle' | 'loading' | 'playing' } | { state: 'error'; text: string }>({ state: 'idle' })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [dataMessage, setDataMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => () => { audioRef.current?.pause() }, [])

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

  const resetDefaults = () => {
    setForm(f => ({ ...DEFAULT_PREFERENCES, displayName: f.displayName }))
    setMessage({ ok: true, text: 'Defaults restored — press Save settings to keep them.' })
  }

  const playPreview = async () => {
    audioRef.current?.pause()
    setPreview({ state: 'loading' })
    try {
      const url = URL.createObjectURL(await previewVoice(form.voice, form.voicePace, form.language))
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPreview({ state: 'idle' }); URL.revokeObjectURL(url) }
      setPreview({ state: 'playing' })
      await audio.play()
    } catch (err) {
      setPreview({ state: 'error', text: err instanceof Error ? err.message : 'Could not play the preview.' })
    }
  }

  const downloadData = async () => {
    setDataMessage(null)
    try {
      const url = URL.createObjectURL(await exportMyData())
      const a = document.createElement('a')
      a.href = url
      a.download = 'cinema-ai-export.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDataMessage({ ok: true, text: 'Your films and settings were downloaded.' })
    } catch (err) {
      setDataMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not export your data.' })
    }
  }

  const removeAccount = async () => {
    setDeleting(true)
    setDataMessage(null)
    try {
      await deleteAccount()
      newFilm()
      navigate('/login')
    } catch (err) {
      setDataMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not delete your account.' })
      setDeleting(false)
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

        <form onSubmit={save} className="space-y-6">
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
              <p className="text-xs text-zinc-600 mb-2">Visual style</p>
              <div className="flex flex-wrap gap-2" data-testid="style-defaults">
                {VISUAL_STYLES.map(st => (
                  <Chip key={st.name} active={form.visualStyle === st.name} onClick={() => update('visualStyle', st.name)}>
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className="w-3 h-3 rounded-full" style={{ background: st.swatch }} />
                      {st.name}
                    </span>
                  </Chip>
                ))}
              </div>
              <p className="text-[11px] text-zinc-700 mt-2">The storyboard look every new film starts with. You can still change it per film.</p>
            </div>

            <div>
              <p className="text-xs text-zinc-600 mb-2">Film length</p>
              <div className="flex flex-wrap gap-2" data-testid="length-defaults">
                {FILM_LENGTHS.map(l => (
                  <Chip key={l.value} active={form.filmLength === l.value} onClick={() => update('filmLength', l.value)}>
                    {l.label} <span className="opacity-60">· {l.note}</span>
                  </Chip>
                ))}
              </div>
              <p className="text-[11px] text-zinc-700 mt-2">How many scenes the AI writes. Shorter films come back faster.</p>
            </div>
          </Section>

          <Section eyebrow="Voice" title="Character voice">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-xs text-zinc-600 mb-2">Voice</span>
                <select
                  id="voice"
                  value={form.voice}
                  onChange={e => { update('voice', e.target.value); setPreview({ state: 'idle' }) }}
                  className="w-full px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-zinc-600 cursor-pointer"
                >
                  {VOICES.map(v => <option key={v} value={v}>{cap(v)}</option>)}
                </select>
              </label>
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <label htmlFor="voice-pace" className="text-xs text-zinc-600">Speaking speed</label>
                  <span className="text-xs font-semibold" style={{ color: '#d4a84b', fontVariantNumeric: 'tabular-nums' }}>{form.voicePace.toFixed(2)}×</span>
                </div>
                <input
                  id="voice-pace"
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={form.voicePace}
                  onChange={e => update('voicePace', Number(e.target.value))}
                  className="w-full accent-[#d4a84b] cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-zinc-700 mt-1"><span>Slow</span><span>Normal</span><span>Fast</span></div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => (preview.state === 'playing' ? (audioRef.current?.pause(), setPreview({ state: 'idle' })) : void playPreview())}
                disabled={preview.state === 'loading'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-60"
                style={{ borderColor: 'rgba(212,168,75,0.3)', color: '#d4a84b', backgroundColor: 'rgba(212,168,75,0.06)' }}
              >
                {preview.state === 'playing'
                  ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                  : <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M8 5v14l11-7z" /></svg>}
                {preview.state === 'loading' ? 'Loading…' : preview.state === 'playing' ? 'Stop' : 'Preview voice'}
              </button>
              <span className="text-[11px] text-zinc-700">Spoken in the story language above.</span>
              {preview.state === 'error' && <p role="alert" className="w-full text-xs text-red-300">{preview.text}</p>}
            </div>
          </Section>

          <Section eyebrow="Teaser · coming soon" title="Teaser defaults">
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
          </Section>

          <div className="flex flex-wrap items-center gap-3" data-testid="settings-actions">
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            <button type="button" onClick={resetDefaults} className="px-4 py-2.5 rounded-lg text-xs font-medium border transition-all hover:text-zinc-200" style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#a1a1aa' }}>
              Reset to defaults
            </button>
            {message && (
              <p role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-emerald-400' : 'text-red-300'}`}>{message.text}</p>
            )}
          </div>
        </form>

        <Section eyebrow="Your data" title="Your films & account">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void downloadData()} className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:opacity-80" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#d4d4d8' }}>
              Export all my films
            </button>
            <span className="text-[11px] text-zinc-700">One JSON file with your settings and every film's story, characters, script and dialogue.</span>
          </div>

          <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-lg text-xs font-medium border transition-all hover:bg-red-500/10" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                Delete my account
              </button>
            ) : (
              <div className="space-y-3 p-4 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)' }} data-testid="delete-confirm">
                <p className="text-xs text-red-200">This permanently deletes all your films, characters, uploaded files and settings. It can't be undone. Export first if you want a copy.</p>
                <label className="block">
                  <span className="block text-xs text-zinc-500 mb-2">Type <b className="text-zinc-200">DELETE</b> to confirm</span>
                  <input
                    value={deleteText}
                    onChange={e => setDeleteText(e.target.value)}
                    aria-label="Type DELETE to confirm"
                    className="w-full sm:w-60 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 text-sm focus:outline-none focus:border-red-400/50"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={deleteText !== 'DELETE' || deleting} onClick={() => void removeAccount()} className="px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40" style={{ backgroundColor: '#dc2626', color: '#fff' }}>
                    {deleting ? 'Deleting…' : 'Delete everything'}
                  </button>
                  <button type="button" onClick={() => { setConfirmDelete(false); setDeleteText('') }} className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          {dataMessage && <p role={dataMessage.ok ? 'status' : 'alert'} className={`text-xs ${dataMessage.ok ? 'text-emerald-400' : 'text-red-300'}`}>{dataMessage.text}</p>}
        </Section>

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
              <p className="text-xs text-zinc-600">
                <span className="text-zinc-400">Live</span> uses the real AI service. <span className="text-zinc-400">Mock</span> is a free stand-in for testing — add that provider's key in <code className="text-zinc-400">backend/.env</code> and restart the backend to make it live.
              </p>
            </>
          )}
        </Section>
      </div>
    </div>
  )
}
