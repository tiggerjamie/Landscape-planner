import { beforeAll, describe, expect, it } from 'vitest'
import { rectangle, v2 } from '../geometry/polygon'
import { ft } from '../units'
import { uid, type Building, type Scene, type SceneObject } from '../model/types'
import { createDefaultScene } from '../model/defaults'
import { analyzePrivacy, collectOccluders, collectViewpoints } from './sightlines'
import { createObject } from '../objects/factory'

/**
 * These tests are the real check on the feature the tool exists for: does
 * putting something in the way actually change the verdict?
 */

beforeAll(async () => {
  // Registering the object kinds is a side effect of importing the defs.
  await import('../objects/defs')
})

/** Two facing houses 40ft apart, each with one window looking at the other. */
function facingHouses(): Scene {
  const base = createDefaultScene('Test')

  const ours: Building = {
    id: 'ours',
    name: 'Ours',
    kind: 'own',
    footprint: rectangle(ft(30), ft(20), v2(0, ft(-30))),
    baseElevation: 0,
    wallHeight: ft(18),
    roof: { type: 'flat', pitch: 0, ridgeAxis: 0, overhang: 0 },
    color: '#fff',
    windows: [
      {
        id: 'ourWindow',
        name: 'Ours',
        wallIndex: 1, // the +Z face, looking into the yard
        offsetAlongWall: ft(13),
        sillHeight: ft(3),
        width: ft(4),
        height: ft(4),
        isViewpoint: true,
      },
    ],
  }

  const theirs: Building = {
    id: 'theirs',
    name: 'Theirs',
    kind: 'neighbor',
    footprint: rectangle(ft(30), ft(20), v2(0, ft(30))),
    baseElevation: 0,
    wallHeight: ft(18),
    roof: { type: 'flat', pitch: 0, ridgeAxis: 0, overhang: 0 },
    color: '#fff',
    windows: [
      {
        id: 'theirWindow',
        name: 'Theirs',
        wallIndex: 3, // the -Z face, looking back at us
        offsetAlongWall: ft(13),
        sillHeight: ft(3),
        width: ft(4),
        height: ft(4),
        isViewpoint: true,
      },
    ],
  }

  return { ...base, buildings: [ours, theirs], objects: [], viewpoints: [] }
}

function place(scene: Scene, kind: string, at: { x: number; z: number }, params: Record<string, unknown> = {}): Scene {
  const obj = createObject(kind, at)!
  const withParams: SceneObject = { ...obj, id: uid('obj'), params: { ...obj.params, ...params } }
  return { ...scene, objects: [...scene.objects, withParams] }
}

const between = (scene: Scene, fromId: string, toId: string) =>
  analyzePrivacy(scene).results.find((r) => r.fromId === fromId && r.toId === toId)!

describe('analyzePrivacy on two facing houses', () => {
  it('reports a clear view across an empty yard', () => {
    const result = between(facingHouses(), 'ourWindow', 'theirWindow')
    expect(result.exposure).toBe('exposed')
    expect(result.visibleSamples).toBe(result.sampleCount)
    expect(result.blockerId).toBeNull()
  })

  it('is symmetric — if we can see them, they can see us', () => {
    const scene = facingHouses()
    expect(between(scene, 'ourWindow', 'theirWindow').exposure).toBe('exposed')
    expect(between(scene, 'theirWindow', 'ourWindow').exposure).toBe('exposed')
  })

  it('does not evaluate a window against its own building', () => {
    const scene = facingHouses()
    const results = analyzePrivacy(scene).results
    expect(results.every((r) => r.fromId !== r.toId)).toBe(true)
    expect(results).toHaveLength(2) // one each way
  })

  it('reports the distance between the two windows', () => {
    const result = between(facingHouses(), 'ourWindow', 'theirWindow')
    // Wall faces are at z = -20ft and z = +20ft.
    expect(result.distance).toBeGreaterThan(ft(39))
    expect(result.distance).toBeLessThan(ft(41))
  })
})

