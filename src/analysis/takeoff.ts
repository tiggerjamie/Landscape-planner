import { area, perimeter } from '../geometry/polygon'
import type { Scene, SurfaceMaterial } from '../model/types'
import { getObjectDef } from '../objects/registry'

/**
 * The shopping list. Turns a layout into quantities you can hand to a
 * supplier: area by ground material, bulk volume for anything you buy by the
 * yard, and a count of each object.
 */

export const MATERIAL_LABELS: Record<SurfaceMaterial, string> = {
  lawn: 'Lawn / turf',
  paver: 'Pavers',
  gravel: 'Gravel',
  mulch: 'Mulch',
  concrete: 'Concrete',
  deck: 'Decking',
  flagstone: 'Flagstone',
  water: 'Water',
}

export const MATERIAL_COLORS: Record<SurfaceMaterial, string> = {
  lawn: '#6f9152',
  paver: '#b3a898',
  gravel: '#9d9a93',
  mulch: '#6b4f3a',
  concrete: '#b8b6b1',
  deck: '#a17a4f',
  flagstone: '#9aa0a0',
  water: '#5b8ca6',
}

/** Materials sold by volume rather than by the square foot. */
const BULK_MATERIALS: SurfaceMaterial[] = ['gravel', 'mulch', 'concrete']

export interface MaterialLine {
  material: SurfaceMaterial
  label: string
  area: number
  /** Only meaningful for bulk materials; zero otherwise. */
  volume: number
  isBulk: boolean
  surfaceCount: number
}

export interface ObjectLine {
  kind: string
  label: string
  count: number
}

export interface Takeoff {
  materials: MaterialLine[]
  objects: ObjectLine[]
  /** Total area of all drawn surfaces. */
  totalSurfaceArea: number
  /** Area of the lot polygon. */
  lotArea: number
  /** Lot area not covered by any drawn surface. */
  uncoveredArea: number
  /** Total run of fences and walls, which is priced by the foot. */
  linearBoundary: number
}

/**
 * Areas are summed per surface. Overlapping surfaces are counted once each
 * rather than clipped against one another — a raised deck over gravel is two
 * real purchases, and clipping would understate both.
 */
export function computeTakeoff(scene: Scene): Takeoff {
  const byMaterial = new Map<SurfaceMaterial, MaterialLine>()

  for (const surface of scene.surfaces) {
    const surfaceArea = area(surface.polygon)
    if (surfaceArea <= 0) continue
    const existing = byMaterial.get(surface.material)
    const isBulk = BULK_MATERIALS.includes(surface.material)
    const volume = isBulk ? surfaceArea * Math.max(surface.thickness, 0) : 0
    if (existing) {
      existing.area += surfaceArea
      existing.volume += volume
      existing.surfaceCount += 1
    } else {
      byMaterial.set(surface.material, {
        material: surface.material,
        label: MATERIAL_LABELS[surface.material],
        area: surfaceArea,
        volume,
        isBulk,
        surfaceCount: 1,
      })
    }
  }

  const byKind = new Map<string, ObjectLine>()
  let linearBoundary = 0
  for (const obj of scene.objects) {
    const def = getObjectDef(obj.kind)
    const label = def?.label ?? obj.kind
    const existing = byKind.get(obj.kind)
    if (existing) existing.count += 1
    else byKind.set(obj.kind, { kind: obj.kind, label, count: 1 })

    // Fences and walls are quoted by the running foot.
    if (obj.kind === 'fence' || obj.kind === 'retainingWall') {
      const runLength = obj.params.length
      if (typeof runLength === 'number') linearBoundary += runLength
    }
  }

  const materials = [...byMaterial.values()].sort((a, b) => b.area - a.area)
  const totalSurfaceArea = materials.reduce((sum, m) => sum + m.area, 0)
  const lotArea = area(scene.lot)

  return {
    materials,
    objects: [...byKind.values()].sort((a, b) => a.label.localeCompare(b.label)),
    totalSurfaceArea,
    lotArea,
    uncoveredArea: Math.max(0, lotArea - totalSurfaceArea),
    linearBoundary,
  }
}

/** Perimeter of the lot, for fencing estimates. */
export const lotPerimeter = (scene: Scene): number => perimeter(scene.lot)
