import type { Lyrics } from '../types'

/** The film's other songs (the theme song is shown on its own), each with the scene it plays in and who sings it. */
export default function MoreSongs({ songs }: { songs?: Lyrics[] }) {
  if (!songs?.length) return null
  return (
    <div className="space-y-4" data-testid="more-songs">
      <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#d4a84b' }}>More songs · {songs.length}</p>
      {songs.map((s, i) => (
        <div key={i} className="px-5 sm:px-6 py-5 rounded-xl" style={{ backgroundColor: 'rgba(212,168,75,0.04)', border: '1px solid rgba(212,168,75,0.12)' }} data-testid="more-song">
          <p className="text-sm font-semibold text-zinc-200">{s.title || `Song ${i + 2}`}</p>
          <p className="text-xs text-zinc-500 mb-4">
            {[s.style, s.scene ? `Scene ${s.scene}` : '', s.singer ? `sung by ${s.singer}` : ''].filter(Boolean).join(' · ')}
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {([['Verse', s.verse], ['Pre-Chorus', s.preChorus], ['Chorus', s.chorus], ['Bridge', s.bridge]] as const)
              .filter(([, text]) => text)
              .map(([label, text]) => (
                <div key={label}>
                  <p className="text-[10px] text-zinc-600 mb-1 uppercase tracking-widest">{label}</p>
                  <p className="text-sm leading-7 italic text-zinc-400 whitespace-pre-wrap" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{text}</p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}