describe('screening changes the verdict', () => {
  it('a tall solid fence screens a ground-floor window', () => {
    const scene = place(facingHouses(), 'fence', v2(0, 0), {
      length: ft(40),
      height: ft(8),
      style: 'privacy',
    })
    const result = between(scene, 'ourWindow', 'theirWindow')
    expect(result.exposure).toBe('blocked')
    expect(result.visibleSamples).toBe(0)
  })

  it('a short fence does not screen a window above it', () => {
    const scene = place(facingHouses(), 'fence', v2(0, 0), {
      length: ft(40),
      height: ft(3),
      style: 'privacy',
    })
    expect(between(scene, 'ourWindow', 'theirWindow').exposure).toBe('exposed')
  })

  it('a picket fence is not treated as a visual screen', () => {
    const scene = place(facingHouses(), 'fence', v2(0, 0), {
      length: ft(40),
      height: ft(8),
      style: 'picket',
    })
    expect(between(scene, 'ourWindow', 'theirWindow').exposure).toBe('exposed')
  })

  it('an off-centre fence screens only part of the window', () => {
    // Offset 1ft to one side of a 4ft window, so the sightlines to one edge
    // clear it and the sightlines to the other do not.
    const scene = place(facingHouses(), 'fence', v2(ft(1), 0), {
      length: ft(3),
      height: ft(8),
      style: 'privacy',
    })
    const result = between(scene, 'ourWindow', 'theirWindow')
    expect(result.exposure).toBe('partial')
    expect(result.visibleSamples).toBeGreaterThan(0)
    expect(result.visibleSamples).toBeLessThan(result.sampleCount)
  })

  it('a centred screen needs only half the window width to block it all', () => {
    // The eye is a point, so a screen halfway along the sightline covers twice
    // its own width at the target. Worth knowing before buying a narrow panel.
    const scene = place(facingHouses(), 'fence', v2(0, 0), {
      length: ft(3),
      height: ft(8),
      style: 'privacy',
    })
    expect(between(scene, 'ourWindow', 'theirWindow').exposure).toBe('blocked')
  })

  it('names what is doing the screening', () => {
    const scene = place(facingHouses(), 'fence', v2(0, 0), {
      length: ft(40),
      height: ft(8),
      style: 'privacy',
    })
    const result = between(scene, 'ourWindow', 'theirWindow')
    expect(result.blockerId).toBe(scene.objects[0].id)
  })

  it('removing the screen re-exposes the sightline', () => {
    const screened = place(facingHouses(), 'fence', v2(0, 0), {
      length: ft(40),
      height: ft(8),
      style: 'privacy',
    })
    expect(between(screened, 'ourWindow', 'theirWindow').exposure).toBe('blocked')

    const removed = { ...screened, objects: [] }
    expect(between(removed, 'ourWindow', 'theirWindow').exposure).toBe('exposed')
  })
})

describe('trees and seasons', () => {
  /** A tree whose canopy sits right across the 3-7ft window band. */
  const screeningTree = (scene: Scene, deciduous: boolean) =>
    place(scene, 'tree', v2(0, 0), {
      trunkHeight: ft(2),
      canopyWidth: ft(20),
      canopyHeight: ft(16),
      canopyShape: 'round',
      deciduous,
    })

  it('an evergreen screens in both seasons', () => {
    const summer = screeningTree(facingHouses(), false)
    expect(between(summer, 'ourWindow', 'theirWindow').exposure).toBe('blocked')

    const winter = { ...summer, season: 'winter' as const }
    expect(between(winter, 'ourWindow', 'theirWindow').exposure).toBe('blocked')
  })

  it('a deciduous tree screens in summer but not in winter', () => {
    const summer = screeningTree(facingHouses(), true)
    expect(between(summer, 'ourWindow', 'theirWindow').exposure).toBe('blocked')

    const winter = { ...summer, season: 'winter' as const }
    expect(between(winter, 'ourWindow', 'theirWindow').exposure).toBe('exposed')
  })

  it('a high canopy on a bare trunk does not screen a low window', () => {
    // Offset so the trunk itself is not in the line of sight.
    const scene = place(facingHouses(), 'tree', v2(ft(6), 0), {
      trunkHeight: ft(14),
      canopyWidth: ft(20),
      canopyHeight: ft(10),
      deciduous: false,
    })
    expect(between(scene, 'ourWindow', 'theirWindow').exposure).toBe('exposed')
  })

  it('a trunk standing in the sightline clips the middle of the view', () => {
    // Not a rounding artifact: an 8in trunk dead centre really does interrupt
    // the centre of the window, while the edges stay visible around it.
    const scene = place(facingHouses(), 'tree', v2(0, 0), {
      trunkHeight: ft(14),
      trunkDiameter: ft(0.67),
      canopyWidth: ft(20),
      canopyHeight: ft(10),
      deciduous: false,
    })
    const result = between(scene, 'ourWindow', 'theirWindow')
    expect(result.exposure).toBe('partial')
    expect(result.blockerId).toBe(scene.objects[0].id)
  })
})

