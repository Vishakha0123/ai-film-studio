import { useState } from 'react'
import type { NavFn } from '../types'

const FORMATS = [
  { id: '16:9', label: '16:9', sub: '1920×1080 · MP4', icon: '▬', desc: 'Cinema / Desktop' },
  { id: '9:16', label: '9:16', sub: '1080×1920 · MP4', icon: '▮', desc: 'Instagram Stories · TikTok' },
  { id: '1:1', label: '1:1', sub: '1080×1080 · MP4', icon: '■', desc: 'Instagram · Twitter' },
]

const QUALITY = [
  { id: '4k', label: '4K', sub: '3840×2160', badge: 'Pro' },
  { id: '1080', label: '1080p', sub: '1920×1080', badge: null },
  { id: '720', label: '720p', sub: '1280×720', badge: null },
]

const DownloadIcon = ({ className, stroke = 'currentColor', strokeWidth = 2 }: { className: string; stroke?: string; strokeWidth?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} className={className}>
    <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function ExportScreen({ navigate }: { navigate: NavFn }) {
  const [selectedFormat, setSelectedFormat] = useState('16:9')
  const [selectedQuality, setSelectedQuality] = useState('1080')
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)

  const handleExport = () => {
    setExporting(true)
    setTimeout(() => {
      setExporting(false)
      setExported(true)
    }, 2200)
  }

  return (
    <div className="relative flex flex-col h-full bg-zinc-950 overflow-hidden" data-testid="screen-export">
      {/* Subtle bg */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(212,168,75,0.04) 0%, transparent 60%)' }} />

      {/* Nav */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => navigate('teaser')}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Teaser
        </button>
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#52525b' }}>Export</span>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-lg my-auto animate-fade-up">
          {/* Header */}
          <div className="text-center mb-12">
            {exported ? (
              <>
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" className="w-7 h-7">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 className="text-3xl font-light mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
                  Your Teaser Is Ready.
                </h1>
                <p className="text-sm text-zinc-500">Echoes of the Forgotten · {selectedFormat} · {selectedQuality}</p>
              </>
            ) : (
              <>
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgba(212,168,75,0.1)', border: '1px solid rgba(212,168,75,0.2)' }}
                >
                  <DownloadIcon className="w-7 h-7" stroke="#d4a84b" strokeWidth={1.5} />
                </div>
                <h1 className="text-3xl font-light mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>
                  Export Your Film
                </h1>
                <p className="text-sm text-zinc-500">Echoes of the Forgotten · 10 seconds · Horror Thriller</p>
              </>
            )}
          </div>

          {/* Preview thumbnail */}
          <div
            className="relative rounded-xl overflow-hidden mb-8"
            style={{
              aspectRatio: selectedFormat === '9:16' ? '9/16' : selectedFormat === '1:1' ? '1/1' : '16/9',
              maxHeight: 220,
              margin: '0 auto 32px',
              maxWidth: selectedFormat === '9:16' ? 124 : selectedFormat === '1:1' ? 220 : '100%',
            }}
          >
            <img
              src="https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&h=450&fit=crop&auto=format"
              alt="Teaser preview"
              className="w-full h-full object-cover"
              style={{ filter: 'grayscale(25%) contrast(1.2) brightness(0.7)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#d4a84b' }}>Preview</p>
                <p className="text-xs font-semibold" style={{ color: '#f4f0ea', fontFamily: 'Fraunces, Georgia, serif' }}>Echoes of the Forgotten</p>
              </div>
            </div>
          </div>

          {/* Format selection */}
          <div className="mb-5">
            <p className="text-xs text-zinc-600 mb-3">Format</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  aria-pressed={selectedFormat === f.id}
                  className="flex flex-col items-center px-2 sm:px-3 py-4 rounded-xl border transition-all text-center"
                  style={{
                    borderColor: selectedFormat === f.id ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: selectedFormat === f.id ? 'rgba(212,168,75,0.07)' : '#111113',
                  }}
                >
                  <span className="text-lg mb-2" style={{ color: selectedFormat === f.id ? '#d4a84b' : '#3f3f46' }}>{f.icon}</span>
                  <span className="text-xs font-semibold" style={{ color: selectedFormat === f.id ? '#f4f0ea' : '#71717a' }}>{f.label}</span>
                  <span className="text-[10px] text-zinc-600 mt-0.5">{f.sub}</span>
                  <span className="text-[10px] mt-1" style={{ color: selectedFormat === f.id ? '#d4a84b' : '#52525b' }}>{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality selection */}
          <div className="mb-8">
            <p className="text-xs text-zinc-600 mb-3">Quality</p>
            <div className="flex gap-2">
              {QUALITY.map(q => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuality(q.id)}
                  aria-pressed={selectedQuality === q.id}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all"
                  style={{
                    borderColor: selectedQuality === q.id ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)',
                    backgroundColor: selectedQuality === q.id ? 'rgba(212,168,75,0.07)' : 'transparent',
                  }}
                >
                  <span className="text-xs font-semibold" style={{ color: selectedQuality === q.id ? '#f4f0ea' : '#71717a' }}>{q.label}</span>
                  {q.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(212,168,75,0.2)', color: '#d4a84b' }}>
                      {q.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Export / Download button */}
          {exported ? (
            <div className="space-y-3">
              <button
                className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#10b981', color: '#fff' }}
              >
                <DownloadIcon className="w-4 h-4" />
                Download MP4
              </button>
              <div className="flex gap-2">
                {['Copy Link', 'Share', 'New Film'].map(a => (
                  <button
                    key={a}
                    onClick={a === 'New Film' ? () => navigate('landing') : undefined}
                    className="flex-1 py-2.5 rounded-xl text-sm border transition-all hover:opacity-80"
                    style={{ borderColor: 'rgba(255,255,255,0.08)', color: '#71717a' }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#d4a84b', color: '#09090b' }}
            >
              {exporting ? (
                <>
                  <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  Exporting…
                </>
              ) : (
                <>Export {selectedFormat} · {selectedQuality}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
