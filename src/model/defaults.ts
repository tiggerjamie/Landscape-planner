import { rectangle, v2 } from '../geometry/polygon'
import { ft, inch } from '../units'
import { SCENE_VERSION, type Building, type Scene, type Window, uid } from './types'

/**
 * The starting scene: a plain rectangular lot with our house along the north
 * edge and a neighbor's house beyond the back fence. It exists so the tool
 * opens onto something recognizable that can be dragged into shape, rather
 * than an empty void.
 */

const window = (
  name: string,
  wallIndex: number,
  offsetAlongWall: number,
  sillHeight: number,
  width: number,
  height: number,
): Window => ({
  id: uid('win'),
  name,
  wallIndex,
  offsetAlongWall,
  sillHeight,
  width,
  height,
  isViewpoint: true,
})

export function createDefaultScene(name = 'Backyard Plan'): Scene {
  // 60ft wide x 45ft deep yard, with the origin at the middle of the lot.
  const lot = rectangle(ft(60), ft(45), v2(0, 0))

  // Our house sits along the -Z (far) edge of the lot, facing into the yard.
  const ownHouse: Building = {
    id: uid('bld'),
    name: 'Our house',
    kind: 'own',
    footprint: rectangle(ft(36), ft(28), v2(0, ft(-36))),
    baseElevation: 0,
    wallHeight: ft(18),
    roof: { type: 'gable', pitch: 0.5, ridgeAxis: 0, overhang: ft(1.5) },
    color: '#d9cfc0',
    windows: [
      // Edge 1 of a rectangle() footprint is the +Z face — for a house set
      // along the far edge of the lot, that is the wall looking at the yard.
      window('Kitchen', 1, ft(6), ft(3), ft(5), ft(4)),
      window('Living room', 1, ft(16), ft(1.5), ft(8), ft(6)),
      window('Bedroom (upper)', 1, ft(10), ft(12), ft(4), ft(4)),
    ],
  }

  // The neighbor is past the back fence, on a pad one foot higher than ours.
  const neighborHouse: Building = {
    id: uid('bld'),
    name: "Neighbor's house",
    kind: 'neighbor',
    footprint: rectangle(ft(34), ft(26), v2(ft(4), ft(35))),
    baseElevation: ft(1),
    wallHeight: ft(19),
    roof: { type: 'gable', pitch: 0.5, ridgeAxis: 0, overhang: ft(1.5) },
    color: '#c8c9c4',
    windows: [
      // Edge 3 is the -Z face, the neighbor wall that overlooks our yard.
      window('Neighbor ground window', 3, ft(10), ft(3), ft(5), ft(4)),
      window('Neighbor upstairs window', 3, ft(18), ft(12.5), ft(4), ft(4)),
    ],
  }

  return {
    version: SCENE_VERSION,
    id: uid('scene'),
    name,
    units: 'ft',
    lot,
    buildings: [ownHouse, neighborHouse],
    surfaces: [],
    objects: [],
    viewpoints: [
      {
        id: uid('vp'),
        name: 'Standing on the patio',
        position: v2(0, ft(-14)),
        eyeHeight: ft(5.5),
        headingDeg: 180,
      },
    ],
    // Not a real solar model — an angle that lights the yard legibly from the
    // default viewing position. Adjustable per layout.
    sun: { azimuthDeg: 40, elevationDeg: 52 },
    season: 'summer',
    snapIncrement: inch(6),
  }
}
