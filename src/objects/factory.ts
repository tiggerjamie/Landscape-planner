import type { Vec2 } from '../geometry/polygon'
import { uid, type SceneObject } from '../model/types'
import { getObjectDef } from './registry'

/** Create a scene object of the given kind at a position, using its defaults. */
export function createObject(kind: string, position: Vec2): SceneObject | null {
  const def = getObjectDef(kind)
  if (!def) return null
  return {
    id: uid('obj'),
    name: def.label,
    kind,
    position,
    rotationDeg: 0,
    elevation: 0,
    params: { ...def.defaults },
  }
}
