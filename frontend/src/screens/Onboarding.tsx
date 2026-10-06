import type { NavFn } from '../types'

const GENRES = [
  { name: 'Horror', emoji: '👁', desc: 'Fear and the unknown' },
  { name: 'Action', emoji: '⚡', desc: 'High stakes, fast pace' },
  { name: 'Romance', emoji: '◯', desc: 'Love and connection' },
  { name: 'Thriller', emoji: '◈', desc: 'Tension and suspense' },
  { name: 'Comedy', emoji: '▷', desc: 'Light and laughter' },
  { name: 'Drama', emoji: '◇', desc: 'Human complexity' },
  { name: 'Fantasy', emoji: '✦', desc: 'Worlds beyond worlds' },
  { name: 'Sci-Fi', emoji: '◉', desc: 'Future and possibility' },
  { name: 'Mystery', emoji: '◈', desc: 'Questions and answers' },
  { name: 'Musical', emoji: '♩', desc: 'Story through song' },
  { name: 'Documentary', emoji: '◎', desc: 'Real and true' },
  { name: 'Custom', emoji: '+', desc: 'Define your own' },
]

interface Props {
  navigate: NavFn
  selected: string[]
  setSelected: (fn: (s: string[]) => string[]) => void
}

export default function Onboarding({ navigate, selected, setSelected }: Props) {
  const toggle = (name: string) => {
    setSelected(s => (s.includes(name) ? s.filter(x => x !== name) : [...s, name]))
  }

  return (
    <div className="relative flex flex-col h-full bg-zinc-950 overflow-hidden" data-testid="screen-onboarding">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,75,0.06) 0%, transparent 60%)' }} />

      <div className="relative z-10 flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-8 py-6">
          <span className="text-xs font-semibold tracking-widest uppercase text-zinc-600">Cinéma AI</span>
          <button
            onClick={() => navigate('director')}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-10">
              <h1
                className="text-3xl md:text-4xl font-light mb-3"
                style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}
              >
                What do you want to create?
              </h1>
              <p className="text-sm text-zinc-500">Choose your genre — or mix and match. You can always change it later.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-10">
              {GENRES.map(g => {
                const isSelected = selected.includes(g.name)
                return (
                  <button
                    key={g.name}
                    onClick={() => toggle(g.name)}
                    aria-pressed={isSelected}
                    className="relative flex flex-col items-start p-4 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: isSelected ? '#d4a84b' : 'rgba(255,255,255,0.07)',
                      backgroundColor: isSelected ? 'rgba(212,168,75,0.08)' : 'rgba(255,255,255,0.02)',
                      boxShadow: isSelected ? '0 0 0 1px rgba(212,168,75,0.3)' : 'none',
                    }}
                  >
                    <span className="text-lg mb-2" style={{ color: isSelected ? '#d4a84b' : '#52525b' }}>{g.emoji}</span>
                    <span className="text-sm font-medium" style={{ color: isSelected ? '#f4f0ea' : '#a1a1aa' }}>{g.name}</span>
                    <span className="text-xs mt-0.5" style={{ color: isSelected ? '#a1a1aa' : '#52525b' }}>{g.desc}</span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d4a84b' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#09090b" strokeWidth="3" className="w-2.5 h-2.5">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => selected.length > 0 && navigate('director')}
                disabled={selected.length === 0}
                className="px-10 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  backgroundColor: selected.length > 0 ? '#d4a84b' : '#27272a',
                  color: selected.length > 0 ? '#09090b' : '#71717a',
                  cursor: selected.length > 0 ? 'pointer' : 'default',
                }}
              >
                {selected.length > 0 ? `Continue with ${selected.slice(0, 2).join(' & ')}${selected.length > 2 ? ' +more' : ''}` : 'Select a genre to continue'}
              </button>
              {selected.length === 0 && (
                <button
                  onClick={() => navigate('director')}
                  className="px-10 py-3 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
