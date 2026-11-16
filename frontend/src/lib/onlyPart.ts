/**
 * "I have a movie, I only want the lyrics" → write only that part (story, screenplay or songs), not the whole film.
 * Understands English and the studio's Indian languages. Used together with the "What to make" choice under the chat.
 */

export type OnlyPart = 'story' | 'screenplay' | 'lyrics'

export const ONLY_PARTS: { part: OnlyPart | 'film'; label: string }[] = [
  { part: 'film', label: 'Full film' },
  { part: 'story', label: 'Story only' },
  { part: 'screenplay', label: 'Screenplay only' },
  { part: 'lyrics', label: 'Lyrics only' },
]

/** The section page each part opens on. */
export const PART_PANEL = { story: 'story', screenplay: 'screenplay', lyrics: 'lyrics' } as const

export const PART_NAME: Record<OnlyPart, string> = { story: 'the story', screenplay: 'the screenplay', lyrics: 'the lyrics' }

// "only" / "just" in each language (whole words, or the word attached to the noun in Indian scripts)
const ONLY = /\b(only|just|nothing but|solely)\b|सिर्फ़?|सिर्फ|केवल|फक्त|மட்டும்|మాత్రమే|ಮಾತ್ರ|മാത്രം|শুধু|শুধুমাত্র|কেবল|ફક્ત|માત્ર|ਸਿਰਫ਼|ਸਿਰਫ|ਕੇਵਲ/i

// What they want, per part (English + Indian languages). Screenplay comes before story ("screenplay of my story").
const PART_WORDS: [OnlyPart, RegExp][] = [
  ['lyrics', /\b(lyrics?|songs?|song lyrics)\b|गाने|गाना|गीत|लिरिक्स|गाणी|गाणे|பாடல்|பாட்டு|பாடல்கள்|పాట|పాటలు|ಹಾಡು|ಹಾಡುಗಳು|പാട്ട്|ഗാനം|গান|গানের|ગીત|ગીતો|ਗੀਤ|ਗਾਣ/i],
  ['screenplay', /\b(screen ?play|script|dialogues?)\b|पटकथा|स्क्रीनप्ले|स्क्रिप्ट|संवाद|திரைக்கதை|ஸ்கிரிப்ட்|வசனம்|స్క్రీన్‌?ప్లే|స్క్రిప్ట్|సంభాషణ|ಚಿತ್ರಕಥೆ|ಸ್ಕ್ರಿಪ್ಟ್|തിരക്കഥ|സ്ക്രിപ്റ്റ്|চিত্রনাট্য|স্ক্রিপ্ট|પટકથા|સ્ક્રિપ્ટ|ਸਕ੍ਰੀਨਪਲੇ|ਸਕ੍ਰਿਪਟ|ਪਟਕਥਾ/i],
  ['story', /\b(story|plot)\b|कहानी|कथा|கதை|కథ|ಕಥೆ|കഥ|গল্প|કથા|વાર્તા|ਕਹਾਣੀ/i],
]

// "lyrics only", "only the songs", "I just need a screenplay", "எனக்கு பாடல் மட்டும் வேண்டும்"
const POSTFIX_ONLY = /\b(lyrics?|songs?|screen ?play|script|story)\s+only\b/i

/** The single part the text asks for, or null for a whole film. */
export function requestedPart(text: string | null | undefined): OnlyPart | null {
  const t = (text ?? '').trim()
  if (!t) return null
  const post = t.match(POSTFIX_ONLY)
  if (post) return wordPart(post[1])
  if (!ONLY.test(t)) return null
  // the part named nearest after "only" wins ("only the lyrics for my story" → lyrics)
  const at = t.search(ONLY)
  const after = t.slice(at)
  let best: { part: OnlyPart; index: number } | null = null
  for (const [part, re] of PART_WORDS) {
    const i = after.search(re)
    if (i >= 0 && (best === null || i < best.index)) best = { part, index: i }
  }
  if (best) return best.part
  // Indian languages often put the noun before "only" ("पाटल் மட்டும்"): look just before it too
  const before = t.slice(Math.max(0, at - 40), at)
  for (const [part, re] of PART_WORDS) if (re.test(before)) return part
  return null
}

function wordPart(word: string): OnlyPart {
  const w = word.toLowerCase()
  return /lyric|song/.test(w) ? 'lyrics' : /screen|script/.test(w) ? 'screenplay' : 'story'
}

/**
 * Whether the message also describes the movie (so the part can be written straight away). A bare request —
 * "I have a movie, I want only lyrics" — gets a question back asking for the story or a file.
 */
export function describesFilm(text: string | null | undefined): boolean {
  const t = (text ?? '')
    .replace(/\b(i|we)\s+(have|want|need|would like)\b|\b(a|my|our|the|for|it|this|that|please|movie|film|only|just|write|give|me|make|generate|create)\b/gi, ' ')
    .replace(new RegExp(POSTFIX_ONLY.source, 'gi'), ' ')
  const words = t.split(/[\s,.!?;:()"'—–-]+/).filter(w => w.length > 1)
  return words.length >= 8
}
