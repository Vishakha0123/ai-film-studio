import { useState } from 'react'
import { FILM_PROJECT } from '../types'
import type { AudioTrack } from '../types'

const TYPE_COLORS: Record<string, string> = {
  voice: '#8b7cf6',
  music: '#06b6d4',
  sfx: '#f97316',
  ambience: '#10b981',
}

const TYPE_LABELS: Record<string, string> = {
  voice: 'Voice',
  music: 'Music',
  sfx: 'SFX',
  ambience: 'Ambience',
}

const COMMANDS = ['Add thunder', 'Make voice scarier', 'Remove music', 'Add heartbeat', 'Increase reverb', 'Add choir', 'Silence ambience']

const SpeakerPath = 'M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z'

export default function Audio() {
  const [tracks, setTracks] = useState<AudioTrack[]>(FILM_PROJECT.audioTracks)
  const [command, setCommand] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const progress = 65

  const setVolume = (id: string, volume: number) => setTracks(t => t.map(tr => (tr.id === id ? { ...tr, volume } : tr)))
  const toggleActive = (id: string) => setTracks(t => t.map(tr => (tr.id === id ? { ...tr, active: !tr.active } : tr)))

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-8" data-testid="panel-audio">
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-up">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: '#d4a84b' }}>Audio Studio</p>
          <h2 className="text-3xl font-light mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#f4f0ea' }}>Sound Design</h2>
          <p className="text-sm text-zinc-500">Voice · Music · SFX · Ambience · Subtitles</p>
        </div>

        {/* Mini player */}
        <div className="px-5 py-4 rounded-xl" style={{ backgroundColor: '#111113', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-4 mb-4">
            <button
              aria-label={isPlaying ? 'Pause mix' : 'Play mix'}
              onClick={() => setIsPlaying(p => !p)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-80 flex-shrink-0"
              style={{ backgroundColor: '#d4a84b' }}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="#09090b" className="w-4 h-4"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="#09090b" className="w-4 h-4"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 mb-1 truncate">Echoes of the Forgotten — Full Mix</p>
              <div className="relative h-1 rounded-full" style={{ backgroundColor: '#27272a' }}>
                <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: '#d4a84b' }} />
              </div>
            </div>
            <span className="text-xs text-zinc-600 font-mono flex-shrink-0">0:06 / 0:10</span>
          </div>

          {/* Subtitle toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-8 h-4 rounded-full peer-checked:bg-[#d4a84b] bg-zinc-700 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-xs text-zinc-500">Show Subtitles</span>
          </label>
        </div>

        {/* Tracks */}
        <div className="space-y-3">
          <p className="text-xs text-zinc-600">Audio Tracks</p>
          {tracks.map(track => (
            <TrackRow key={track.id} track={track} onVolumeChange={v => setVolume(track.id, v)} onToggle={() => toggleActive(track.id)} />
          ))}
          <button
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed text-xs text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-all"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            Generate Additional Track
          </button>
        </div>

        {/* Audio commands */}
        <div>
          <p className="text-xs text-zinc-600 mb-3">Audio Commands</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {COMMANDS.map(cmd => (
              <button
                key={cmd}
                onClick={() => setCommand(cmd)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all"
                style={{ borderColor: command === cmd ? 'rgba(212,168,75,0.4)' : 'rgba(255,255,255,0.07)', color: command === cmd ? '#d4a84b' : '#71717a' }}
              >
                {cmd}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: '#111113', borderColor: 'rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              aria-label="Audio command"
              placeholder='Try "Add thunder at 6 seconds" or "Make the piano more ghostly"'
              value={command}
              onChange={e => setCommand(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
            />
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ backgroundColor: '#d4a84b', color: '#09090b' }}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackRow({ track, onVolumeChange, onToggle }: { track: AudioTrack; onVolumeChange: (v: number) => void; onToggle: () => void }) {
  const color = TYPE_COLORS[track.type]

  return (
    <div
      data-testid={`track-${track.id}`}
      data-active={track.active}
      className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl border transition-all"
      style={{
        backgroundColor: '#111113',
        borderColor: track.active ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
        opacity: track.active ? 1 : 0.45,
      }}
    >
      <button onClick={onToggle} className="flex-shrink-0" aria-label={`${track.active ? 'Mute' : 'Unmute'} ${track.name}`}>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center border transition-all"
          style={{ borderColor: track.active ? color : 'rgba(255,255,255,0.12)', backgroundColor: track.active ? `${color}20` : 'transparent' }}
        >
          {track.active && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
        </div>
      </button>

      <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: `${color}18`, color }}>
        {TYPE_LABELS[track.type]}
      </span>

      <p className="text-xs font-medium flex-1 min-w-0 truncate" style={{ color: track.active ? '#d4d4d8' : '#71717a' }}>{track.name}</p>

      <span className="hidden sm:inline text-[10px] font-mono text-zinc-600 flex-shrink-0">{track.duration}</span>

      <div className="flex items-center gap-2 w-20 sm:w-24 flex-shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" className="w-3.5 h-3.5 flex-shrink-0">
          <path d={SpeakerPath} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input
          type="range"
          aria-label={`${track.name} volume`}
          min={0}
          max={100}
          value={track.volume}
          onChange={e => onVolumeChange(Number(e.target.value))}
          className="flex-1 min-w-0 h-0.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: color }}
        />
      </div>
    </div>
  )
}
