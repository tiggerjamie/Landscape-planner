import {
  activeOccluders,
  firstBlocker,
  v3,
  type Occluder,
  type Vec3,
} from '../geometry/occlusion'
import { buildingOccluders, windowFrame } from '../model/building'
import type { Building, Scene, Window } from '../model/types'
import { getObjectDef, resolveParams } from '../objects/registry'
import { toWorldOccluders } from '../objects/transform'

/**
 * The privacy analysis. Given a scene, work out which windows can see which
 * other windows, and what — if anything — is in the way.
 *
 * Everything here is a pure function of the scene so it can be tested without
 * a renderer, and so a design change re-evaluates instantly.
 */

export interface Viewpoint {
  id: string
  label: string
  /** Which building it belongs to, for grouping and for self-view filtering. */
  buildingId: string | null
  buildingKind: 'own' | 'neighbor' | null
  eye: Vec3
  /** Direction the viewer faces, as a horizontal vector. */
  facing: { x: number; z: number }
  kind: 'window' | 'standing'
}

export type Exposure = 'exposed' | 'partial' | 'blocked'

export interface SightlineResult {
  fromId: string
  toId: string
  fromLabel: string
  toLabel: string
  /** How many of the target's sample points are visible, out of `sampleCount`. */
  visibleSamples: number
  sampleCount: number
  exposure: Exposure
  /** Straight-line distance between eye and target center. */
  distance: number
  /** Id of the scene element doing most of the screening, if any. */
  blockerId: string | null
  /** Whether the target is within the viewer's forward field of view. */
  inFieldOfView: boolean
}

/** Half-angle of the cone treated as "looking at", in degrees. */
const FIELD_OF_VIEW_HALF_ANGLE = 60

/**
 * Collect every occluder in the scene: buildings, plus each placed object's
 * simplified solids lifted into world space.
 */
export function collectOccluders(scene: Scene): Occluder[] {
  const out: Occluder[] = []
  for (const building of scene.buildings) {
    out.push(...buildingOccluders(building))
  }
  for (const obj of scene.objects) {
    const def = getObjectDef(obj.kind)
    if (!def) continue
    const ctx = {
      position: obj.position,
      rotationDeg: obj.rotationDeg,
      elevation: obj.elevation,
      season: scene.season,
    }
    const local = def.occluders(resolveParams(def, obj.params), ctx)
    out.push(...toWorldOccluders(local, ctx, obj.id))
  }
  return out
}

/** Every place the camera can be put: viewpoint windows plus standing points. */
export function collectViewpoints(scene: Scene): Viewpoint[] {
  const out: Viewpoint[] = []
  for (const building of scene.buildings) {
    for (const win of building.windows) {
      if (!win.isViewpoint) continue
      const frame = windowFrame(building, win)
      if (!frame.valid) continue
      out.push({
        id: win.id,
        label: `${building.name} — ${win.name}`,
        buildingId: building.id,
        buildingKind: building.kind,
        eye: frame.eye,
        facing: frame.normal,
        kind: 'window',
      })
    }
  }
  for (const vp of scene.viewpoints) {
    // headingDeg is compass-style: 0 looks toward -Z, increasing clockwise.
    const rad = (vp.headingDeg * Math.PI) / 180
    out.push({
      id: vp.id,
      label: vp.name,
      buildingId: null,
      buildingKind: null,
      eye: v3(vp.position.x, vp.eyeHeight, vp.position.z),
      facing: { x: Math.sin(rad), z: -Math.cos(rad) },
      kind: 'standing',
    })
  }
  return out
}

export interface TargetWindow {
  id: string
  label: string
  buildingId: string
  buildingKind: 'own' | 'neighbor'
  samples: Vec3[]
  center: Vec3
}

/** Every window in the scene, as something that can be looked *at*. */
export function collectTargets(scene: Scene): TargetWindow[] {
  const out: TargetWindow[] = []
  for (const building of scene.buildings) {
    for (const win of building.windows) {
      const frame = windowFrame(building, win)
      if (!frame.valid) continue
      out.push({
        id: win.id,
        label: `${building.name} — ${win.name}`,
        buildingId: building.id,
        buildingKind: building.kind,
        samples: frame.samples,
        center: frame.center,
      })
    }
  }
  return out
}

