/**
 * 2D polygon helpers on the ground plane. Points are {x, z} in meters —
 * z stands in for the "y" of a top-down plan, matching three.js world axes
 * where +Y is up.
 */

export interface Vec2 {
  x: number
  z: number
}

export const v2 = (x: number, z: number): Vec2 => ({ x, z })

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z })
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z })
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s })
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z
export const length = (a: Vec2): number => Math.hypot(a.x, a.z)
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.z - a.z)

export function normalize(a: Vec2): Vec2 {
  const len = length(a)
  return len < 1e-9 ? { x: 0, z: 0 } : { x: a.x / len, z: a.z / len }
}

/** Rotate around the origin by `deg`, clockwise when viewed from above. */
export function rotate(a: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: a.x * c - a.z * s, z: a.x * s + a.z * c }
}

/**
 * Signed area via the shoelace formula.
 *
 * Positive means counter-clockwise *as seen from above* — a camera at +Y
 * looking down, which is how the plan view renders. Note that in three.js
 * axes screen-up is -Z, so this is the negation of the textbook x/y shoelace;
 * getting that backwards silently inverts every outward wall normal.
 */
export function signedArea(points: Vec2[]): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += b.x * a.z - a.x * b.z
  }
  return sum / 2
}

export const area = (points: Vec2[]): number => Math.abs(signedArea(points))

export const isClockwise = (points: Vec2[]): boolean => signedArea(points) < 0

/** Return the polygon wound counter-clockwise, copying only when needed. */
export function ensureCCW(points: Vec2[]): Vec2[] {
  return isClockwise(points) ? [...points].reverse() : points
}

/** Area-weighted centroid. Falls back to the average vertex for degenerate input. */
export function centroid(points: Vec2[]): Vec2 {
  const a = signedArea(points)
  if (points.length === 0) return { x: 0, z: 0 }
  if (Math.abs(a) < 1e-12) {
    const sum = points.reduce((acc, p) => add(acc, p), v2(0, 0))
    return scale(sum, 1 / points.length)
  }
  let cx = 0
  let cz = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const q = points[(i + 1) % points.length]
    const cross = q.x * p.z - p.x * q.z // same winding convention as signedArea
    cx += (p.x + q.x) * cross
    cz += (p.z + q.z) * cross
  }
  return { x: cx / (6 * a), z: cz / (6 * a) }
}

export function perimeter(points: Vec2[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    sum += distance(points[i], points[(i + 1) % points.length])
  }
  return sum
}

export interface Edge {
  index: number
  start: Vec2
  end: Vec2
  length: number
  /** Unit vector from start to end. */
  direction: Vec2
  /** Unit vector pointing out of the polygon, perpendicular to the edge. */
  normal: Vec2
  midpoint: Vec2
}

/**
 * Describe each edge, including an outward normal. Windows hang off these
 * edges, and the normal is the direction a viewer at that window looks.
 */
export function edges(points: Vec2[]): Edge[] {
  const ccw = !isClockwise(points)
  return points.map((start, index) => {
    const end = points[(index + 1) % points.length]
    const delta = sub(end, start)
    const direction = normalize(delta)
    // For CCW-from-above winding the outward normal is (-dz, dx); flip for CW.
    const normal = ccw
      ? { x: -direction.z, z: direction.x }
      : { x: direction.z, z: -direction.x }
    return {
      index,
      start,
      end,
      length: length(delta),
      direction,
      normal,
      midpoint: scale(add(start, end), 0.5),
    }
  })
}

/** Ray-casting point-in-polygon test. Points exactly on an edge are unspecified. */
export function containsPoint(points: Vec2[], p: Vec2): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    const straddles = a.z > p.z !== b.z > p.z
    if (straddles && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside
    }
  }
  return inside
}

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  width: number
  depth: number
  center: Vec2
}

export function bounds(points: Vec2[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, width: 0, depth: 0, center: v2(0, 0) }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.z < minZ) minZ = p.z
    if (p.z > maxZ) maxZ = p.z
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    center: v2((minX + maxX) / 2, (minZ + maxZ) / 2),
  }
}

