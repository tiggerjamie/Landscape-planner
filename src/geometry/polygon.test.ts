import { describe, expect, it } from 'vitest'
import {
  area,
  bounds,
  centroid,
  containsPoint,
  edges,
  ensureCCW,
  isClockwise,
  perimeter,
  rectangle,
  setEdgeLength,
  snapPoint,
  triangulate,
  v2,
} from './polygon'

const square = [v2(0, 0), v2(0, 10), v2(10, 10), v2(10, 0)] // CCW, 10x10

// An L-shape: a 10x10 square with a 4x4 bite taken out of one corner.
const lShape = [
  v2(0, 0),
  v2(0, 10),
  v2(10, 10),
  v2(10, 6),
  v2(4, 6),
  v2(4, 0),
]

describe('area and centroid', () => {
  it('computes the area of a rectangle', () => {
    expect(area(square)).toBeCloseTo(100, 9)
    expect(area(rectangle(6, 4))).toBeCloseTo(24, 9)
  })

  it('computes the area of an L-shape', () => {
    // 10x10 minus the 6x6 notch = 64.
    expect(area(lShape)).toBeCloseTo(64, 9)
  })

  it('ignores winding order for unsigned area', () => {
    expect(area([...square].reverse())).toBeCloseTo(100, 9)
  })

  it('finds the centroid of a rectangle at its center', () => {
    const c = centroid(square)
    expect(c.x).toBeCloseTo(5, 9)
    expect(c.z).toBeCloseTo(5, 9)
  })

  it('pulls the L-shape centroid toward the heavier side', () => {
    const c = centroid(lShape)
    // Hand-computed: two rects, 4x10 (area 40, centroid 2,5) and 6x4 (area 24, centroid 7,8).
    expect(c.x).toBeCloseTo((40 * 2 + 24 * 7) / 64, 6)
    expect(c.z).toBeCloseTo((40 * 5 + 24 * 8) / 64, 6)
  })

  it('measures perimeter', () => {
    expect(perimeter(square)).toBeCloseTo(40, 9)
  })
})

describe('winding order', () => {
  it('detects clockwise input and normalizes it', () => {
    const cw = [...square].reverse()
    expect(isClockwise(cw)).toBe(true)
    expect(isClockwise(square)).toBe(false)
    expect(isClockwise(ensureCCW(cw))).toBe(false)
    expect(ensureCCW(square)).toBe(square) // already CCW, returned as-is
  })
})

describe('edges', () => {
  it('reports lengths and midpoints', () => {
    const e = edges(square)
    expect(e).toHaveLength(4)
    expect(e[0].length).toBeCloseTo(10, 9)
    expect(e[0].midpoint.x).toBeCloseTo(0, 9)
    expect(e[0].midpoint.z).toBeCloseTo(5, 9)
  })

  it('points normals out of the polygon regardless of winding', () => {
    // Edge 0 runs from (0,0) to (0,10) — the west wall, so it faces -x.
    for (const poly of [square, [...square].reverse()]) {
      const e = edges(poly)
      const west = e.find((edge) => Math.abs(edge.midpoint.x) < 1e-9)!
      expect(west.normal.x).toBeCloseTo(-1, 9)
      expect(west.normal.z).toBeCloseTo(0, 9)
    }
  })

  it('gives every normal a positive outward component from the centroid', () => {
    const c = centroid(lShape)
    for (const e of edges(lShape)) {
      const outward = (e.midpoint.x - c.x) * e.normal.x + (e.midpoint.z - c.z) * e.normal.z
      expect(outward).toBeGreaterThan(0)
    }
  })
})

describe('containsPoint', () => {
  it('tests points against a square', () => {
    expect(containsPoint(square, v2(5, 5))).toBe(true)
    expect(containsPoint(square, v2(-1, 5))).toBe(false)
    expect(containsPoint(square, v2(11, 5))).toBe(false)
  })

  it('excludes points inside the notch of an L-shape', () => {
    expect(containsPoint(lShape, v2(2, 2))).toBe(true)
    expect(containsPoint(lShape, v2(8, 2))).toBe(false) // in the bite
    expect(containsPoint(lShape, v2(8, 8))).toBe(true)
  })
})

describe('bounds', () => {
  it('measures the extents', () => {
    const b = bounds(lShape)
    expect(b.width).toBeCloseTo(10, 9)
    expect(b.depth).toBeCloseTo(10, 9)
    expect(b.center.x).toBeCloseTo(5, 9)
  })

  it('handles empty input without producing NaN', () => {
    const b = bounds([])
    expect(b.width).toBe(0)
    expect(b.center.x).toBe(0)
  })
})

describe('setEdgeLength', () => {
  it('resizes an edge by moving its end vertex along the edge direction', () => {
    // Edge 0 runs (0,0) -> (0,10). Stretch it to 24.
    const next = setEdgeLength(square, 0, 24)
    expect(next[0]).toEqual(v2(0, 0)) // start corner stays put
    expect(next[1].x).toBeCloseTo(0, 9)
    expect(next[1].z).toBeCloseTo(24, 9)
    expect(edges(next)[0].length).toBeCloseTo(24, 9)
  })

  it('wraps around for the closing edge', () => {
    const next = setEdgeLength(square, 3, 5)
    expect(next[0].x).toBeCloseTo(5, 9)
    expect(next[0].z).toBeCloseTo(0, 9)
  })

  it('rejects non-positive lengths', () => {
    expect(setEdgeLength(square, 0, 0)).toBe(square)
    expect(setEdgeLength(square, 0, -3)).toBe(square)
  })
})

describe('snapPoint', () => {
  it('snaps to the increment', () => {
    expect(snapPoint(v2(1.03, 2.07), 0.1)).toEqual({ x: 1, z: 2.1 })
  })

  it('is a no-op when snapping is off', () => {
    const p = v2(1.03, 2.07)
    expect(snapPoint(p, 0)).toBe(p)
  })
})

describe('triangulate', () => {
  const triangleArea = (poly: ReturnType<typeof v2>[], tris: number[]) => {
    let sum = 0
    for (let i = 0; i < tris.length; i += 3) {
      const a = poly[tris[i]]
      const b = poly[tris[i + 1]]
      const c = poly[tris[i + 2]]
      sum += Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) / 2
    }
    return sum
  }

  it('covers a convex polygon exactly', () => {
    const tris = triangulate(square)
    expect(tris).toHaveLength(6) // 4 verts -> 2 triangles
    expect(triangleArea(square, tris)).toBeCloseTo(100, 6)
  })

  it('covers a concave polygon exactly', () => {
    const tris = triangulate(lShape)
    expect(tris).toHaveLength(12) // 6 verts -> 4 triangles
    expect(triangleArea(lShape, tris)).toBeCloseTo(64, 6)
  })

  it('covers a clockwise polygon exactly, mapping indices back to the input', () => {
    const cw = [...lShape].reverse()
    const tris = triangulate(cw)
    expect(triangleArea(cw, tris)).toBeCloseTo(64, 6)
    expect(Math.max(...tris)).toBeLessThan(cw.length)
  })

  it('returns nothing for degenerate input', () => {
    expect(triangulate([v2(0, 0), v2(1, 1)])).toEqual([])
  })
})
