export type Screen = 'landing' | 'login' | 'onboarding' | 'director' | 'generation' | 'teaser' | 'export'
export type Panel = 'chat' | 'story' | 'characters' | 'screenplay' | 'dialogue' | 'lyrics' | 'scenes' | 'storyboard' | 'audio' | 'music'
export type NavFn = (s: Screen) => void

export const SCREENS: Screen[] = ['landing', 'login', 'onboarding', 'director', 'generation', 'teaser', 'export']
export const PANELS: Panel[] = ['chat', 'story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio', 'music']

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  card?: 'story' | 'characters' | 'screenplay' | 'dialogue' | 'lyrics' | 'scenes' | 'storyboard' | 'generate'
}

export interface Character {
  id: string
  name: string
  age: string
  role: string
  personality: string
  appearance: string
  arc: string
  relationships: string
  imageId: string
  /** Generated portrait (backend asset), falls back to imageId photo */
  imageUrl?: string
}

export interface Scene {
  id: string
  number: number
  location: string
  time: string
  characters: string[]
  mood: string
  duration: string
  description: string
}

export interface Shot {
  id: string
  number: number
  duration: string
  camera: string
  movement: string
  description: string
  characters: string
  mood: string
  imageId: string
  /** Generated storyboard frame and video clip (backend assets) */
  imageUrl?: string
  videoUrl?: string
}

export interface AudioTrack {
  id: string
  type: 'voice' | 'music' | 'sfx' | 'ambience'
  name: string
  duration: string
  volume: number
  active: boolean
  url?: string
}

export interface DialogueLine {
  character: string
  text: string
  tone: string
}

export interface FilmProject {
  title: string
  genre: string
  tone: string
  logline: string
  story: string
  characters: Character[]
  screenplay: string
  scenes: Scene[]
  shots: Shot[]
  audioTracks: AudioTrack[]
  dialogue?: DialogueLine[]
}

export interface Asset {
  id: string
  type: 'character_image' | 'storyboard_image' | 'video_clip' | 'voice' | 'render' | string
  ref: string
  url: string
  provider: string
  version: number
  status: 'ready' | 'outdated' | string
  meta: Record<string, unknown>
}