function exposureFor(visible: number, total: number): Exposure {
  if (visible === 0) return 'blocked'
  if (visible === total) return 'exposed'
  return 'partial'
}

/**
 * Evaluate one eye against one target. Sampling five points across the glass
 * rather than one center point is what distinguishes "fully screened" from
 * "you can still see in from the left half of the patio".
 */
export function evaluateSightline(
  from: Viewpoint,
  to: TargetWindow,
  occluders: Occluder[],
): SightlineResult {
  let visible = 0
  const blockerCounts = new Map<string, number>()

  for (const sample of to.samples) {
    const blocker = firstBlocker(occluders, from.eye, sample)
    if (!blocker) {
      visible++
    } else if (blocker.sourceId) {
      blockerCounts.set(blocker.sourceId, (blockerCounts.get(blocker.sourceId) ?? 0) + 1)
    }
  }

  let blockerId: string | null = null
  let best = 0
  for (const [id, count] of blockerCounts) {
    if (count > best) {
      best = count
      blockerId = id
    }
  }

  const dx = to.center.x - from.eye.x
  const dz = to.center.z - from.eye.z
  const dy = to.center.y - from.eye.y
  const horizontal = Math.hypot(dx, dz) || 1e-9
  const cosAngle = (dx / horizontal) * from.facing.x + (dz / horizontal) * from.facing.z
  const inFieldOfView = cosAngle >= Math.cos((FIELD_OF_VIEW_HALF_ANGLE * Math.PI) / 180)

  return {
    fromId: from.id,
    toId: to.id,
    fromLabel: from.label,
    toLabel: to.label,
    visibleSamples: visible,
    sampleCount: to.samples.length,
    exposure: exposureFor(visible, to.samples.length),
    distance: Math.hypot(dx, dy, dz),
    blockerId,
    inFieldOfView,
  }
}

export interface PrivacyReport {
  results: SightlineResult[]
  /** Sightlines that cross between our property and the neighbor's. */
  crossProperty: SightlineResult[]
  exposedCount: number
  partialCount: number
  blockedCount: number
}

/**
 * The whole picture: every viewpoint against every window that is not on the
 * same building. Cross-property pairs are called out separately because those
 * are the ones that actually matter when planning screening.
 */
export function analyzePrivacy(scene: Scene): PrivacyReport {
  const occluders = activeOccluders(collectOccluders(scene), scene.season)
  const viewpoints = collectViewpoints(scene)
  const targets = collectTargets(scene)

  const results: SightlineResult[] = []
  for (const from of viewpoints) {
    for (const to of targets) {
      // A window cannot meaningfully look at itself or at its own house.
      if (from.id === to.id) continue
      if (from.buildingId && from.buildingId === to.buildingId) continue
      results.push(evaluateSightline(from, to, occluders))
    }
  }

  const crossProperty = results.filter((r) => {
    const from = viewpoints.find((v) => v.id === r.fromId)
    const to = targets.find((t) => t.id === r.toId)
    if (!from || !to) return false
    // A standing point in our yard looking at a neighbor window counts.
    const fromKind = from.buildingKind ?? 'own'
    return fromKind !== to.buildingKind
  })

  return {
    results,
    crossProperty,
    exposedCount: crossProperty.filter((r) => r.exposure === 'exposed').length,
    partialCount: crossProperty.filter((r) => r.exposure === 'partial').length,
    blockedCount: crossProperty.filter((r) => r.exposure === 'blocked').length,
  }
}

/** Human-readable name for whatever is doing the screening. */
export function describeBlocker(scene: Scene, blockerId: string | null): string | null {
  if (!blockerId) return null
  const building = scene.buildings.find((b) => b.id === blockerId)
  if (building) return building.name
  const obj = scene.objects.find((o) => o.id === blockerId)
  if (obj) return obj.name
  return null
}

export const EXPOSURE_LABELS: Record<Exposure, string> = {
  exposed: 'Full view',
  partial: 'Partly screened',
  blocked: 'Screened',
}

export const EXPOSURE_COLORS: Record<Exposure, string> = {
  exposed: '#d9534f',
  partial: '#e0a03c',
  blocked: '#4c9a5a',
}

export type { Building, Window }
