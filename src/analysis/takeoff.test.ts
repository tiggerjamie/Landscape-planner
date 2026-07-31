import { beforeAll, describe, expect, it } from 'vitest'
import { rectangle, v2 } from '../geometry/polygon'
import { createDefaultScene } from '../model/defaults'
import { uid, type Scene, type Surface } from '../model/types'
import { formatArea, formatVolume, ft, inch } from '../units'
import { createObject } from '../objects/factory'
import { computeTakeoff } from './takeoff'

beforeAll(async () => {
  await import('../objects/defs')
})

const surface = (over: Partial<Surface> = {}): Surface => ({
  id: uid('sur'),
  name: 'Patio',
  polygon: rectangle(ft(10), ft(12), v2(0, 0)),
  material: 'gravel',
  elevation: 0,
  thickness: inch(4),
  ...over,
})

const sceneWith = (surfaces: Surface[], objects: Scene['objects'] = []): Scene => ({
  ...createDefaultScene(),
  surfaces,
  objects,
})

describe('computeTakeoff', () => {
  it('reports area and bulk volume for a gravel bed', () => {
    const takeoff = computeTakeoff(sceneWith([surface()]))
    const gravel = takeoff.materials.find((m) => m.material === 'gravel')!

    expect(formatArea(gravel.area, 'ft')).toBe('120 sq ft')
    // 10 x 12ft at 4in deep.
    expect(formatVolume(gravel.volume, 'ft')).toBe('1.48 cu yd')
    expect(gravel.isBulk).toBe(true)
  })

  it('does not report a volume for materials sold by the square foot', () => {
    const takeoff = computeTakeoff(sceneWith([surface({ material: 'paver' })]))
    const paver = takeoff.materials.find((m) => m.material === 'paver')!
    expect(paver.volume).toBe(0)
    expect(paver.isBulk).toBe(false)
    expect(formatArea(paver.area, 'ft')).toBe('120 sq ft')
  })

  it('groups several surfaces of the same material into one line', () => {
    const takeoff = computeTakeoff(
      sceneWith([
        surface({ material: 'mulch', polygon: rectangle(ft(10), ft(10)) }),
        surface({ material: 'mulch', polygon: rectangle(ft(5), ft(4)) }),
      ]),
    )
    expect(takeoff.materials).toHaveLength(1)
    const mulch = takeoff.materials[0]
    expect(mulch.surfaceCount).toBe(2)
    expect(formatArea(mulch.area, 'ft')).toBe('120 sq ft')
  })

  it('counts overlapping surfaces separately, since both get bought', () => {
    // A deck built over a gravel base is two real purchases.
    const takeoff = computeTakeoff(
      sceneWith([
        surface({ material: 'gravel' }),
        surface({ material: 'deck', elevation: ft(1) }),
      ]),
    )
    expect(takeoff.materials).toHaveLength(2)
    expect(formatArea(takeoff.totalSurfaceArea, 'ft')).toBe('240 sq ft')
  })

  it('sorts materials by area, largest first', () => {
    const takeoff = computeTakeoff(
      sceneWith([
        surface({ material: 'mulch', polygon: rectangle(ft(4), ft(4)) }),
        surface({ material: 'lawn', polygon: rectangle(ft(30), ft(30)) }),
      ]),
    )
    expect(takeoff.materials.map((m) => m.material)).toEqual(['lawn', 'mulch'])
  })

  it('reports how much of the lot is still uncovered', () => {
    const scene = sceneWith([surface({ material: 'paver' })])
    const takeoff = computeTakeoff(scene)
    // Default lot is 60 x 45ft = 2700 sq ft, less the 120 sq ft patio.
    expect(formatArea(takeoff.lotArea, 'ft')).toBe('2700 sq ft')
    expect(formatArea(takeoff.uncoveredArea, 'ft')).toBe('2580 sq ft')
  })

  it('never reports negative uncovered area when surfaces overrun the lot', () => {
    const scene = sceneWith([surface({ polygon: rectangle(ft(200), ft(200)) })])
    expect(computeTakeoff(scene).uncoveredArea).toBe(0)
  })

  it('ignores degenerate surfaces', () => {
    const takeoff = computeTakeoff(sceneWith([surface({ polygon: [v2(0, 0), v2(1, 1)] })]))
    expect(takeoff.materials).toHaveLength(0)
  })
})

describe('object counts', () => {
  it('counts each object kind', () => {
    const objects = [
      createObject('raisedBed', v2(0, 0))!,
      createObject('raisedBed', v2(ft(6), 0))!,
      createObject('firePit', v2(0, ft(10)))!,
    ]
    const takeoff = computeTakeoff(sceneWith([], objects))
    const beds = takeoff.objects.find((o) => o.kind === 'raisedBed')!
    expect(beds.count).toBe(2)
    expect(beds.label).toBe('Raised Garden Bed')
    expect(takeoff.objects.find((o) => o.kind === 'firePit')!.count).toBe(1)
  })

  it('totals fence and wall runs, which are priced by the foot', () => {
    const fenceA = createObject('fence', v2(0, 0))!
    const fenceB = createObject('fence', v2(0, ft(10)))!
    const wall = createObject('retainingWall', v2(0, ft(20)))!
    const takeoff = computeTakeoff(
      sceneWith([], [
        { ...fenceA, params: { ...fenceA.params, length: ft(20) } },
        { ...fenceB, params: { ...fenceB.params, length: ft(15) } },
        { ...wall, params: { ...wall.params, length: ft(12) } },
      ]),
    )
    expect(takeoff.linearBoundary).toBeCloseTo(ft(47), 6)
  })

  it('does not count non-boundary objects toward linear footage', () => {
    const takeoff = computeTakeoff(sceneWith([], [createObject('pergola', v2(0, 0))!]))
    expect(takeoff.linearBoundary).toBe(0)
  })
})
