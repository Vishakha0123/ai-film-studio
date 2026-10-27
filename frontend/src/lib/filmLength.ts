/**
 * "I want a 2-hour movie", "90 minute film", "दो घंटे की फिल्म", "2 மணி நேர படம்" → the length the creator asked for.
 * Used to offer the full-length film after the story is planned (never to start paid work on its own).
 */

/** The lengths the full-length film page offers (minutes). */
export const FILM_LENGTHS = [10, 30, 60, 120] as const

const HOUR = /^(hours?|hrs?|h|hour-long|घंटे|घंटा|घंटों|घण्टे|तास|ತಾಸು|மணி\s*நேர\S*|மணிநேர\S*|மணி|గంట\S*|ಗಂಟೆ\S*|മണിക്കൂ\S*|ঘণ্টা\S*|ઘંટા\S*|કલાક\S*|ਘੰਟ\S*)/i
const MINUTE = /^(minutes?|mins?|m|मिनट\S*|मिनिट\S*|நிமிட\S*|నిమిష\S*|ನಿಮಿಷ\S*|മിനിറ്റ\S*|মিনিট\S*|મિનિટ\S*|ਮਿੰਟ\S*)/i

/** Number words in English and Indian languages (whole and half hours are what people say). */
const WORDS: Record<string, number> = {
  one: 1, an: 1, a: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40,
  'forty-five': 45, fifty: 50, sixty: 60, ninety: 90, half: 0.5,
  एक: 1, दो: 2, तीन: 3, डेढ़: 1.5, डेढ: 1.5, ढाई: 2.5, आधा: 0.5, आधे: 0.5, // Hindi
  दोन: 2, अडीच: 2.5, दीड: 1.5, // Marathi
  ஒரு: 1, இரண்டு: 2, ரெண்டு: 2, மூன்று: 3, // Tamil
  ఒక: 1, రెండు: 2, మూడు: 3, // Telugu
  ಒಂದು: 1, ಎರಡು: 2, ಮೂರು: 3, // Kannada
  ഒരു: 1, രണ്ട്: 2, രണ്ടു: 2, മൂന്ന്: 3, // Malayalam
  এক: 1, দুই: 2, দু: 2, তিন: 3, দেড়: 1.5, আড়াই: 2.5, // Bengali
  બે: 2, ત્રણ: 3, દોઢ: 1.5, અઢી: 2.5, // Gujarati
  ਦੋ: 2, ਤਿੰਨ: 3, ਡੇਢ: 1.5, ਢਾਈ: 2.5, // Punjabi
}

/** ०-९, ௦-௯, ౦-౯ … → 0-9 */
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, d => {
    const code = d.codePointAt(0)!
    for (const zero of [0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66]) if (code >= zero && code <= zero + 9) return String(code - zero)
    return d
  })
}

/** The film length the text asks for, in minutes (null when it names none, or only a teaser length). */
export function requestedMinutes(text: string | null | undefined): number | null {
  if (!text) return null
  const t = asciiDigits(text.toLowerCase())
  // "an hour and a half" / "1 hour 30 minutes" / "डेढ़ घंटे" / "2 hours"
  const tokens = t.replace(/(\d)\s*-\s*(?=[a-z])/g, '$1 ').replace(/(\d)(?=[^\d\s.,])/g, '$1 ').split(/[\s,.!?;:()]+/).filter(Boolean)
  let best: number | null = null
  for (let i = 0; i < tokens.length; i++) {
    const unit = HOUR.test(tokens[i]) ? 60 : MINUTE.test(tokens[i]) ? 1 : 0
    if (!unit || i === 0) continue
    // the number right before the unit ("2 hours", "दो घंटे"; "half an hour" → half … an)
    let n = Number(tokens[i - 1].replace(/[^\d.]/g, '') || NaN)
    if (Number.isNaN(n)) n = WORDS[tokens[i - 1]] ?? NaN
    if (tokens[i - 1] === 'an' && tokens[i - 2] === 'half') n = 0.5
    if (Number.isNaN(n) || n <= 0) continue
    let minutes = n * unit
    // "2 hours 30 minutes", "an hour and a half"
    const rest = tokens.slice(i + 1, i + 5)
    if (unit === 60) {
      const k = rest.findIndex(x => MINUTE.test(x))
      if (k > 0 && !Number.isNaN(Number(rest[k - 1]))) minutes += Number(rest[k - 1])
      else if (rest[0] === 'and' && rest.includes('half')) minutes += 30
    }
    if (minutes >= 5 && (best === null || minutes > best)) best = minutes
  }
  return best === null ? null : Math.round(best)
}

/** The closest length the full-length film page offers (anything over 2 hours becomes 2 hours). */
export function nearestFilmLength(minutes: number): (typeof FILM_LENGTHS)[number] {
  return FILM_LENGTHS.reduce((a, b) => (Math.abs(b - minutes) <= Math.abs(a - minutes) ? b : a), FILM_LENGTHS[0])
}

export function lengthLabel(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60 === Math.floor(minutes / 60) ? minutes / 60 : (minutes / 60).toFixed(1)}-hour` : `${minutes}-minute`
}
