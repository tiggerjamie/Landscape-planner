import { bounds, centroid, edges, type Vec2 } from '../geometry/polygon'
import { v3, type Occluder, type Vec3 } from '../geometry/occlusion'
import type { Building, Window } from './types'

/**
 * Building geometry derived from the stored parameters. Both the renderer and
 * the privacy analysis read from here, so a window drawn on a wall and a
 * window used as a camera position can never drift apart.
 */

/**
 * How far a window's eye point sits proud of the wall face. Large enough that
 * the eye is unambiguously outside its own wall (which would otherwise read as
 * self-occluding), small enough not to shift the view noticeably.
 */
export const WALL_CLEARANCE = 0.15

export interface WindowFrame {
  /** The four corners of the glass, in world space. */
  corners: Vec3[]
  /** Center of the glass, in the plane of the wall. */
  center: Vec3
  /** Outward horizontal normal of the wall this window sits in. */
  normal: Vec2
  /** Camera position for looking out of this window — offset clear of the wall. */
  eye: Vec3
  /** Sample points for occlusion testing: four corners plus the center. */
  samples: Vec3[]
  /** Whether the window resolved to a real wall edge. */
  valid: boolean
}

const INVALID: WindowFrame = {
  corners: [],
  center: v3(0, 0, 0),
  normal: { x: 0, z: 1 },
  eye: v3(0, 0, 0),
  samples: [],
  valid: false,
}

/** Ridge height above the eave, and the eave height above grade. */
export function roofMetrics(building: Building): {
  eaveY: number
  ridgeY: number
  rise: number
} {
  const eaveY = building.baseElevation + building.wallHeight
  if (building.roof.type === 'flat') {
    return { eaveY, ridgeY: eaveY, rise: 0 }
  }
  const b = bounds(building.footprint)
  // A gable ridge runs along one axis, so the span is across the other one.
  const span = building.roof.ridgeAxis === 0 ? b.depth : b.width
  const rise = (span / 2) * building.roof.pitch
  return { eaveY, ridgeY: eaveY + rise, rise }
}

/**
 * Place a window in world space from its wall index and offsets.
 * Returns `valid: false` if the wall index no longer exists — footprints can
 * be re-drawn with fewer edges after windows were added to them.
 */
export function windowFrame(building: Building, win: Window): WindowFrame {
  const wallEdges = edges(building.footprint)
  const edge = wallEdges[win.wallIndex]
  if (!edge || edge.length < 1e-6) return INVALID

  // Keep the window inside its wall even if the wall was later shortened.
  const width = Math.min(win.width, edge.length)
  const offset = Math.max(0, Math.min(win.offsetAlongWall, edge.length - width))

  const dir = edge.direction
  const leftX = edge.start.x + dir.x * offset
  const leftZ = edge.start.z + dir.z * offset
  const rightX = leftX + dir.x * width
  const rightZ = leftZ + dir.z * width

  const yBottom = building.baseElevation + win.sillHeight
  const yTop = yBottom + win.height

  const corners = [
    v3(leftX, yBottom, leftZ),
    v3(rightX, yBottom, rightZ),
    v3(rightX, yTop, rightZ),
    v3(leftX, yTop, leftZ),
  ]
  const center = v3((leftX + rightX) / 2, (yBottom + yTop) / 2, (leftZ + rightZ) / 2)

  // Pull samples slightly in from the corners so they sit on the glass rather
  // than exactly on the frame edge, where a neighbouring wall may touch.
  const inset = 0.02
  const samples = corners.map((c) => {
    const tx = center.x - c.x
    const ty = center.y - c.y
    const tz = center.z - c.z
    const len = Math.hypot(tx, ty, tz) || 1
    return v3(
      c.x + (tx / len) * inset + edge.normal.x * WALL_CLEARANCE,
      c.y + (ty / len) * inset,
      c.z + (tz / len) * inset + edge.normal.z * WALL_CLEARANCE,
    )
  })
  samples.push(
    v3(
      center.x + edge.normal.x * WALL_CLEARANCE,
      center.y,
      center.z + edge.normal.z * WALL_CLEARANCE,
    ),
  )

  return {
    corners,
    center,
    normal: edge.normal,
    eye: v3(
      center.x + edge.normal.x * WALL_CLEARANCE,
      center.y,
      center.z + edge.normal.z * WALL_CLEARANCE,
    ),
    samples,
    valid: true,
  }
}

/**
 * Simplified solids for the privacy raycasts.
 *
 * The walls are an exact vertical extrusion of the footprint. A pitched roof
 * is approximated by a second prism over an inset footprint, which captures
 * that a roof blocks less than the walls do as it rises, without needing a
 * true swept-roof solid.
 */
export function buildingOccluders(building: Building): Occluder[] {
  if (building.footprint.length < 3) return []
  const { eaveY, ridgeY, rise } = roofMetrics(building)

  const result: Occluder[] = [
    {
      type: 'prism',
      polygon: building.footprint,
      yMin: building.baseElevation,
      yMax: eaveY,
      sourceId: building.id,
    },
  ]

  if (rise > 1e-6) {
    result.push({
      type: 'prism',
      polygon: insetPolygon(building.footprint, 0.25),
      yMin: eaveY,
      yMax: ridgeY,
      sourceId: building.id,
    })
  }
  return result
}

/**
 * Scale a polygon toward its centroid. Used for the roof approximation, where
 * an exact offset is unnecessary and scaling is well-behaved on any shape.
 */
export function insetPolygon(polygon: Vec2[], fraction: number): Vec2[] {
  const c = centroid(polygon)
  const k = 1 - fraction
  return polygon.map((p) => ({ x: c.x + (p.x - c.x) * k, z: c.z + (p.z - c.z) * k }))
}

/** Every window on a building that is offered as a camera position. */
export function viewpointWindows(building: Building): Window[] {
  return building.windows.filter((w) => w.isViewpoint)
}
