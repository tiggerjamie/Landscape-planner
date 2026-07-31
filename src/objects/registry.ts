import type { ReactNode } from 'react'
import type { Occluder } from '../geometry/occlusion'
import type { Vec2 } from '../geometry/polygon'

/**
 * Every placeable object is one entry here. A definition carries its own
 * parameters, the controls needed to edit them, the geometry to draw it, and
 * the simplified solids that block a sightline.
 *
 * The palette, the inspector form, and the privacy analysis all read from
 * these fields, so adding a new object type means writing one file and
 * touching no UI or analysis code.
 */

export type ControlSpec =
  /** A distance, edited through the unit-aware length input. */
  | { key: string; label: string; type: 'length'; min?: number; max?: number; help?: string }
  /** A plain count or ratio, edited as a number. */
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number; help?: string }
  | { key: string; label: string; type: 'enum'; options: { value: string; label: string }[]; help?: string }
  | { key: string; label: string; type: 'color'; help?: string }
  | { key: string; label: string; type: 'boolean'; help?: string }

export type ObjectCategory = 'structures' | 'features' | 'plants' | 'furniture' | 'boundaries'

export interface ObjectContext {
  /** World position of the object's origin. */
  position: Vec2
  rotationDeg: number
  /** Base height above grade. */
  elevation: number
  season: 'summer' | 'winter'
}

export interface ObjectDef<P extends Record<string, unknown> = Record<string, unknown>> {
  kind: string
  label: string
  category: ObjectCategory
  /** One-line description shown in the palette. */
  blurb: string
  defaults: P
  controls: ControlSpec[]
  /** Overall extents, used for selection outlines and placement previews. */
  bounds: (params: P) => { width: number; depth: number; height: number }
  /**
   * Simplified solids in the object's *local* frame (origin at the object's
   * position, unrotated). The caller transforms them into world space.
   */
  occluders: (params: P, ctx: ObjectContext) => Occluder[]
  /** Procedural geometry, drawn in the object's local frame. */
  render: (params: P, ctx: ObjectContext) => ReactNode
}

const registry = new Map<string, ObjectDef<never>>()

export function registerObject<P extends Record<string, unknown>>(def: ObjectDef<P>): ObjectDef<P> {
  if (registry.has(def.kind)) {
    throw new Error(`Duplicate object kind registered: ${def.kind}`)
  }
  registry.set(def.kind, def as unknown as ObjectDef<never>)
  return def
}

export function getObjectDef(kind: string): ObjectDef<Record<string, unknown>> | undefined {
  return registry.get(kind) as ObjectDef<Record<string, unknown>> | undefined
}

export function allObjectDefs(): ObjectDef<Record<string, unknown>>[] {
  return [...registry.values()] as unknown as ObjectDef<Record<string, unknown>>[]
}

export const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  structures: 'Structures',
  features: 'Features',
  plants: 'Plants',
  furniture: 'Furniture',
  boundaries: 'Fences & Walls',
}

export function objectDefsByCategory(): { category: ObjectCategory; label: string; defs: ObjectDef<Record<string, unknown>>[] }[] {
  const order: ObjectCategory[] = ['structures', 'features', 'plants', 'furniture', 'boundaries']
  return order
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      defs: allObjectDefs().filter((d) => d.category === category),
    }))
    .filter((group) => group.defs.length > 0)
}

/**
 * Merge stored params over the definition's defaults. Layouts saved before a
 * new control was added are missing that key, and must still open.
 */
export function resolveParams<P extends Record<string, unknown>>(
  def: ObjectDef<P>,
  stored: Record<string, unknown>,
): P {
  return { ...def.defaults, ...stored } as P
}