/** Axis-aligned rectangle as a CCW polygon, centered on `center`. */
export function rectangle(width: number, depth: number, center: Vec2 = v2(0, 0)): Vec2[] {
  const hw = width / 2
  const hd = depth / 2
  return [
    v2(center.x - hw, center.z - hd),
    v2(center.x - hw, center.z + hd),
    v2(center.x + hw, center.z + hd),
    v2(center.x + hw, center.z - hd),
  ]
}

/** Regular n-gon, used for round fire pits and planters. */
export function regularPolygon(sides: number, radius: number, center: Vec2 = v2(0, 0)): Vec2[] {
  const pts: Vec2[] = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2
    pts.push(v2(center.x + Math.cos(a) * radius, center.z + Math.sin(a) * radius))
  }
  return pts
}

/**
 * Resize an edge to `newLength` by moving its end vertex along the edge
 * direction. This is what per-edge dimension entry does: type "24 ft" on a
 * side and that side becomes 24 ft while the previous corner stays put.
 */
export function setEdgeLength(points: Vec2[], edgeIndex: number, newLength: number): Vec2[] {
  if (points.length < 2 || newLength <= 0) return points
  const start = points[edgeIndex]
  const endIndex = (edgeIndex + 1) % points.length
  const dir = normalize(sub(points[endIndex], start))
  if (length(dir) < 1e-9) return points
  const next = [...points]
  next[endIndex] = add(start, scale(dir, newLength))
  return next
}

/** Snap a point to a grid increment (meters). An increment of 0 disables snapping. */
export function snapPoint(p: Vec2, increment: number): Vec2 {
  if (increment <= 0) return p
  return {
    x: Math.round(p.x / increment) * increment,
    z: Math.round(p.z / increment) * increment,
  }
}

export const snapValue = (value: number, increment: number): number =>
  increment <= 0 ? value : Math.round(value / increment) * increment

/**
 * Triangulate a simple polygon by ear clipping. Used to build ground-surface
 * meshes for patios and beds of arbitrary shape.
 * Returns flat index triples into the input array.
 */
export function triangulate(points: Vec2[]): number[] {
  const n = points.length
  if (n < 3) return []
  const ccw = ensureCCW(points)
  const flipped = ccw !== points
  const indices = ccw.map((_, i) => i)
  const triangles: number[] = []

  // Positive for a counter-clockwise-from-above corner, matching signedArea.
  const areaOf = (a: Vec2, b: Vec2, c: Vec2) =>
    (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)

  const pointInTriangle = (p: Vec2, a: Vec2, b: Vec2, c: Vec2) => {
    const d1 = areaOf(p, a, b)
    const d2 = areaOf(p, b, c)
    const d3 = areaOf(p, c, a)
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0
    return !(hasNeg && hasPos)
  }

  let guard = 0
  while (indices.length > 3 && guard++ < n * n) {
    let clipped = false
    for (let i = 0; i < indices.length; i++) {
      const iPrev = indices[(i - 1 + indices.length) % indices.length]
      const iCur = indices[i]
      const iNext = indices[(i + 1) % indices.length]
      const a = ccw[iPrev]
      const b = ccw[iCur]
      const c = ccw[iNext]
      if (areaOf(a, b, c) <= 1e-12) continue // reflex or degenerate

      let containsOther = false
      for (const j of indices) {
        if (j === iPrev || j === iCur || j === iNext) continue
        if (pointInTriangle(ccw[j], a, b, c)) {
          containsOther = true
          break
        }
      }
      if (containsOther) continue

      triangles.push(iPrev, iCur, iNext)
      indices.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) break // self-intersecting input; emit what we have
  }
  if (indices.length === 3) triangles.push(indices[0], indices[1], indices[2])

  if (!flipped) return triangles
  // Map indices back to the caller's original (clockwise) ordering.
  return triangles.map((i) => n - 1 - i)
}
