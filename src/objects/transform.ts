import type { Occluder } from '../geometry/occlusion'
import { rotate, type Vec2 } from '../geometry/polygon'
import type { ObjectContext } from './registry'

/**
 * Object definitions describe their occluders in a local frame — origin at the
 * object, unrotated, sitting on grade. This lifts them into world space so the
 * privacy analysis sees them where they are actually drawn.
 */
export function toWorldOccluders(local: Occluder[], ctx: ObjectContext, sourceId: string): Occluder[] {
  return local.map((o) => {
    if (o.type === 'prism') {
      return {
        ...o,
        sourceId,
        polygon: o.polygon.map((p) => localToWorld(p, ctx)),
        yMin: o.yMin + ctx.elevation,
        yMax: o.yMax + ctx.elevation,
      }
    }
    const spun = rotate({ x: o.center.x, z: o.center.z }, ctx.rotationDeg)
    return {
      ...o,
      sourceId,
      center: {
        x: spun.x + ctx.position.x,
        y: o.center.y + ctx.elevation,
        z: spun.z + ctx.position.z,
      },
    }
  })
}

export function localToWorld(p: Vec2, ctx: ObjectContext): Vec2 {
  const spun = rotate(p, ctx.rotationDeg)
  return { x: spun.x + ctx.position.x, z: spun.z + ctx.position.z }
}
