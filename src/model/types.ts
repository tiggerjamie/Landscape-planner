import type { Vec2 } from '../geometry/polygon'
import type { Units } from '../units'

export type { Vec2 }

/** Bumped whenever the schema changes; see model/migrate.ts. */
export const SCENE_VERSION = 1

export type BuildingKind = 'own' | 'neighbor'
export type RoofType = 'flat' | 'gable' | 'hip'

export interface Window {
  id: string
  name: string
  /** Index of the footprint edge this window sits on. */
  wallIndex: number
  /** Meters from that edge's start vertex to the window's left side. */
  offsetAlongWall: number
  /** Height of the sill above the building's base elevation. */
  sillHeight: number
  width: number
  height: number
  /** Whether this window is offered as a camera position in the privacy tool. */
  isViewpoint: boolean
}

export interface Roof {
  type: RoofType
  /** Rise over run. Ignored when type is 'flat'. */
  pitch: number
  /** Which footprint axis the ridge runs along: 0 = x, 1 = z. */
  ridgeAxis: 0 | 1
  overhang: number
}

export interface Building {
  id: string
  name: string
  kind: BuildingKind
  footprint: Vec2[]
  /** Grade offset — a neighbor's pad often sits higher or lower than ours. */
  baseElevation: number
  /** Ground to eave. */
  wallHeight: number
  roof: Roof
  windows: Window[]
  color: string
}

export type SurfaceMaterial =
  | 'lawn'
  | 'paver'
  | 'gravel'
  | 'mulch'
  | 'concrete'
  | 'deck'
  | 'flagstone'
  | 'water'

/** A region of ground material: patio, path, gravel bed, lawn, pond. */
export interface Surface {
  id: string
  name: string
  polygon: Vec2[]
  material: SurfaceMaterial
  /** Top height above grade — raised patios and decks sit above 0. */
  elevation: number
  /** Depth of material, used to turn area into a volume for ordering. */
  thickness: number
}

/**
 * Per-kind parameters live in a loose record. The object registry owns the
 * real shape of each kind and validates it, which keeps adding a new object
 * type to a single file with no changes to the scene schema.
 */
export interface SceneObject {
  id: string
  name: string
  kind: string
  position: Vec2
  rotationDeg: number
  /** Height of the object's base above grade. */
  elevation: number
  params: Record<string, unknown>
}

/** A place to stand and look from, e.g. where the patio chairs will go. */
export interface Viewpoint {
  id: string
  name: string
  position: Vec2
  /** Eye height above grade. */
  eyeHeight: number
  /** Compass-style heading in degrees; 0 looks toward -Z. */
  headingDeg: number
}

export interface Scene {
  version: number
  id: string
  name: string
  units: Units
  /** Yard boundary. */
  lot: Vec2[]
  buildings: Building[]
  surfaces: Surface[]
  objects: SceneObject[]
  viewpoints: Viewpoint[]
  /** Sun azimuth/elevation for shading only — not a real solar model. */
  sun: { azimuthDeg: number; elevationDeg: number }
  /** Deciduous canopies stop screening in winter. */
  season: 'summer' | 'winter'
  /** Grid snap increment in meters. 0 disables snapping. */
  snapIncrement: number
}

export const uid = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`
