import { describe, expect, it } from 'vitest'
import { rectangle, v2 } from '../geometry/polygon'
import { segmentHitsOccluder, v3 } from '../geometry/occlusion'
import { ft } from '../units'
import { buildingOccluders, roofMetrics, windowFrame, WALL_CLEARANCE } from './building'
import type { Building, Window } from './types'

const win = (over: Partial<Window> = {}): Window => ({
  id: 'w1',
  name: 'Test window',
  wallIndex: 1,
  offsetAlongWall: 2,
  sillHeight: 1,
  width: 2,
  height: 1.5,
  isViewpoint: true,
  ...over,
})

/** A 10 x 8 m box centered on the origin, walls 3 m, flat roof. */
const box = (over: Partial<Building> = {}): Building => ({
  id: 'b1',
  name: 'Box',
  kind: 'own',
  footprint: rectangle(10, 8, v2(0, 0)),
  baseElevation: 0,
  wallHeight: 3,
  roof: { type: 'flat', pitch: 0.5, ridgeAxis: 0, overhang: 0.4 },
  windows: [],
  color: '#fff',
  ...over,
})

describe('windowFrame', () => {
  it('places a window on the +Z wall at the right height and position', () => {
    const f = windowFrame(box(), win())
    expect(f.valid).toBe(true)
    // Edge 1 of a rectangle runs from (-5,+4) to (+5,+4): the +Z wall.
    for (const c of f.corners) expect(c.z).toBeCloseTo(4, 9)
    // Offset 2 m from the edge start, 2 m wide.
    const xs = f.corners.map((c) => c.x).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(-3, 9)
    expect(xs[3]).toBeCloseTo(-1, 9)
    const ys = f.corners.map((c) => c.y).sort((a, b) => a - b)
    expect(ys[0]).toBeCloseTo(1, 9) // sill
    expect(ys[3]).toBeCloseTo(2.5, 9) // sill + height
  })

  it('adds the base elevation, so a house on a higher pad sits higher', () => {
    const f = windowFrame(box({ baseElevation: ft(1) }), win())
    expect(f.center.y).toBeCloseTo(ft(1) + 1.75, 9)
  })

  it('points the normal out of the building and offsets the eye that way', () => {
    const f = windowFrame(box(), win())
    expect(f.normal.z).toBeCloseTo(1, 9)
    expect(f.normal.x).toBeCloseTo(0, 9)
    expect(f.eye.z).toBeCloseTo(4 + WALL_CLEARANCE, 9)
  })

  it('gives an eye point that is not blocked by its own building', () => {
    const b = box()
    const f = windowFrame(b, win())
    const occluders = buildingOccluders(b)
    // Look straight out into the yard.
    const target = v3(f.eye.x, f.eye.y, f.eye.z + 20)
    for (const o of occluders) {
      expect(segmentHitsOccluder(o, f.eye, target)).toBe(false)
    }
  })

  it('produces five sample points, all clear of the wall', () => {
    const b = box()
    const f = windowFrame(b, win())
    expect(f.samples).toHaveLength(5)
    for (const s of f.samples) expect(s.z).toBeGreaterThan(4)
  })

  it('clamps a window that no longer fits its shortened wall', () => {
    const f = windowFrame(box(), win({ offsetAlongWall: 9.5, width: 2 }))
    const xs = f.corners.map((c) => c.x)
    // Wall runs x = -5..5; the window must stay within it.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-5 - 1e-9)
    expect(Math.max(...xs)).toBeLessThanOrEqual(5 + 1e-9)
  })

  it('reports invalid when the wall index no longer exists', () => {
    // A footprint redrawn with fewer edges leaves stale window wall indices.
    expect(windowFrame(box(), win({ wallIndex: 7 })).valid).toBe(false)
  })
})

describe('roofMetrics', () => {
  it('gives a flat roof no rise', () => {
    const m = roofMetrics(box())
    expect(m.rise).toBe(0)
    expect(m.ridgeY).toBeCloseTo(3, 9)
  })

  it('computes gable rise across the span perpendicular to the ridge', () => {
    // Ridge along x, so the span is the 8 m depth: rise = 4 * 0.5 = 2.
    const alongX = roofMetrics(
      box({ roof: { type: 'gable', pitch: 0.5, ridgeAxis: 0, overhang: 0 } }),
    )
    expect(alongX.rise).toBeCloseTo(2, 9)
    expect(alongX.ridgeY).toBeCloseTo(5, 9)

    // Ridge along z, so the span is the 10 m width: rise = 5 * 0.5 = 2.5.
    const alongZ = roofMetrics(
      box({ roof: { type: 'gable', pitch: 0.5, ridgeAxis: 1, overhang: 0 } }),
    )
    expect(alongZ.rise).toBeCloseTo(2.5, 9)
  })
})

describe('buildingOccluders', () => {
  it('extrudes the walls from base to eave', () => {
    const [walls] = buildingOccluders(box())
    expect(walls.type).toBe('prism')
    if (walls.type === 'prism') {
      expect(walls.yMin).toBeCloseTo(0, 9)
      expect(walls.yMax).toBeCloseTo(3, 9)
    }
  })

  it('adds a second prism for a pitched roof but not a flat one', () => {
    expect(buildingOccluders(box())).toHaveLength(1)
    const pitched = buildingOccluders(
      box({ roof: { type: 'gable', pitch: 0.5, ridgeAxis: 0, overhang: 0 } }),
    )
    expect(pitched).toHaveLength(2)
    const roof = pitched[1]
    if (roof.type === 'prism') {
      expect(roof.yMin).toBeCloseTo(3, 9)
      expect(roof.yMax).toBeCloseTo(5, 9)
    }
  })

  it('blocks a sightline that passes through the house', () => {
    const [walls] = buildingOccluders(box())
    expect(segmentHitsOccluder(walls, v3(0, 1.5, -20), v3(0, 1.5, 20))).toBe(true)
    // Over the roofline is clear.
    expect(segmentHitsOccluder(walls, v3(0, 6, -20), v3(0, 6, 20))).toBe(false)
  })

  it('ignores a building with a degenerate footprint', () => {
    expect(buildingOccluders(box({ footprint: [] }))).toEqual([])
  })
})
