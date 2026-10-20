/**
 * Illustrated character portraits, chosen from each character's age and gender.
 *
 * Every character gets a portrait straight away (girls and boys, children to grandparents), without
 * waiting for image generation and without stock photos of real people. The drawing is decided by:
 *  - age band:  child (<13) · teen (13–19) · young (20–34) · adult (35–54) · senior (55+)
 *  - gender:    the character's "gender", or a guess from how they're described
 *  - the name:  picks skin tone, hair, clothes and small details, so each character looks different
 *               but always the same every time they appear.
 * A generated portrait (imageUrl) always wins over the drawing.
 */

export type AgeBand = 'child' | 'teen' | 'young' | 'adult' | 'senior'
export type Gender = 'female' | 'male'

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  child: 'Child', teen: 'Teen', young: 'Young adult', adult: 'Adult', senior: 'Senior',
}

// Zero digit of each Indian script, so ages like "੫੫" or "௩௨" read as numbers
const DIGIT_ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66]

function asciiDigits(text: string): string {
  return [...text].map(ch => {
    const c = ch.codePointAt(0)!
    const zero = DIGIT_ZEROS.find(z => c >= z && c <= z + 9)
    return zero === undefined ? ch : String(c - zero)
  }).join('')
}

/** "32", "early 20s", "70s", "8 years", "teenager", "elderly", "੫੫" → an age band. */
export function ageBand(age: string | undefined): AgeBand {
  const text = asciiDigits(String(age ?? '')).toLowerCase()
  const n = text.match(/\d+/)
  if (n) {
    const years = Number(n[0])
    if (years < 13) return 'child'
    if (years < 20) return 'teen'
    if (years < 35) return 'young'
    if (years < 55) return 'adult'
    return 'senior'
  }
  if (/(baby|toddler|child|kid|little)/.test(text)) return 'child'
  if (/teen/.test(text)) return 'teen'
  if (/(old|elder|senior|aged|grand)/.test(text)) return 'senior'
  if (/(young|twenties)/.test(text)) return 'young'
  if (/middle/.test(text)) return 'adult'
  return 'adult'
}

const FEMALE_WORDS = /\b(she|her|hers|woman|women|girl|mother|mom|mum|wife|daughter|sister|grandmother|granny|queen|princess|aunt|lady|actress|heroine|bride|maa|amma|didi|beti)\b/g
const MALE_WORDS = /\b(he|him|his|man|men|boy|father|dad|husband|son|brother|grandfather|grandpa|king|prince|uncle|gentleman|actor|hero|groom|papa|appa|bhai|beta)\b/g

export function normalizeGender(value: string | undefined): Gender | null {
  const v = String(value ?? '').trim().toLowerCase()
  if (/^(f|female|woman|girl|she|her)$/.test(v)) return 'female'
  if (/^(m|male|man|boy|he|him)$/.test(v)) return 'male'
  return null
}

interface PortraitSubject {
  name: string
  age?: string
  gender?: string
  role?: string
  personality?: string
  appearance?: string
  relationships?: string
}

/** The character's gender, else a guess from how they're described, else from their name. */
export function genderOf(c: PortraitSubject): Gender {
  const set = normalizeGender(c.gender)
  if (set) return set
  const text = `${c.role ?? ''} ${c.appearance ?? ''} ${c.personality ?? ''} ${c.relationships ?? ''}`.toLowerCase()
  const f = text.match(FEMALE_WORDS)?.length ?? 0
  const m = text.match(MALE_WORDS)?.length ?? 0
  if (f !== m) return f > m ? 'female' : 'male'
  return hash(c.name) % 2 ? 'female' : 'male'
}

function hash(text: string): number {
  let h = 2166136261
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619)
  return h >>> 0
}

