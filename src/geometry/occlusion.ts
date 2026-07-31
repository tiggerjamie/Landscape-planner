/**
 * Ray casting against simplified occluder shapes, in plain data — no three.js.
 *
 * The privacy analysis is the reason this tool exists, so it must be testable
 * without a renderer. Every scene element reduces to one of two primitives:
 *
 *  - `prism`  a polygon extruded vertically. Buildings, fences, walls, sheds,
 *             raised beds, pergola posts and roofs are all vertical extrusions.
 *  - `ellipsoid`  tree canopies and shrubs.
 *
 * These cover the shapes that actually block a sightline in a backyard, and
 * both have cheap exact ray tests.
 */

import { containsPoint, type Vec2 } from './polygon'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

export interface PrismOccluder {
  type: 'prism'
  polygon: Vec2[]
  yMin: number
  yMax: number
  /** Deciduous canopies stop screening once leaves drop. */
  seasonal?: boolean
  sourceId?: string
}

export interface EllipsoidOccluder {
  type: 'ellipsoid'
  center: Vec3
  radii: Vec3
  seasonal?: boolean
  sourceId?: string
}

export type Occluder = PrismOccluder | EllipsoidOccluder

const EPS = 1e-9

/**
 * Intersect the XZ projection of a ray with a polygon, returning the [tMin,
 * tMax] parameter range spent inside it. Works for concave polygons by
 * collecting every edge crossing and taking the outermost pair.
 */
function polygonRange(
  polygon: Vec2[],
  ox: number,
  oz: number,
  dx: number,
  dz: number,
): [number, number] | null {
  if (polygon.length < 3) return null

  const hits: number[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const ex = b.x - a.x
    const ez = b.z - a.z
    // Solve origin + t*dir = a + s*edge for t, with s in [0,1].
    const denom = dx * ez - dz * ex
    if (Math.abs(denom) < EPS) continue // parallel
    const t = ((a.x - ox) * ez - (a.z - oz) * ex) / denom
    const s = ((a.x - ox) * dz - (a.z - oz) * dx) / denom
    if (s >= -EPS && s <= 1 + EPS) hits.push(t)
  }

  if (hits.length === 0) {
    // No edge crossings: either fully outside, or the ray starts inside a
    // polygon it never leaves (possible only for degenerate input).
    return containsPoint(polygon, { x: ox, z: oz }) ? [-Infinity, Infinity] : null
  }
  let lo = Infinity
  let hi = -Infinity
  for (const t of hits) {
    if (t < lo) lo = t
    if (t > hi) hi = t
  }
  // A ray starting inside the polygon has its entry behind the origin.
  if (containsPoint(polygon, { x: ox, z: oz })) lo = Math.min(lo, 0)
  return [lo, hi]
}

/**
 * Does the segment from `from` to `to` hit this occluder?
 * Endpoints are excluded by `margin` so a window's own wall does not count as
 * blocking the view out of it.
 */
export function segmentHitsOccluder(
  occluder: Occluder,
  from: Vec3,
  to: Vec3,
  margin = 1e-4,
): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const segLength = Math.hypot(dx, dy, dz)
  if (segLength < EPS) return false

  // Parameterize t over [0,1]; shrink the interval so both endpoints are free.
  const tMinAllowed = margin / segLength
  const tMaxAllowed = 1 - margin / segLength
  if (tMinAllowed >= tMaxAllowed) return false

  if (occluder.type === 'prism') {
    if (occluder.yMax - occluder.yMin < EPS) return false

    // Vertical slab range.
    let tLo = tMinAllowed
    let tHi = tMaxAllowed
    if (Math.abs(dy) < EPS) {
      if (from.y < occluder.yMin || from.y > occluder.yMax) return false
    } else {
      const t1 = (occluder.yMin - from.y) / dy
      const t2 = (occluder.yMax - from.y) / dy
      tLo = Math.max(tLo, Math.min(t1, t2))
      tHi = Math.min(tHi, Math.max(t1, t2))
      if (tLo > tHi) return false
    }

    const range = polygonRange(occluder.polygon, from.x, from.z, dx, dz)
    if (!range) return false
    tLo = Math.max(tLo, range[0])
    tHi = Math.min(tHi, range[1])
    return tLo <= tHi
  }

  // Ellipsoid: scale into unit-sphere space and solve the quadratic.
  const rx = Math.max(occluder.radii.x, EPS)
  const ry = Math.max(occluder.radii.y, EPS)
  const rz = Math.max(occluder.radii.z, EPS)
  const ox = (from.x - occluder.center.x) / rx
  const oy = (from.y - occluder.center.y) / ry
  const oz = (from.z - occluder.center.z) / rz
  const ux = dx / rx
  const uy = dy / ry
  const uz = dz / rz

  const a = ux * ux + uy * uy + uz * uz
  if (a < EPS) return false
  const b = 2 * (ox * ux + oy * uy + oz * uz)
  const c = ox * ox + oy * oy + oz * oz - 1
  const disc = b * b - 4 * a * c
  if (disc < 0) return false
  const sq = Math.sqrt(disc)
  const t1 = (-b - sq) / (2 * a)
  const t2 = (-b + sq) / (2 * a)
  const lo = Math.max(tMinAllowed, Math.min(t1, t2))
  const hi = Math.min(tMaxAllowed, Math.max(t1, t2))
  return lo <= hi
}

/** The first occluder blocking this segment, or null if the view is clear. */
export function firstBlocker(
  occluders: Occluder[],
  from: Vec3,
  to: Vec3,
  margin?: number,
): Occluder | null {
  for (const o of occluders) {
    if (segmentHitsOccluder(o, from, to, margin)) return o
  }
  return null
}

/** Drop occluders that do not screen in the given season. */
export function activeOccluders(occluders: Occluder[], season: 'summer' | 'winter'): Occluder[] {
  if (season === 'summer') return occluders
  return occluders.filter((o) => !o.seasonal)
}
