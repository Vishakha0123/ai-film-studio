import { describe, it, expect } from 'vitest'
import { lengthLabel, nearestFilmLength, requestedMinutes } from '../lib/filmLength'

describe('film length from the prompt', () => {
  it.each([
    ['I want a 2 hours movie about a river', 120],
    ['make a 2-hour film', 120],
    ['a 2hr thriller', 120],
    ['2 hrs drama set in Varanasi', 120],
    ['a 90 minute horror film', 90],
    ['a 10 min short film', 10],
    ['an hour and a half long family drama', 90],
    ['1 hour 30 minutes', 90],
    ['half an hour comedy', 30],
    ['two hours long', 120],
    ['3 hour epic', 180],
    ['मुझे दो घंटे की फिल्म चाहिए', 120],
    ['२ घंटे की फिल्म', 120],
    ['डेढ़ घंटे की कहानी', 90],
    ['दोन तासांचा चित्रपट', 120],
    ['2 மணி நேர படம்', 120],
    ['இரண்டு மணி நேர திரைப்படம்', 120],
    ['రెండు గంటల సినిమా', 120],
    ['ಎರಡು ಗಂಟೆಯ ಸಿನಿಮಾ', 120],
    ['രണ്ട് മണിക്കൂർ സിനിമ', 120],
    ['দুই ঘণ্টার ছবি', 120],
  ])('%s → %i minutes', (text, minutes) => {
    expect(requestedMinutes(text)).toBe(minutes)
  })

  it('ignores ideas without a film length, and teaser lengths', () => {
    expect(requestedMinutes('A grandmother teaches her grandson to swim')).toBeNull()
    expect(requestedMinutes('a 30 second teaser')).toBeNull()
    expect(requestedMinutes('he waited 2 minutes')).toBeNull()
    expect(requestedMinutes('')).toBeNull()
    // words that merely start like a unit ("h…", "m…") are not lengths
    expect(requestedMinutes('A teacher meets her double in a Himalayan school')).toBeNull()
    expect(requestedMinutes('a man meets a mysterious woman in a hotel')).toBeNull()
    expect(requestedMinutes('two hunters in a minefield')).toBeNull()
  })

  it('maps to the lengths the page offers (2 hours at most)', () => {
    expect(nearestFilmLength(120)).toBe(120)
    expect(nearestFilmLength(90)).toBe(120)
    expect(nearestFilmLength(45)).toBe(60)
    expect(nearestFilmLength(180)).toBe(120)
    expect(nearestFilmLength(12)).toBe(10)
    expect(lengthLabel(120)).toBe('2-hour')
    expect(lengthLabel(30)).toBe('30-minute')
  })
})
