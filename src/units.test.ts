import { describe, expect, it } from 'vitest'
import {
  M_PER_FT,
  M_PER_IN,
  formatArea,
  formatLength,
  formatLengthShort,
  formatVolume,
  parseLength,
} from './units'

describe('parseLength', () => {
  it('parses feet-and-inches in the shapes people type', () => {
    const expected = 12 * M_PER_FT + 6 * M_PER_IN
    for (const input of [`12'6"`, `12' 6`, `12ft 6in`, `12-6`, `12'6`]) {
      expect(parseLength(input, 'ft')).toBeCloseTo(expected, 9)
    }
  })

  it('parses feet only', () => {
    expect(parseLength(`12.5'`, 'ft')).toBeCloseTo(12.5 * M_PER_FT, 9)
    expect(parseLength('12.5 feet', 'ft')).toBeCloseTo(12.5 * M_PER_FT, 9)
  })

  it('parses inches only', () => {
    expect(parseLength('150in', 'ft')).toBeCloseTo(150 * M_PER_IN, 9)
    expect(parseLength('150"', 'ft')).toBeCloseTo(150 * M_PER_IN, 9)
  })

  it('parses metric regardless of the active display unit', () => {
    expect(parseLength('3.8m', 'ft')).toBeCloseTo(3.8, 9)
    expect(parseLength('380 cm', 'ft')).toBeCloseTo(3.8, 9)
    expect(parseLength('3800mm', 'm')).toBeCloseTo(3.8, 9)
  })

  it('interprets a bare number in the active display unit', () => {
    expect(parseLength('10', 'ft')).toBeCloseTo(10 * M_PER_FT, 9)
    expect(parseLength('10', 'm')).toBeCloseTo(10, 9)
  })

  it('handles negatives and surrounding whitespace', () => {
    expect(parseLength("  -4'  ", 'ft')).toBeCloseTo(-4 * M_PER_FT, 9)
  })

  it('returns null for unparseable input', () => {
    for (const bad of ['', '   ', 'abc', '12 fathoms', '$40', "12'6\"x8"]) {
      expect(parseLength(bad, 'ft')).toBeNull()
    }
  })
})

describe('formatLength', () => {
  it('round-trips through parseLength', () => {
    for (const input of [`12'6"`, `3'`, `18"`, `40'`]) {
      const meters = parseLength(input, 'ft')!
      expect(parseLength(formatLength(meters, 'ft'), 'ft')).toBeCloseTo(meters, 6)
    }
  })

  it('renders feet and inches with reduced fractions', () => {
    expect(formatLength(12 * M_PER_FT + 6 * M_PER_IN, 'ft')).toBe(`12' 6"`)
    expect(formatLength(3 * M_PER_FT, 'ft')).toBe(`3'`)
    expect(formatLength(6.5 * M_PER_IN, 'ft')).toBe(`6 1/2"`)
    expect(formatLength(0.75 * M_PER_IN, 'ft')).toBe(`3/4"`)
    expect(formatLength(0, 'ft')).toBe(`0"`)
  })

  it('rolls 11.99 inches up to the next foot instead of showing 12"', () => {
    expect(formatLength(4 * M_PER_FT - 0.001, 'ft')).toBe(`4'`)
  })

  it('renders metric', () => {
    expect(formatLength(3.8123, 'm')).toBe('3.81 m')
  })

  it('has a compact form for on-canvas labels', () => {
    expect(formatLengthShort(12 * M_PER_FT + 6 * M_PER_IN, 'ft')).toBe(`12'6"`)
    expect(formatLengthShort(12 * M_PER_FT, 'ft')).toBe(`12'`)
  })
})

describe('area and volume formatting', () => {
  it('reports area in square feet', () => {
    const tenByTwelve = 10 * M_PER_FT * (12 * M_PER_FT)
    expect(formatArea(tenByTwelve, 'ft')).toBe('120 sq ft')
  })

  it('reports bulk volume in cubic yards, the unit suppliers sell in', () => {
    // 10ft x 12ft of 4"-deep gravel.
    const volume = 10 * M_PER_FT * (12 * M_PER_FT) * (4 * M_PER_IN)
    expect(formatVolume(volume, 'ft')).toBe('1.48 cu yd')
  })
})
