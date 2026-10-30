export type Screen = 'landing' | 'login' | 'onboarding' | 'director' | 'generation' | 'teaser' | 'export'
export type Panel = 'chat' | 'story' | 'characters' | 'screenplay' | 'dialogue' | 'lyrics' | 'scenes' | 'storyboard' | 'audio' | 'music'
export type NavFn = (s: Screen) => void

export const SCREENS: Screen[] = ['landing', 'login', 'onboarding', 'director', 'generation', 'teaser', 'export']
export const PANELS: Panel[] = ['chat', 'story', 'characters', 'screenplay', 'dialogue', 'lyrics', 'scenes', 'storyboard', 'audio', 'music']

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  card?: 'story' | 'characters' | 'screenplay' | 'dialogue' | 'lyrics' | 'scenes' | 'storyboard' | 'generate' | 'movie'
  /** card 'movie': the full-length film the creator asked for, in minutes */
  movieMinutes?: number
  /** File names the creator attached to this message */
  attachments?: string[]
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
  /** "female" or "male" — picks the portrait (with the age) until a generated one exists */
  gender?: string
  /** The family or group they belong to, e.g. "Malhotra family" */
  family?: string
  /** What they speak (en, hi, ta, …); empty = the film's language */
  language?: string
  imageId: string
  /** Generated portrait (backend asset), falls back to imageId photo */
  imageUrl?: string
  /** Closest of the 10 reference portraits for this age and gender (picked by the backend) */
  portraitRef?: string
  referenceImageUrl?: string
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
  /** Number of the scene this line belongs to */
  scene?: number | null
  /** Set when the line is spoken in another language than the film's (a family's own language) */
  language?: string
  /** The line in the film's language */
  subtitle?: string
}

