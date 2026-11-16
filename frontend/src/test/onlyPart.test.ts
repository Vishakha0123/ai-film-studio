import { describe, it, expect } from 'vitest'
import { describesFilm, requestedPart } from '../lib/onlyPart'
import { directorTitle } from '../lib/directorTitle'

describe('only one part of the film', () => {
  it.each([
    ['I have a movie, I want only lyrics for it', 'lyrics'],
    ['just the songs please', 'lyrics'],
    ['lyrics only for my film about a fisherman', 'lyrics'],
    ['I only need the screenplay for my story', 'screenplay'],
    ['only the script', 'screenplay'],
    ['Can you write only the dialogues?', 'screenplay'],
    ['I just want a story from this idea: a boy and a kite', 'story'],
    ['only the lyrics for my story', 'lyrics'],               // the part named right after "only" wins
    ['मुझे सिर्फ गाने चाहिए', 'lyrics'],
    ['मेरी फिल्म की केवल पटकथा लिखो', 'screenplay'],
    ['எனக்கு பாடல் மட்டும் வேண்டும்', 'lyrics'],
    ['திரைக்கதை மட்டும் எழுது', 'screenplay'],
    ['నాకు పాటలు మాత్రమే కావాలి', 'lyrics'],
    ['ಕಥೆ ಮಾತ್ರ ಬರೆಯಿರಿ', 'story'],
    ['പാട്ട് മാത്രം മതി', 'lyrics'],
    ['শুধু গান চাই', 'lyrics'],
    ['फक्त गाणी हवी', 'lyrics'],
    ['ફક્ત ગીત જોઈએ', 'lyrics'],
    ['ਸਿਰਫ਼ ਗੀਤ ਚਾਹੀਦੇ ਹਨ', 'lyrics'],
  ])('%s → %s', (text, part) => {
    expect(requestedPart(text)).toBe(part)
  })

  it('a normal film idea is the whole film', () => {
    expect(requestedPart('A grandmother teaches her grandson to swim, with two songs')).toBeNull()
    expect(requestedPart('A story about a singer who loses her voice')).toBeNull()
    expect(requestedPart('only one day left before the wedding — a family comedy')).toBeNull()
    expect(requestedPart('')).toBeNull()
  })

  it('knows when the message also describes the movie', () => {
    expect(describesFilm('I have a movie, I want only lyrics')).toBe(false)
    expect(describesFilm('எனக்கு பாடல் மட்டும் வேண்டும்')).toBe(false)
    expect(describesFilm('Only lyrics. My film: two brothers run a tea stall in Ooty and fall for the same girl; the elder gives her up')).toBe(true)
  })
})

describe('display name in the header', () => {
  it('uses the first name', () => {
    expect(directorTitle('Vishakha')).toBe('Vishakha’s AI Director')
    expect(directorTitle('  Sheerap Kumar ')).toBe('Sheerap’s AI Director')
    expect(directorTitle('')).toBe('AI Director')
    expect(directorTitle(undefined)).toBe('AI Director')
  })
})
