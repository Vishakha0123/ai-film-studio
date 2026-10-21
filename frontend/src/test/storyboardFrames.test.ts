import { describe, it, expect } from 'vitest'
import { shotCast, shotFrame, type Character } from '../types'

const char = (id: string, name: string): Character =>
  ({ id, name, age: '', role: '', personality: '', appearance: '', arc: '', relationships: '', imageId: '' })

describe('storyboard frames', () => {
  it('a shot shows its own generated frame, the demo sample still, or nothing — never a shared stand-in', () => {
    expect(shotFrame({ imageId: '', imageUrl: 'http://x/media/storyboard_image/1-v1.png' }, 10, 10)).toEqual({ kind: 'ai', src: 'http://x/media/storyboard_image/1-v1.png' })
    expect(shotFrame({ imageId: 'abc' }, 10, 10).kind).toBe('stock')
    expect(shotFrame({ imageId: '' }, 10, 10)).toEqual({ kind: 'none', src: null })
    expect(shotFrame({ imageId: '', imageUrl: 'http://x/media/storyboard_image/1-v1.svg' }, 10, 10).kind).toBe('none') // mock placeholder
  })

  it("finds the characters in a shot by name, in any script", () => {
    const cast = [char('1', 'Rohan'), char('2', 'Nila'), char('3', 'Kamala Devi'), char('4', 'रोहन'), char('5', 'निळा')]
    expect(shotCast({ characters: 'Rohan, Nila' }, cast).map(c => c.id)).toEqual(['1', '2'])
    expect(shotCast({ characters: 'Kamala' }, cast).map(c => c.id)).toEqual(['3'])
    expect(shotCast({ characters: 'रोहन, निळा' }, cast).map(c => c.id)).toEqual(['4', '5'])
    expect(shotCast({ characters: 'None' }, cast)).toEqual([])
  })
})