describe('pergolas', () => {
  it('an open-rafter pergola does not screen a horizontal view', () => {
    // Posts are thin and off to the side; the view between them is clear.
    const scene = place(facingHouses(), 'pergola', v2(0, 0), {
      width: ft(12),
      depth: ft(12),
      postHeight: ft(8),
      canopy: false,
    })
    expect(between(scene, 'ourWindow', 'theirWindow').exposure).toBe('exposed')
  })

  it('a canopy screens the view down from an upstairs window', () => {
    const scene0 = facingHouses()
    // Add an upstairs neighbor window that looks down into our yard.
    const upstairs = {
      ...scene0,
      buildings: scene0.buildings.map((b) =>
        b.id === 'theirs'
          ? {
              ...b,
              windows: [
                ...b.windows,
                {
                  id: 'theirUpstairs',
                  name: 'Upstairs',
                  wallIndex: 3,
                  offsetAlongWall: ft(13),
                  sillHeight: ft(13),
                  width: ft(4),
                  height: ft(4),
                  isViewpoint: true,
                },
              ],
            }
          : b,
      ),
    }
    // A standing point on the patio, directly under where the pergola will go.
    const withPatio: Scene = {
      ...upstairs,
      viewpoints: [
        { id: 'patio', name: 'Patio', position: v2(0, ft(-8)), eyeHeight: ft(5.5), headingDeg: 180 },
      ],
    }

    const open = between(withPatio, 'theirUpstairs', 'ourWindow')
    expect(open.exposure).toBe('exposed')

    const covered = place(withPatio, 'pergola', v2(0, ft(-12)), {
      width: ft(14),
      depth: ft(14),
      postHeight: ft(9),
      canopy: true,
    })
    // The canopy sits between their upstairs window and our ground window.
    expect(between(covered, 'theirUpstairs', 'ourWindow').exposure).not.toBe('exposed')
  })
})

describe('report summary', () => {
  it('counts cross-property sightlines by exposure', () => {
    const report = analyzePrivacy(facingHouses())
    expect(report.crossProperty).toHaveLength(2)
    expect(report.exposedCount).toBe(2)
    expect(report.blockedCount).toBe(0)

    const screened = analyzePrivacy(
      place(facingHouses(), 'fence', v2(0, 0), {
        length: ft(40),
        height: ft(8),
        style: 'privacy',
      }),
    )
    expect(screened.blockedCount).toBe(2)
    expect(screened.exposedCount).toBe(0)
  })

  it('flags whether the target is within the viewer field of view', () => {
    const result = between(facingHouses(), 'ourWindow', 'theirWindow')
    // The two windows face each other head-on.
    expect(result.inFieldOfView).toBe(true)
  })
})

describe('collectors', () => {
  it('collects occluders from buildings and placed objects', () => {
    const scene = place(facingHouses(), 'shed', v2(ft(10), 0))
    const occluders = collectOccluders(scene)
    // Two flat-roofed buildings contribute one prism each, the shed two.
    expect(occluders).toHaveLength(4)
    expect(occluders.some((o) => o.sourceId === scene.objects[0].id)).toBe(true)
  })

  it('offers every viewpoint window plus standing points as camera positions', () => {
    const scene: Scene = {
      ...facingHouses(),
      viewpoints: [
        { id: 'patio', name: 'Patio', position: v2(0, 0), eyeHeight: ft(5.5), headingDeg: 180 },
      ],
    }
    const viewpoints = collectViewpoints(scene)
    expect(viewpoints.map((v) => v.id).sort()).toEqual(['ourWindow', 'patio', 'theirWindow'])
  })

  it('skips windows whose wall no longer exists', () => {
    const scene = facingHouses()
    scene.buildings[0].windows[0].wallIndex = 99
    expect(collectViewpoints(scene).map((v) => v.id)).not.toContain('ourWindow')
  })

  it('orients a standing point by its heading', () => {
    const scene: Scene = {
      ...facingHouses(),
      viewpoints: [
        { id: 'patio', name: 'Patio', position: v2(0, 0), eyeHeight: ft(5.5), headingDeg: 180 },
      ],
    }
    const patio = collectViewpoints(scene).find((v) => v.id === 'patio')!
    // Heading 180 looks toward +Z.
    expect(patio.facing.z).toBeCloseTo(1, 9)
    expect(patio.facing.x).toBeCloseTo(0, 9)
  })
})