/** Small seeded random generator: same name → same choices. */
function rng(seed: number) {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SKIN = ['#f3cfa8', '#e8b98a', '#d9a066', '#c68642', '#a86b3c', '#8d5524']
const HAIR = ['#1b1512', '#2a1d16', '#3b2a20', '#1f1a17', '#4a3426']
const GREY = ['#bdb8b3', '#d9d6d2', '#9e9893']
const CLOTHES = ['#7f1d1d', '#1e3a8a', '#14532d', '#78350f', '#4c1d95', '#334155', '#9d174d', '#0f766e', '#a16207']
const BACKDROPS: [string, string][] = [
  ['#1c1917', '#44403c'], ['#172033', '#334155'], ['#1f1720', '#4a2a3f'], ['#13221d', '#2f4a3f'], ['#241a12', '#5a3d22'],
]

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount)))
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => ch(v).toString(16).padStart(2, '0')).join('')}`
}

/** The portrait as an SVG string (3:4, framed head and shoulders). */
export function portraitSvg(c: PortraitSubject): string {
  const band = ageBand(c.age)
  const gender = genderOf(c)
  const r = rng(hash(`${c.name}|${band}|${gender}`))
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]

  const skin = pick(SKIN)
  const skinShadow = shade(skin, -28)
  const hair = band === 'senior' ? pick(GREY) : pick(HAIR)
  const cloth = pick(CLOTHES)
  const [bg1, bg2] = pick(BACKDROPS)

  const kid = band === 'child'
  const cx = 150
  const rx = kid ? 60 : band === 'teen' ? 53 : 51
  const ry = kid ? 64 : band === 'teen' ? 66 : 67
  const cy = kid ? 185 : 168
  const shoulderY = cy + ry + (kid ? 30 : 38)
  const bodyW = kid ? 92 : gender === 'female' ? 112 : 128
  const eyeY = cy + ry * 0.06
  const eyeDx = rx * 0.42
  const eyeR = kid ? 7.5 : band === 'teen' ? 6.5 : 6
  const noseY = cy + ry * 0.36
  const mouthY = cy + ry * 0.62
  const longHair = gender === 'female' && (band !== 'senior' || r() < 0.3) && !(band === 'adult' && r() < 0.35)
  const bun = gender === 'female' && !longHair
  const bald = gender === 'male' && band === 'senior' && r() < 0.6
  const beard = gender === 'male' && (band === 'senior' ? r() < 0.55 : band === 'adult' ? r() < 0.45 : band === 'young' ? r() < 0.3 : false)
  const moustache = gender === 'male' && !beard && (band === 'adult' || band === 'senior') && r() < 0.55
  const glasses = band === 'senior' ? r() < 0.6 : band === 'adult' ? r() < 0.25 : r() < 0.08
  const bindi = gender === 'female' && (band === 'adult' || band === 'senior' || band === 'young') && r() < 0.45
  const pigtails = gender === 'female' && kid
  const ponytail = gender === 'female' && band === 'teen' && r() < 0.5

  const p: string[] = []
  p.push(`<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg1}"/></linearGradient>`
    + `<radialGradient id="glow" cx="0.5" cy="0.38" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/><stop offset="1" stop-color="#000000" stop-opacity="0.35"/></radialGradient></defs>`)
  p.push(`<rect width="300" height="400" fill="url(#bg)"/><rect width="300" height="400" fill="url(#glow)"/>`)

  // Hair behind the head
  if (longHair) {
    p.push(`<path d="M${cx - rx - 14} ${cy - 6} Q${cx - rx - 22} ${shoulderY + 34} ${cx - rx + 2} ${shoulderY + 58} L${cx + rx - 2} ${shoulderY + 58} Q${cx + rx + 22} ${shoulderY + 34} ${cx + rx + 14} ${cy - 6} Z" fill="${hair}"/>`)
  }
  if (ponytail) p.push(`<path d="M${cx + rx - 6} ${cy - ry * 0.4} Q${cx + rx + 40} ${cy + 10} ${cx + rx + 12} ${cy + ry + 30} Q${cx + rx + 4} ${cy + 20} ${cx + rx - 14} ${cy - ry * 0.2} Z" fill="${hair}"/>`)
  if (pigtails) {
    p.push(`<circle cx="${cx - rx - 10}" cy="${cy - 4}" r="22" fill="${hair}"/><circle cx="${cx + rx + 10}" cy="${cy - 4}" r="22" fill="${hair}"/>`)
    p.push(`<circle cx="${cx - rx + 6}" cy="${cy - 14}" r="5" fill="${pick(['#f472b6', '#facc15', '#60a5fa'])}"/><circle cx="${cx + rx - 6}" cy="${cy - 14}" r="5" fill="#f472b6"/>`)
  }
  if (bun) p.push(`<circle cx="${cx}" cy="${cy - ry - 8}" r="${kid ? 18 : 22}" fill="${hair}"/>`)
  if (!bald) p.push(`<ellipse cx="${cx}" cy="${cy - 8}" rx="${rx + 6}" ry="${ry + 8}" fill="${hair}"/>`)
  else p.push(`<ellipse cx="${cx - rx + 4}" cy="${cy - 6}" rx="14" ry="24" fill="${hair}"/><ellipse cx="${cx + rx - 4}" cy="${cy - 6}" rx="14" ry="24" fill="${hair}"/>`)

  // Body, neck, neckline
  p.push(`<path d="M${cx - bodyW - 10} 400 L${cx - bodyW - 10} ${shoulderY + 42} Q${cx - bodyW + 2} ${shoulderY + 2} ${cx - 34} ${shoulderY - 6} L${cx + 34} ${shoulderY - 6} Q${cx + bodyW - 2} ${shoulderY + 2} ${cx + bodyW + 10} ${shoulderY + 42} L${cx + bodyW + 10} 400 Z" fill="${cloth}"/>`)
  p.push(`<rect x="${cx - 17}" y="${cy + ry - 26}" width="34" height="${shoulderY - (cy + ry - 26) + 6}" rx="10" fill="${skinShadow}"/>`)
  p.push(`<path d="M${cx - 24} ${shoulderY - 6} L${cx} ${shoulderY + 24} L${cx + 24} ${shoulderY - 6} Z" fill="${skinShadow}"/>`)
  if (gender === 'female' && !kid && r() < 0.5) {
    p.push(`<path d="M${cx - bodyW + 6} ${shoulderY + 30} Q${cx} ${shoulderY + 70} ${cx + bodyW - 6} ${shoulderY + 10}" stroke="${shade(cloth, 50)}" stroke-width="14" fill="none" opacity="0.8"/>`) // dupatta / scarf
  }

  // Ears and head
  p.push(`<ellipse cx="${cx - rx + 1}" cy="${eyeY + 8}" rx="9" ry="14" fill="${skinShadow}"/><ellipse cx="${cx + rx - 1}" cy="${eyeY + 8}" rx="9" ry="14" fill="${skinShadow}"/>`)
  p.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>`)

  // Hair over the forehead
  if (!bald) {
    const part = (r() - 0.5) * rx * 0.6
    const low = gender === 'male' && band !== 'child' ? 0.6 : 0.5
    p.push(`<path d="M${cx - rx - 2} ${cy - ry * 0.12} Q${cx - rx - 4} ${cy - ry - 16} ${cx} ${cy - ry - 13} Q${cx + rx + 4} ${cy - ry - 16} ${cx + rx + 2} ${cy - ry * 0.12} Q${cx + rx * 0.55} ${cy - ry * low} ${cx + part} ${cy - ry * 0.62} Q${cx - rx * 0.55} ${cy - ry * low} ${cx - rx - 2} ${cy - ry * 0.12} Z" fill="${hair}"/>`)
  } else {
    p.push(`<path d="M${cx - rx * 0.5} ${cy - ry * 0.55} Q${cx} ${cy - ry * 0.7} ${cx + rx * 0.5} ${cy - ry * 0.55}" stroke="${skinShadow}" stroke-width="2" fill="none" opacity="0.5"/>`)
  }

  // Face
  const browY = eyeY - (kid ? 17 : 15)
  const browW = gender === 'male' ? 3.6 : 2.6
  p.push(`<path d="M${cx - eyeDx - 11} ${browY + 2} Q${cx - eyeDx} ${browY - 4} ${cx - eyeDx + 11} ${browY + 1}" stroke="${band === 'senior' ? shade(hair, -40) : hair}" stroke-width="${browW}" fill="none" stroke-linecap="round"/>`)
  p.push(`<path d="M${cx + eyeDx - 11} ${browY + 1} Q${cx + eyeDx} ${browY - 4} ${cx + eyeDx + 11} ${browY + 2}" stroke="${band === 'senior' ? shade(hair, -40) : hair}" stroke-width="${browW}" fill="none" stroke-linecap="round"/>`)
  for (const dx of [-eyeDx, eyeDx]) {
    p.push(`<ellipse cx="${cx + dx}" cy="${eyeY}" rx="${eyeR + 4}" ry="${eyeR + 1}" fill="#f8f5f0"/>`)
    p.push(`<circle cx="${cx + dx}" cy="${eyeY}" r="${eyeR}" fill="#2b1d14"/><circle cx="${cx + dx + 2}" cy="${eyeY - 2}" r="${eyeR * 0.3}" fill="#ffffff"/>`)
    if (gender === 'female' && !kid) p.push(`<path d="M${cx + dx - eyeR - 5} ${eyeY - 2} Q${cx + dx} ${eyeY - eyeR - 6} ${cx + dx + eyeR + 6} ${eyeY - 3}" stroke="#1b1512" stroke-width="2" fill="none"/>`)
  }
  p.push(`<path d="M${cx - 5} ${noseY - 14} Q${cx - 8} ${noseY + 2} ${cx - 2} ${noseY + 4} Q${cx + 5} ${noseY + 5} ${cx + 7} ${noseY}" stroke="${skinShadow}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`)
  if (kid || gender === 'female') p.push(`<circle cx="${cx - eyeDx - 4}" cy="${noseY + 4}" r="9" fill="#e11d48" opacity="0.12"/><circle cx="${cx + eyeDx + 4}" cy="${noseY + 4}" r="9" fill="#e11d48" opacity="0.12"/>`)
  const smile = kid ? 9 : 6
  p.push(`<path d="M${cx - 15} ${mouthY} Q${cx} ${mouthY + smile} ${cx + 15} ${mouthY}" stroke="${gender === 'female' && !kid ? '#9f1239' : shade(skin, -70)}" stroke-width="${gender === 'female' && !kid ? 4 : 3}" fill="none" stroke-linecap="round"/>`)

  // Age lines
  if (band === 'senior') {
    p.push(`<path d="M${cx - rx * 0.45} ${cy - ry * 0.42} Q${cx} ${cy - ry * 0.48} ${cx + rx * 0.45} ${cy - ry * 0.42} M${cx - rx * 0.35} ${cy - ry * 0.33} Q${cx} ${cy - ry * 0.38} ${cx + rx * 0.35} ${cy - ry * 0.33}" stroke="${skinShadow}" stroke-width="1.8" fill="none" opacity="0.7"/>`)
    p.push(`<path d="M${cx - 17} ${noseY + 2} Q${cx - 25} ${mouthY - 4} ${cx - 20} ${mouthY + 8} M${cx + 17} ${noseY + 2} Q${cx + 25} ${mouthY - 4} ${cx + 20} ${mouthY + 8}" stroke="${skinShadow}" stroke-width="1.8" fill="none" opacity="0.7"/>`)
  }
  if (band === 'senior' || band === 'adult') {
    p.push(`<path d="M${cx - eyeDx - 7} ${eyeY + 10} Q${cx - eyeDx} ${eyeY + 14} ${cx - eyeDx + 7} ${eyeY + 10} M${cx + eyeDx - 7} ${eyeY + 10} Q${cx + eyeDx} ${eyeY + 14} ${cx + eyeDx + 7} ${eyeY + 10}" stroke="${skinShadow}" stroke-width="1.4" fill="none" opacity="0.6"/>`)
  }

  // Facial hair
  const facial = band === 'senior' ? pick(GREY) : hair
  if (beard) {
    p.push(`<path d="M${cx - rx + 3} ${cy + ry * 0.12} Q${cx - rx + 6} ${cy + ry + 18} ${cx} ${cy + ry + 22} Q${cx + rx - 6} ${cy + ry + 18} ${cx + rx - 3} ${cy + ry * 0.12} Q${cx + rx * 0.55} ${cy + ry * 0.78} ${cx} ${mouthY + 10} Q${cx - rx * 0.55} ${cy + ry * 0.78} ${cx - rx + 3} ${cy + ry * 0.12} Z" fill="${facial}"/>`)
    p.push(`<path d="M${cx - 15} ${mouthY} Q${cx} ${mouthY + 6} ${cx + 15} ${mouthY}" stroke="${shade(skin, -70)}" stroke-width="3" fill="none" stroke-linecap="round"/>`)
  }
  if (beard || moustache) {
    p.push(`<path d="M${cx - 22} ${mouthY - 2} Q${cx - 12} ${noseY + 6} ${cx} ${noseY + 10} Q${cx + 12} ${noseY + 6} ${cx + 22} ${mouthY - 2} Q${cx + 10} ${mouthY - 9} ${cx} ${mouthY - 6} Q${cx - 10} ${mouthY - 9} ${cx - 22} ${mouthY - 2} Z" fill="${facial}"/>`)
  }
  if (bindi) p.push(`<circle cx="${cx}" cy="${browY - 2}" r="3.6" fill="#b91c1c"/>`)
  if (glasses) {
    const gc = band === 'senior' ? '#44403c' : '#111827'
    p.push(`<g fill="none" stroke="${gc}" stroke-width="2.6"><circle cx="${cx - eyeDx}" cy="${eyeY}" r="${eyeR + 9}"/><circle cx="${cx + eyeDx}" cy="${eyeY}" r="${eyeR + 9}"/><path d="M${cx - eyeDx + eyeR + 9} ${eyeY} Q${cx} ${eyeY - 6} ${cx + eyeDx - eyeR - 9} ${eyeY}"/></g>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="45 62 210 280" width="300" height="400">${p.join('')}</svg>`
}

const cache = new Map<string, string>()

/** The portrait as an image URL (cached per name/age/gender). */
export function portraitUrl(c: PortraitSubject): string {
  const key = `${c.name}|${ageBand(c.age)}|${genderOf(c)}`
  let url = cache.get(key)
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(c))}`
    cache.set(key, url)
  }
  return url
}
