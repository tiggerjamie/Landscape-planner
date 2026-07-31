/**
 * All scene geometry is stored in meters. This module is the only place that
 * converts to and from the units shown in the UI, so the rest of the app never
 * has to think about feet.
 */

export type Units = 'ft' | 'm'

export const M_PER_FT = 0.3048
export const M_PER_IN = 0.0254
/** Cubic meters in a cubic yard — gravel and mulch are ordered by the yard. */
export const M3_PER_YD3 = 0.764554857984
const M2_PER_FT2 = M_PER_FT * M_PER_FT

export const ft = (feet: number) => feet * M_PER_FT
export const inch = (inches: number) => inches * M_PER_IN

/** Round to a sane number of decimals so float noise never reaches the UI. */
const round = (n: number, places: number) => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

/**
 * Format a length in meters for display.
 * Imperial renders as feet + inches (`12' 6"`), which is how a tape measure reads.
 */
export function formatLength(meters: number, units: Units): string {
  if (!Number.isFinite(meters)) return '—'
  if (units === 'm') return `${round(meters, 2)} m`

  const negative = meters < 0
  const totalInches = Math.abs(meters) / M_PER_IN
  // Round to 1/8" first, so 3.9999" shows as 4" rather than 3 7/8".
  const eighths = Math.round(totalInches * 8)
  let feet = Math.floor(eighths / 96)
  let remEighths = eighths - feet * 96
  if (remEighths === 96) {
    feet += 1
    remEighths = 0
  }

  const whole = Math.floor(remEighths / 8)
  const frac = remEighths - whole * 8
  const sign = negative ? '-' : ''

  const parts: string[] = []
  if (feet > 0) parts.push(`${feet}'`)
  if (whole > 0 || frac > 0 || feet === 0) {
    let inchText = `${whole}`
    if (frac > 0) {
      // Reduce eighths to lowest terms: 4/8 -> 1/2, 6/8 -> 3/4.
      let num = frac
      let den = 8
      while (num % 2 === 0 && den % 2 === 0) {
        num /= 2
        den /= 2
      }
      inchText = whole > 0 ? `${whole} ${num}/${den}` : `${num}/${den}`
    }
    parts.push(`${inchText}"`)
  }
  return sign + parts.join(' ')
}

/** Compact form for on-canvas dimension labels — no fractions, less clutter. */
export function formatLengthShort(meters: number, units: Units): string {
  if (!Number.isFinite(meters)) return '—'
  if (units === 'm') return `${round(meters, 2)}m`
  const totalFeet = meters / M_PER_FT
  const feet = Math.floor(totalFeet)
  const inches = Math.round((totalFeet - feet) * 12)
  if (inches === 12) return `${feet + 1}'`
  return inches === 0 ? `${feet}'` : `${feet}'${inches}"`
}

/**
 * Parse a user-typed length into meters. Accepts the shapes people actually
 * type: `12'6"`, `12' 6`, `12.5'`, `150in`, `3.8m`, `12-6`, or a bare number
 * interpreted in the current display unit. Returns null on unparseable input.
 */
export function parseLength(input: string, units: Units): number | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!raw) return null

  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1).trim() : raw
  const signed = (m: number) => (negative ? -m : m)

  const num = '(\\d+(?:\\.\\d+)?|\\.\\d+)'

  // Explicit metric: 3.8m / 3.8 m / 380cm / 380 cm / 3800mm
  let match = body.match(new RegExp(`^${num}\\s*(m|cm|mm|meters?|metres?)$`))
  if (match) {
    const v = parseFloat(match[1])
    const unit = match[2]
    if (unit === 'cm') return signed(v / 100)
    if (unit === 'mm') return signed(v / 1000)
    return signed(v)
  }

  // Inches only: 150in / 150" / 150 inches
  match = body.match(new RegExp(`^${num}\\s*(?:"|in|inch|inches)$`))
  if (match) return signed(parseFloat(match[1]) * M_PER_IN)

  // Feet + inches: 12'6" / 12' 6 / 12ft 6in / 12-6
  match = body.match(
    new RegExp(`^${num}\\s*(?:'|ft|feet|foot)\\s*${num}\\s*(?:"|in|inch|inches)?$`),
  )
  if (match) {
    return signed(parseFloat(match[1]) * M_PER_FT + parseFloat(match[2]) * M_PER_IN)
  }
  match = body.match(new RegExp(`^${num}\\s*-\\s*${num}$`))
  if (match && units === 'ft') {
    return signed(parseFloat(match[1]) * M_PER_FT + parseFloat(match[2]) * M_PER_IN)
  }

  // Feet only: 12' / 12.5ft / 12 feet
  match = body.match(new RegExp(`^${num}\\s*(?:'|ft|feet|foot)$`))
  if (match) return signed(parseFloat(match[1]) * M_PER_FT)

  // Bare number — interpret in the active display unit.
  match = body.match(new RegExp(`^${num}$`))
  if (match) {
    const v = parseFloat(match[1])
    return signed(units === 'ft' ? v * M_PER_FT : v)
  }

  return null
}

/** Value to put in a text input so the user can edit it, then re-parse it. */
export function lengthToInputValue(meters: number, units: Units): string {
  if (units === 'm') return String(round(meters, 3))
  return String(round(meters / M_PER_FT, 3))
}

export function formatArea(squareMeters: number, units: Units): string {
  if (units === 'm') return `${round(squareMeters, 2)} m²`
  return `${round(squareMeters / M2_PER_FT2, 1)} sq ft`
}

/**
 * Volumes are for ordering bulk material, so imperial reports cubic yards
 * rather than cubic feet — that is the unit landscape suppliers sell in.
 */
export function formatVolume(cubicMeters: number, units: Units): string {
  if (units === 'm') return `${round(cubicMeters, 2)} m³`
  return `${round(cubicMeters / M3_PER_YD3, 2)} cu yd`
}

export const unitLabel = (units: Units) => (units === 'ft' ? 'ft' : 'm')
