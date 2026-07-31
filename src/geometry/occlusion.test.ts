import { describe, expect, it } from 'vitest'
import { rectangle, v2 } from './polygon'
import {
  activeOccluders,
  firstBlocker,
  segmentHitsOccluder,
  v3,
  type EllipsoidOccluder,
  type PrismOccluder,
} from './occlusion'

/** A 20m-wide, 2m-tall fence panel standing on the z = 0 line. */
const fence: PrismOccluder = {
  type: 'prism',
  polygon: rectangle(20, 0.1, v2(0, 0)),
  yMin: 0,
  yMax: 2,
  sourceId: 'fence',
}

describe('prism occluders', () => {
  it('blocks a low sightline that crosses it', () => {
    // Eye at 1.5m on one side, target at 1.5m on the other.
    expect(segmentHitsOccluder(fence, v3(0, 1.5, -5), v3(0, 1.5, 5))).toBe(true)
  })

  it('does not block a sightline that passes above it', () => {
    expect(segmentHitsOccluder(fence, v3(0, 4, -5), v3(0, 4, 5))).toBe(false)
  })

  it('does not block a sightline that passes around it', () => {
    expect(segmentHitsOccluder(fence, v3(30, 1.5, -5), v3(30, 1.5, 5))).toBe(false)
  })

  it('blocks a sloped sightline only while it is below the top', () => {
    // From 0.5m up to 6m over a short run — clears the fence.
    expect(segmentHitsOccluder(fence, v3(0, 1.9, -0.2), v3(0, 6, 5))).toBe(false)
    // Shallower climb — still under 2m at the fence line.
    expect(segmentHitsOccluder(fence, v3(0, 1.0, -5), v3(0, 2.5, 15))).toBe(true)
  })

  it('ignores an occluder that lies behind the viewer', () => {
    expect(segmentHitsOccluder(fence, v3(0, 1.5, 5), v3(0, 1.5, 20))).toBe(false)
  })

  it('ignores an occluder beyond the target', () => {
    expect(segmentHitsOccluder(fence, v3(0, 1.5, -20), v3(0, 1.5, -5))).toBe(false)
  })

  it('does not treat a wall as blocking a sightline that merely ends on it', () => {
    // Target sample points sit on the face of the target window's own wall;
    // arriving at that face must not read as blocked by it.
    const face = -0.05
    expect(segmentHitsOccluder(fence, v3(0, 1.5, -10), v3(0, 1.5, face))).toBe(false)
  })

  it('does not let a wall block a view directed away from it', () => {
    // An eye on the outer face looking away from its own wall is clear.
    expect(segmentHitsOccluder(fence, v3(0, 1.5, -0.05), v3(0, 1.5, -10))).toBe(false)
  })

  it('blocks a viewpoint embedded inside a solid', () => {
    // Starting inside means traversing the remaining thickness, which is a
    // real hit rather than a rounding artifact. This is why windowFrame()
    // pushes eye points out along the wall normal instead of leaving them in
    // the wall plane, where float error could place them a hair inside.
    expect(segmentHitsOccluder(fence, v3(0, 1.5, 0), v3(0, 1.5, 10))).toBe(true)
  })

  it('handles a concave footprint', () => {
    const lShape: PrismOccluder = {
      type: 'prism',
      polygon: [v2(0, 0), v2(0, 10), v2(10, 10), v2(10, 6), v2(4, 6), v2(4, 0)],
      yMin: 0,
      yMax: 5,
    }
    // Through the solid arm.
    expect(segmentHitsOccluder(lShape, v3(2, 2, -5), v3(2, 2, 15))).toBe(true)
    // Through the notch — but the ray still exits through the far arm, so it
    // is blocked; aim entirely within the notch instead.
    expect(segmentHitsOccluder(lShape, v3(8, 2, -5), v3(8, 2, 5))).toBe(false)
  })

  it('treats a zero-height prism as transparent', () => {
    const flat: PrismOccluder = { ...fence, yMin: 1, yMax: 1 }
    expect(segmentHitsOccluder(flat, v3(0, 1, -5), v3(0, 1, 5))).toBe(false)
  })
})

describe('ellipsoid occluders', () => {
  const canopy: EllipsoidOccluder = {
    type: 'ellipsoid',
    center: v3(0, 4, 0),
    radii: v3(2.5, 2, 2.5),
    seasonal: true,
    sourceId: 'tree',
  }

  it('blocks a sightline through the canopy', () => {
    expect(segmentHitsOccluder(canopy, v3(0, 4, -10), v3(0, 4, 10))).toBe(true)
  })

  it('lets a sightline under the canopy through', () => {
    expect(segmentHitsOccluder(canopy, v3(0, 1.5, -10), v3(0, 1.5, 10))).toBe(false)
  })

  it('lets a sightline past the side of the canopy through', () => {
    expect(segmentHitsOccluder(canopy, v3(6, 4, -10), v3(6, 4, 10))).toBe(false)
  })

  it('respects the squashed vertical radius', () => {
    // 2.5m horizontal but only 2m vertical: 2.2m above center misses.
    expect(segmentHitsOccluder(canopy, v3(0, 6.2, -10), v3(0, 6.2, 10))).toBe(false)
    expect(segmentHitsOccluder(canopy, v3(0, 5.5, -10), v3(0, 5.5, 10))).toBe(true)
  })
})

describe('firstBlocker and seasons', () => {
  const canopy: EllipsoidOccluder = {
    type: 'ellipsoid',
    center: v3(0, 2, 0),
    radii: v3(3, 2, 3),
    seasonal: true,
    sourceId: 'tree',
  }

  it('names the occluder responsible for a blocked view', () => {
    const blocker = firstBlocker([canopy], v3(0, 2, -10), v3(0, 2, 10))
    expect(blocker?.sourceId).toBe('tree')
  })

  it('returns null when nothing is in the way', () => {
    expect(firstBlocker([canopy], v3(20, 2, -10), v3(20, 2, 10))).toBeNull()
  })

  it('drops deciduous screening in winter but keeps solid structures', () => {
    const all = [canopy, fence]
    expect(activeOccluders(all, 'summer')).toHaveLength(2)
    const winter = activeOccluders(all, 'winter')
    expect(winter).toHaveLength(1)
    expect(winter[0].sourceId).toBe('fence')
  })

  it('exposes a sightline in winter that the tree screened in summer', () => {
    const eye = v3(0, 2.5, -10)
    const target = v3(0, 2.5, 10)
    // The tree screens it in summer...
    expect(firstBlocker(activeOccluders([canopy], 'summer'), eye, target)).not.toBeNull()
    // ...but not once the leaves are gone.
    expect(firstBlocker(activeOccluders([canopy], 'winter'), eye, target)).toBeNull()
  })
})