/** A film project as returned by the backend */
export interface ProjectData {
  id: string
  title: string
  genre: string
  status: string
  memory: FilmProject | null
  assets: Asset[]
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'needs_review'

export interface Job {
  id: string
  projectId: string
  task: string
  status: JobStatus
  stage: string
  progress: number
  result: Record<string, unknown>
  cost: number
  error: string
}

export interface CostEstimate {
  quality: 'draft' | 'final'
  images: number
  videoSeconds: number
  voiceLines: number
  estimatedCost: number
  currency: string
  requiresConfirmation: boolean
}

/** Photo for a character/shot: generated asset if present, otherwise the design's Unsplash still. */
export function photoUrl(item: { imageUrl?: string; imageId: string }, w: number, h: number, q = 80): string {
  if (item.imageUrl) return item.imageUrl
  const id = item.imageId || "1478720568477-152d9b164e26"
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=${q}`
}

export const FILM_PROJECT: FilmProject = {
  title: 'Echoes of the Forgotten',
  genre: 'Horror / Psychological Thriller',
  tone: 'Dark, Atmospheric, Haunting',
  logline: "A grieving composer discovers her late husband's unfinished symphony contains messages from beyond the grave—but the music is slowly rewriting her mind.",
  story: `Six months after her husband Thomas dies in a mysterious studio fire, award-winning composer Elena Vasquez retreats to their isolated mountain estate to finish his final symphony.

As Elena immerses herself in Thomas's cryptic notation, she begins hearing subtle variations the score never contained—whispered instructions that only she can hear. The music seems to breathe, evolve, and respond to her emotional state.

When Elena's colleague James arrives and can hear nothing unusual, Elena begins to question her sanity. But then the symphony plays itself—and the message is unmistakable: Thomas didn't die in that fire. Someone made sure he would.`,
  characters: [
    {
      id: '1',
      name: 'Elena Vasquez',
      age: '32',
      role: 'Protagonist',
      personality: 'Brilliant but fragile. Obsessive in grief. Refuses help until it is too late.',
      appearance: 'Dark circles beneath expressive brown eyes. Always in black. Moves as though hearing music no one else can.',
      arc: 'From broken recluse to reluctant investigator — someone who must choose between truth and sanity.',
      relationships: 'Widowed wife of Thomas. Tense friendship with James.',
      imageId: '1494790108377-be9c29b29330',
    },
    {
      id: '2',
      name: 'Thomas Vasquez',
      age: '35',
      role: 'The Presence',
      personality: 'Warm yet desperate. Communicates only through music. Can warn, never act.',
      appearance: 'Glimpsed in mirrors and reflections. Always just out of frame. Smiling but afraid.',
      arc: 'From victim to guide. His love for Elena becomes the one thing that can still protect her.',
      relationships: "Elena's husband. Former student of a shadowy conservatory.",
      imageId: '1507003211169-0a1dd7228f2d',
    },
    {
      id: '3',
      name: 'Dr. James Chen',
      age: '45',
      role: 'Antagonist / Ambiguous',
      personality: 'Rational. Protective. But he knows more than he admits.',
      appearance: 'Immaculate in grey. Careful hands. Eyes that linger a moment too long.',
      arc: "Positioned as Elena's anchor to reality — but whose side is he truly on?",
      relationships: 'Colleague and friend of Elena. Former colleague of Thomas.',
      imageId: '1500648767791-00dcc994a43e',
    },
  ],
  screenplay: `ECHOES OF THE FORGOTTEN

FADE IN:

EXT. MOUNTAIN ESTATE — DUSK

A long shot of an isolated stone house, half-consumed by creeping ivy. Storm clouds gather on the ridge behind it. A single window glows amber.

INT. STUDY — CONTINUOUS

ELENA VASQUEZ (32) sits at an antique piano, surrounded by handwritten sheet music scattered across the floor. She is translucent with exhaustion. Her fingers hover over the keys but do not press.

She stares at a single page of notation. Something about it bothers her.

ELENA
(whispering)
That's not what you wrote.

She reaches for a pencil. Stops. The notation on the page has changed.

INT. STUDY — LATER

Elena plays the new passage. The music fills the room — haunting, searching. She closes her eyes.

When she opens them, there is a shape in the window behind her reflection.

She turns.

Nothing.

ELENA
(to herself)
Thomas.

The music continues. She is no longer playing.

CUT TO:

EXT. MOUNTAIN ESTATE — NIGHT

DR. JAMES CHEN (45) arrives in a black car. He sits for a moment, watching the house through rain-streaked glass. He picks up his phone.

JAMES
(quietly)
She found it. The symphony is active.

He listens.

JAMES (CONT'D)
I understand. I'll keep her calm.

He steps out into the rain.

SMASH CUT TO BLACK.`,
  scenes: [
    { id: '1', number: 1, location: 'EXT. MOUNTAIN ESTATE', time: 'DUSK', characters: ['Elena'], mood: 'Foreboding', duration: '2.5s', description: 'Wide establishing shot. Storm approaching the estate.' },
    { id: '2', number: 2, location: 'INT. STUDY', time: 'CONTINUOUS', characters: ['Elena'], mood: 'Unsettling', duration: '3s', description: 'Elena discovers the changed notation.' },
    { id: '3', number: 3, location: 'INT. STUDY', time: 'LATER', characters: ['Elena', 'Thomas (reflection)'], mood: 'Horror', duration: '3s', description: 'Music plays itself. Shape appears in window.' },
    { id: '4', number: 4, location: 'EXT. MOUNTAIN ESTATE', time: 'NIGHT', characters: ['James'], mood: 'Conspiracy', duration: '1.5s', description: 'James makes a sinister phone call in the rain.' },
  ],
  shots: [
    { id: '1', number: 1, duration: '2.5s', camera: 'Wide', movement: 'Slow push-in', description: 'Mountain estate at dusk. Storm clouds visible on ridge behind it.', characters: 'None', mood: 'Foreboding', imageId: '1518709268805-4e9042af9f23' },
    { id: '2', number: 2, duration: '2s', camera: 'Close-up', movement: 'Static with rack focus', description: "Elena's hands hovering over piano keys. Changed notation visible in foreground.", characters: 'Elena', mood: 'Tension', imageId: '1536440136628-849c177e76a1' },
    { id: '3', number: 3, duration: '3s', camera: 'Medium', movement: 'Very slow push-in from behind', description: 'Elena plays. A shape forms in the window behind her reflection.', characters: 'Elena, Thomas', mood: 'Horror', imageId: '1478720568477-152d9b164e26' },
    { id: '4', number: 4, duration: '2.5s', camera: 'Close-up', movement: 'Static', description: 'James on phone in rain. Rain streaks across his face. Sinister calm.', characters: 'James', mood: 'Conspiracy', imageId: '1551373066-08073d2bf558' },
  ],
  audioTracks: [
    { id: '1', type: 'voice', name: 'Elena — "Thomas"', duration: '0:03', volume: 85, active: true },
    { id: '2', type: 'music', name: 'Symphony Fragment (Dark)', duration: '0:10', volume: 70, active: true },
    { id: '3', type: 'sfx', name: 'Rain & Thunder', duration: '0:10', volume: 55, active: true },
    { id: '4', type: 'ambience', name: 'Stone House Reverb', duration: '0:10', volume: 40, active: true },
    { id: '5', type: 'sfx', name: 'Piano (Ghostly)', duration: '0:05', volume: 65, active: true },
  ],
}

/** Total teaser length in seconds, from the shot durations ("2.5s" → 2.5). */
export function filmSeconds(film: FilmProject): number {
  const total = film.shots.reduce((sum, s) => sum + (parseFloat(s.duration) || 0), 0)
  return Math.round(total * 10) / 10
}

export interface ProjectSummary {
  id: string
  title: string
  genre: string
  status: string
  logline: string
  thumbnailUrl: string | null
  assetCount: number
  createdAt: string
  updatedAt: string
}

export interface AssetListItem extends Asset {
  projectId: string
  projectTitle: string
  createdAt: string
}

export interface Preferences {
  displayName: string
  language: string
  teaserSeconds: number
  aspectRatio: '16:9' | '9:16' | '1:1'
  quality: 'draft' | 'final'
}

export const DEFAULT_PREFERENCES: Preferences = { displayName: '', language: 'en', teaserSeconds: 30, aspectRatio: '16:9', quality: 'draft' }

export interface Me {
  id: string
  email: string
  preferences: Preferences
}

export interface Health {
  status: string
  version: string
  authMode: string
  providers: Record<'story' | 'image' | 'video' | 'tts', string>
}