/** The film's theme song, written in the film's language. */
export interface Lyrics {
  title: string
  style: string
  verse: string
  preChorus: string
  chorus: string
  bridge: string
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
  lyrics?: Lyrics
  /** Storyboard look picked by the creator (Dark Cinema by default) */
  visualStyle?: string
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
  /** Film language code, e.g. "en", "ta" */
  language?: string
  status: string
  /** The saved idea: prompt, genres, language… (a language version keeps the original's prompt) */
  brief?: Record<string, unknown>
  memory: FilmProject | null
  assets: Asset[]
  /** The AI Director conversation saved with the film */
  chat?: ChatMessage[]
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
  updatedAt?: string
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

/**
 * Where a character's picture comes from:
 *  - "ai":        a portrait the image model generated for this character
 *  - "reference": the closest of the 10 reference portraits for their age and gender (matched automatically)
 *  - "stock":     the demo film's sample photo (a stock photo — labelled as such, never passed off as AI)
 *  - "none":      no portrait available. Nothing is drawn or substituted.
 * The offline mock provider's SVG placeholder frames don't count as portraits.
 */
export type CharacterPhotoKind = 'ai' | 'reference' | 'stock' | 'none'

export function characterPhotoKind(c: Pick<Character, 'imageUrl' | 'imageId' | 'referenceImageUrl'>): CharacterPhotoKind {
  if (c.imageUrl && !/\.svg($|\?)/i.test(c.imageUrl)) return 'ai'
  if (c.referenceImageUrl) return 'reference'
  if (c.imageId) return 'stock'
  return 'none'
}

/** The character's real picture URL, or null when there isn't one yet. */
export function characterPhoto(c: Character, w: number, h: number): string | null {
  const kind = characterPhotoKind(c)
  if (kind === 'ai') return c.imageUrl!
  if (kind === 'reference') return c.referenceImageUrl!
  if (kind === 'stock') return photoUrl({ imageId: c.imageId }, w, h)
  return null
}

/**
 * A storyboard shot's picture: a generated frame ("ai"), the demo film's sample still ("stock"), or nothing yet
 * ("none") — never one shared stand-in photo for every shot. Mock SVG placeholder frames don't count.
 */
export function shotFrame(shot: Pick<Shot, 'imageUrl' | 'imageId'>, w: number, h: number): { kind: 'ai' | 'stock' | 'none'; src: string | null } {
  if (shot.imageUrl && !/\.svg($|\?)/i.test(shot.imageUrl)) return { kind: 'ai', src: shot.imageUrl }
  if (shot.imageId) return { kind: 'stock', src: photoUrl({ imageId: shot.imageId }, w, h) }
  return { kind: 'none', src: null }
}

/** The characters named in a shot's "characters" text ("Rohan, Nila"), matched to the cast by name. */
export function shotCast(shot: Pick<Shot, 'characters'>, cast: Character[]): Character[] {
  const names = String(shot.characters || '').split(/[,،、&]| and /).map(n => n.trim().toLowerCase()).filter(n => n && n !== 'none')
  return cast.filter(c => {
    const full = c.name.toLowerCase()
    const first = full.split(/\s+/)[0]
    return names.some(n => n === full || n === first || full.includes(n) || n.includes(first))
  })
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
  lyrics: {
    title: 'Between the Rests',
    style: 'Dark Classical',
    verse: `Between the rests, I still remain
In the silence after rain
Every measure, every note
The words that you could never quote`,
    preChorus: `Listen close — the score explains
What the living can't contain`,
    chorus: `I am the music in the walls
The echo down your hallway's halls
Play the final page and see
I never left — I cannot leave`,
    bridge: `Andante — slow, like grief descends
Fortissimo — where longing ends
The key is not in major light
The answer lives in B-flat night`,
  },
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
  language?: string
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
  /** Storyboard look every new film starts with */
  visualStyle: string
  /** How many scenes the AI writes: short 3 · medium 5 · long 8 */
  filmLength: 'short' | 'medium' | 'long'
  /** Sarvam Bulbul speaker for character voices */
  voice: string
  /** Speaking speed, 0.5–2 */
  voicePace: number
}

export const DEFAULT_PREFERENCES: Preferences = {
  displayName: '', language: 'en', teaserSeconds: 30, aspectRatio: '16:9', quality: 'draft',
  visualStyle: 'Dark Cinema', filmLength: 'medium', voice: 'shubh', voicePace: 1,
}

export interface Me {
  id: string
  email: string
  preferences: Preferences
}

export interface Health {
  status: string
  version: string
  authMode: string
  providers: Record<'story' | 'image' | 'video' | 'tts' | 'stt', string>
}

/** A file the creator attached as source material (story, script, lyrics, reference image) */
export interface ProjectDocument {
  id: string
  filename: string
  type: 'text' | 'pdf' | 'docx' | 'image'
  size: number
  fileUrl: string
  sourceReference: string
  preview: string
  createdAt: string
}

/* ---------- Full-length film (10 minutes – 2 hours) ---------- */

export type FilmStatus = 'planning' | 'planned' | 'writing' | 'generating' | 'paused' | 'budget_reached' | 'generated' | 'rendering' | 'rendered' | 'failed'

export interface LongFilmProgress {
  scenes: number
  scenesDone: number
  scenesFailed: number
  shots: number
  shotsDone: number
  shotsFailed: number
  percent: number
}

export interface LongFilmEstimate {
  scenes: number
  shots: number
  remainingShots: number
  videoSeconds: number
  storyCalls: number
  dialogueLines: number
  /** With the providers switched on now (0 with the free test providers) */
  estimatedCost: number
  /** The same work with every paid provider switched on */
  fullProviderCost: number
  currency: string
  budgetCap: number
  spent: number
  liveProviders: { story: boolean; image: boolean; video: boolean; tts: boolean }
  quality: 'draft' | 'final'
}

export interface LongFilmSceneSummary {
  number: number
  act: number
  title: string
  summary: string
  location: string
  characters: string[]
  targetSeconds: number
  status: 'planned' | 'generating' | 'done' | 'failed'
  error: string
  /** The scene's script and shot list are written */
  scripted: boolean
  shots: number
  shotsDone: number
  shotsFailed: number
  previewUrl: string | null
}

export interface LongFilm {
  id: string
  projectId: string
  status: FilmStatus
  error: string
  targetSeconds: number
  shotSeconds: number
  quality: 'draft' | 'final'
  budgetCap: number
  spent: number
  pauseRequested: boolean
  progress: LongFilmProgress
  estimate: LongFilmEstimate
  job: { id: string; task: string; status: JobStatus; stage: string; progress: number; error: string } | null
  /** The premise grown into a feature-length story, with the cast it needs (null until planned) */
  story: {
    story: string
    acts: { act: number; summary: string }[]
    subplots: string[]
    newCharacters: string[]
    cast: { name: string; age: string; gender: string; role: string }[]
  } | null
  /** Some clips are labelled placeholders (no video provider connected) */
  hasTestClips: boolean
  final: { url: string; seconds: number } | null
  scenes: LongFilmSceneSummary[]
}

export interface LongFilmShot {
  id: string
  number: number
  description: string
  camera: string
  movement: string
  characters: string[]
  dialogue: { character: string; text: string; language?: string; subtitle?: string }[]
  seconds: number
  status: 'pending' | 'generating' | 'done' | 'failed'
  attempts: number
  error: string
  clipUrl: string | null
  clipKind: 'video' | 'still' | 'test' | null
}

export interface LongFilmScene {
  number: number
  title: string
  summary: string
  location: string
  script: string
  continuity: string
  status: LongFilmSceneSummary['status']
  error: string
  previewUrl: string | null
  shots: LongFilmShot[]
}

/** The whole full-length film as text, for the Director's sections */
export interface FullFilmText {
  status: FilmStatus
  targetSeconds: number
  error: string
  job: { id: string; task: string; status: JobStatus; stage: string; progress: number; error: string } | null
  progress: LongFilmProgress
  scenes: {
    number: number
    act: number
    title: string
    summary: string
    location: string
    characters: string[]
    targetSeconds: number
    script: string
    status: LongFilmSceneSummary['status']
    shots: { id: string; number: number; camera: string; movement: string; seconds: number; description: string; characters: string[]; dialogue: { character: string; text: string; language?: string; subtitle?: string }[] }[]
  }[]
}
