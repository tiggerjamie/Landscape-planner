import type { ReactNode } from 'react'
import type { Occluder, PrismOccluder } from '../geometry/occlusion'
import { rectangle, v2 } from '../geometry/polygon'

/**
 * Shared drawing and occluder helpers so each object definition stays short
 * and reads as a description of the thing rather than three.js boilerplate.
 */

export const WOOD = '#9a7047'
export const WOOD_DARK = '#6f4f30'
export const STONE = '#9c9791'
export const STONE_DARK = '#6e6b67'
export const METAL = '#5c6066'
export const METAL_DARK = '#3d4147'
export const FOLIAGE = '#4f7a43'
export const FOLIAGE_AUTUMN = '#8a6b32'
export const TRUNK = '#6b533c'
export const FABRIC = '#c8ceca'

export const MATERIAL_PRESETS: { value: string; label: string; color: string }[] = [
  { value: 'wood', label: 'Wood', color: WOOD },
  { value: 'cedar', label: 'Cedar', color: '#b0764a' },
  { value: 'painted', label: 'Painted', color: '#e8e6e1' },
  { value: 'steel', label: 'Steel', color: METAL },
  { value: 'corten', label: 'Corten steel', color: '#8a5233' },
  { value: 'stone', label: 'Stone', color: STONE },
  { value: 'brick', label: 'Brick', color: '#9c5b45' },
]

export const materialColor = (value: string, fallback = WOOD): string =>
  MATERIAL_PRESETS.find((m) => m.value === value)?.color ?? fallback

/** A box whose *base* sits at `y`, centered on x/z unless offset. */
export function Box({
  width,
  depth,
  height,
  x = 0,
  y = 0,
  z = 0,
  color,
  roughness = 0.8,
}: {
  width: number
  depth: number
  height: number
  x?: number
  y?: number
  z?: number
  color: string
  roughness?: number
}): ReactNode {
  if (width <= 0 || depth <= 0 || height <= 0) return null
  return (
    <mesh position={[x, y + height / 2, z]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  )
}

/** A cylinder standing on its base at `y`. */
export function Cylinder({
  radius,
  height,
  x = 0,
  y = 0,
  z = 0,
  color,
  segments = 20,
  radiusTop,
  openEnded = false,
}: {
  radius: number
  height: number
  x?: number
  y?: number
  z?: number
  color: string
  segments?: number
  radiusTop?: number
  openEnded?: boolean
}): ReactNode {
  if (radius <= 0 || height <= 0) return null
  return (
    <mesh position={[x, y + height / 2, z]} castShadow receiveShadow>
      <cylinderGeometry args={[radiusTop ?? radius, radius, height, segments, 1, openEnded]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  )
}

/** An ellipsoid, used for plant canopies. */
export function Blob({
  radiusX,
  radiusY,
  radiusZ,
  x = 0,
  y = 0,
  z = 0,
  color,
}: {
  radiusX: number
  radiusY: number
  radiusZ: number
  x?: number
  y?: number
  z?: number
  color: string
}): ReactNode {
  if (radiusX <= 0 || radiusY <= 0 || radiusZ <= 0) return null
  return (
    <mesh position={[x, y, z]} scale={[radiusX, radiusY, radiusZ]} castShadow receiveShadow>
      <sphereGeometry args={[1, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </mesh>
  )
}

/** Rectangular prism occluder in local space, base at `yMin`. */
export function boxOccluder(
  width: number,
  depth: number,
  yMin: number,
  yMax: number,
  center = v2(0, 0),
  seasonal = false,
): PrismOccluder {
  return {
    type: 'prism',
    polygon: rectangle(width, depth, center),
    yMin,
    yMax,
    seasonal,
  }
}

/** Evenly spaced positions across `span`, centered on zero. */
export function spread(count: number, span: number): number[] {
  if (count <= 1) return [0]
  const step = span / (count - 1)
  return Array.from({ length: count }, (_, i) => -span / 2 + i * step)
}

export const noOccluders = (): Occluder[] => []
